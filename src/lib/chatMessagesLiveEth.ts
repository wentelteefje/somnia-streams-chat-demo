// src/lib/chatMessagesLiveEth.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { SDK } from "@somnia-chain/streams";
import { chatSchema } from "./chatSchema";
import type { ChatMsg } from "./chatQuery";
import { getPublicHttpClient, getPublicWsClient } from "./clients";
import {
  type Address,
  type Hex,
  isAddress,
  toHex,
  encodeFunctionData,
  decodeFunctionResult,
} from "viem";
import { CHAT_EVENT_ID } from "./chatEvents";

const unwrapValue = (f: any) => f?.value?.value ?? f?.value ?? f;

function mapRowsToChatMsg(
  rowsLike: unknown,
  roomTopicLower: string | null
): ChatMsg[] {
  const rows = Array.isArray(rowsLike) ? (rowsLike as any[]) : [];
  const out: ChatMsg[] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const [tsRaw, roomIdRaw, contentRaw, nameRaw, senderRaw] =
      row.map(unwrapValue);

    const ts = Number(tsRaw);
    const ms = String(ts).length <= 10 ? ts * 1000 : ts;

    const roomId = String(roomIdRaw) as Hex;
    if (roomTopicLower && roomId.toLowerCase() !== roomTopicLower) continue;

    out.push({
      timestamp: ms,
      roomId,
      content: String(contentRaw ?? ""),
      senderName: String(nameRaw ?? ""),
      sender: String(
        senderRaw ?? "0x0000000000000000000000000000000000000000"
      ) as Hex,
    });
  }

  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function resolvePublisherFromEnv(): Hex {
  const raw = (process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS ?? "").trim();
  return (
    isAddress(raw) ? raw : "0x0000000000000000000000000000000000000000"
  ) as Hex;
}

export function useChatMessagesLiveEth(roomName?: string, limit = 100) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);

  // React hook that runs once on mount to fetch chat history and start live subscription
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const desiredTopic = roomName
          ? toHex(roomName, { size: 32 }).toLowerCase()
          : null;
        const publisher = resolvePublisherFromEnv();

        // 1) Initial history over HTTP
        const httpSdk = new SDK({ public: getPublicHttpClient() });
        const schemaId = await httpSdk.streams.computeSchemaId(chatSchema);
        if (!schemaId) throw new Error("Failed to compute chat schemaId!");

        const initialRows = await httpSdk.streams.getAllPublisherDataForSchema(
          schemaId,
          publisher
        );
        const initialMsgs = mapRowsToChatMsg(initialRows, desiredTopic);
        if (!alive) return;
        setMessages(initialMsgs.slice(-limit));
        setLoading(false);

        // 2) Subscribe over WS with ethCalls
        const wsSdk = new SDK({ public: getPublicWsClient() });
        const info = await wsSdk.streams.getSomniaDataStreamsProtocolInfo();
        if (!info || info instanceof Error) {
          throw new Error("Failed to resolve Streams protocol");
        }
        const protocolAddress = info.address as Address;
        const protocolAbi = info.abi;

        const callData = encodeFunctionData({
          abi: protocolAbi,
          functionName: "getAllPublisherDataForSchema",
          args: [schemaId, publisher],
        });

        const sub = await wsSdk.streams.subscribe({
          somniaStreamsEventId: CHAT_EVENT_ID,
          ethCalls: [{ to: protocolAddress, data: callData }],
          onlyPushChanges: false,
          onData: async (cb) => {
            if (!alive) return;

            // Optional room filter via topic1 (bytes32 roomId)
            const topics = cb?.result?.topics || [];
            const topic1 = (topics[1] ?? "").toLowerCase();
            if (desiredTopic && topic1 !== desiredTopic) return;

            const sim0 = cb?.result?.simulationResults?.[0];
            if (!sim0) return;

            // a) ABI-decode: bytes[] of encoded rows
            const rawRows = decodeFunctionResult({
              abi: protocolAbi,
              functionName: "getAllPublisherDataForSchema",
              data: sim0 as Hex,
            }) as Hex[];

            // b) SDK schema deserialisation (public schema expected)
            const decoded = await wsSdk.streams.deserialiseRawData(
              rawRows,
              schemaId
            );

            // Expect SchemaDecodedItem[][] (array of rows; each row is array of items)
            if (!Array.isArray(decoded) || !Array.isArray(decoded[0])) {
              // For this tutorial we assume a public schema; return if not the expected shape
              console.error(
                "❌ Schema deserialization failed — schema might not be public or data malformed"
              );
              return;
            }

            // Normalise to plain rows (arrays of cell values) and use the parser
            const normalised = (decoded as Array<Array<{ value: any }>>).map(
              (row) => row.map((col) => unwrapValue(col.value))
            );
            const next = mapRowsToChatMsg(normalised, desiredTopic);
            if (!next.length) return;

            setMessages(next.slice(-limit));
            setError(null);
          },
          onError: (err) => {
            if (!alive) return;
            setError(err?.message ?? "subscription error");
          },
        });

        unsubRef.current = sub?.unsubscribe ?? null;
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "init failed");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (unsubRef.current) {
        try {
          unsubRef.current();
        } catch {}
        unsubRef.current = null;
      }
    };
  }, [roomName, limit]);

  return { messages, loading, error };
}
