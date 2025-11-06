// src/lib/chatService.ts
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import {
  getPublicHttpClient,
  getWalletClient,
  publisherAddress,
} from "./clients";
import { waitForTransactionReceipt } from "viem/actions";
import { toHex, type Hex, type Hash } from "viem";
import { chatSchema } from "./chatSchema";
import { ensureChatEventSchema, CHAT_EVENT_ID } from "./chatEvents";
import { buildEventTopics } from "./eventHelpers";

const enc = new SchemaEncoder(chatSchema);

// Somnia Streams SDK helper function
function getSdk(withWallet = false) {
  return withWallet
    ? new SDK({ public: getPublicHttpClient(), wallet: getWalletClient() })
    : new SDK({ public: getPublicHttpClient() });
}

// Computes the chat data schema id, registers it on-chain if missing, waits for receipt, and returns the id
export async function ensureChatSchema(): Promise<Hex> {
  const sdk = getSdk(true);

  const id = await sdk.streams.computeSchemaId(chatSchema);
  if (!id) throw new Error("Failed to compute chat schemaId");

  const exists = await sdk.streams.isDataSchemaRegistered(id);
  if (!exists) {
    const registrations = [{ id: "ChatMessageData", schema: chatSchema }];
    const tx = await sdk.streams.registerDataSchemas(registrations);

    if (!tx) throw new Error("registerDataSchemas returned null/undefined");
    if (tx instanceof Error) throw tx;

    await waitForTransactionReceipt(getPublicHttpClient(), {
      hash: tx as Hash,
    });
  }
  return id;
}

// Encodes and writes a chat data stream (and emits the chat event), waits for the tx receipt, and returns the tx hash
export async function sendMessage(
  roomName: string,
  content: string,
  senderName: string
) {
  if (!roomName?.trim()) throw new Error("roomName is required");
  if (!content?.trim()) throw new Error("content is required");

  const sdk = getSdk(true);
  const schemaId = await ensureChatSchema();
  await ensureChatEventSchema();

  const roomId = toHex(roomName, { size: 32 });
  const now = Date.now().toString();

  const data: Hex = enc.encodeData([
    { name: "timestamp", value: now, type: "uint64" },
    { name: "roomId", value: roomId, type: "bytes32" },
    { name: "content", value: content, type: "string" },
    { name: "senderName", value: senderName ?? "", type: "string" },
    { name: "sender", value: publisherAddress(), type: "address" },
  ]);

  const dataId = toHex(`${roomName}-${now}`, { size: 32 });

  // Build event topics/data
  const argumentTopics = buildEventTopics(roomId);
  const eventData = "0x" as Hex;

  // One tx: publish data + emit event
  const tx = await sdk.streams.setAndEmitEvents(
    [{ id: dataId, schemaId, data }],
    [{ id: CHAT_EVENT_ID, argumentTopics, data: eventData }]
  );
  if (!tx) throw new Error("Failed to setAndEmitEvents");
  await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx as Hash });

  return { txHash: tx };
}
