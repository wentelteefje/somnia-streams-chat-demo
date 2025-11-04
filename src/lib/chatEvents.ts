// src/lib/chatEvents.ts
import { SDK } from '@somnia-chain/streams'
import { getPublicHttpClient, getWalletClient } from './clients'
import { waitForTransactionReceipt } from 'viem/actions'
import type { Hash } from 'viem'

export const CHAT_EVENT_ID  = 'ChatMessageV2'
export const CHAT_EVENT_SIG = 'ChatMessageV2(bytes32 indexed roomId)'

export async function ensureChatEventSchema() {
  const sdk = new SDK({ public: getPublicHttpClient(), wallet: getWalletClient() })

  // Fast path: already registered?
  try {
    const existing = await sdk.streams.getEventSchemasById([CHAT_EVENT_ID])
    if (Array.isArray(existing) && existing.length > 0) return
  } catch {
    // ignore & try register
  }

  // Register and WAIT for confirmation
  const tx = await sdk.streams.registerEventSchemas(
    [CHAT_EVENT_ID],
    [{
      params: [{ name: 'roomId', paramType: 'bytes32', isIndexed: true }],
      // SDK derives keccak256(topic) from signature under the hood
      eventTopic: CHAT_EVENT_SIG,
    }]
  )

  if (!tx || tx instanceof Error) {
    throw new Error(`Failed to register event schema: ${tx instanceof Error ? tx.message : 'null tx'}`)
  }

  await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx as Hash })

  // Optional: verify it’s visible now
  const after = await sdk.streams.getEventSchemasById([CHAT_EVENT_ID])
  if (!Array.isArray(after) || after.length === 0) {
    throw new Error('Event schema still not visible after registration confirmation')
  }
}