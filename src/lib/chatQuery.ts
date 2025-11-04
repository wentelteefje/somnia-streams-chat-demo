// src/lib/chatQuery.ts
import { type Hex } from 'viem'

export interface ChatMsg {
  /** Unix time in milliseconds */
  timestamp: number
  /** 32-byte room id as hex (0x-prefixed) */
  roomId: Hex
  /** Message body */
  content: string
  /** Display name of the sender (free text) */
  senderName: string
  /** Sender wallet/address (0x-prefixed) */
  sender: Hex
}