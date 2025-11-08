// src/lib/eventHelpers.ts
import { parseAbiItem, encodeEventTopics, type Hex } from "viem";
import { CHAT_EVENT_SIG } from "./chatEvents";

export function buildEventTopics(roomId: Hex): Hex[] {
  const abiItem = parseAbiItem(`event ${CHAT_EVENT_SIG}`);
  const topics = encodeEventTopics({ abi: [abiItem], args: { roomId } });
  // drop the signature topic and flatten the rest
  return topics
    .slice(1)
    .flatMap((t) => (t == null ? [] : Array.isArray(t) ? t : [t])) as Hex[];
}
