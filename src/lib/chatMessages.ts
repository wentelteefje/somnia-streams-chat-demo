'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { SDK } from '@somnia-chain/streams'
import { getPublicHttpClient } from './clients'
import { chatSchema } from './chatSchema'
import type { ChatMsg } from './chatQuery'
import { toHex } from 'viem'

const val = (f: any): any => f?.value?.value ?? f?.value

// Robust detection of "NoData()" — no instanceof, just string matching across common fields.
function isNoDataRevert(err: unknown): boolean {
  try {
    const parts: string[] = []
    const anyErr = err as any
    if (anyErr?.shortMessage) parts.push(String(anyErr.shortMessage))
    if (anyErr?.message) parts.push(String(anyErr.message))
    // viem BaseError often has a `details`/`metaMessages` array; add them if present
    if (Array.isArray(anyErr?.metaMessages)) parts.push(anyErr.metaMessages.join(' | '))
    if (anyErr?.cause?.message) parts.push(String(anyErr.cause.message))
    if (anyErr?.cause?.shortMessage) parts.push(String(anyErr.cause.shortMessage))
    const text = parts.join(' | ')
    return /NoData\(\)/i.test(text)
  } catch {
    return false
  }
}

/**
 * Fetch chat messages from Somnia Streams (read-only, auto-refresh, cumulative)
 */
export function useChatMessages(roomName?: string, limit = 100, refreshMs = 5000) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async () => {
    try {
      const sdk = new SDK({ public: getPublicHttpClient() })
      const schemaId = await sdk.streams.computeSchemaId(chatSchema)
      if (!schemaId) throw new Error('Failed to compute chat schemaId!')

      const publisher = (
        process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS ??
        '0x0000000000000000000000000000000000000000'
      ) as `0x${string}`

      // Debugging
      // console.log('[useChatMessages] reading publisher:', publisher)

      // Try to read; treat NoData() as "no rows"
      let rows: unknown[] = []
      try {
        const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher)
        rows = Array.isArray(resp) ? resp : []
      } catch (e) {
        if (isNoDataRevert(e)) {
          rows = [] // nothing written yet — not an error
        } else {
          throw e
        }
      }

      const want = roomName
        ? toHex(roomName, { size: 32 }).toLowerCase()
        : null

      const newMessages: ChatMsg[] = []
      for (const row of rows) {
        if (!Array.isArray(row)) continue
        const ts = Number(val(row[0]))
        const ms = String(ts).length <= 10 ? ts * 1000 : ts
        const rid = String(val(row[1])) as `0x${string}`
        if (want && rid.toLowerCase() !== want) continue
        newMessages.push({
          timestamp: ms,
          roomId: rid,
          content: String(val(row[2]) ?? ''),
          senderName: String(val(row[3]) ?? ''),
          sender: String(
            val(row[4]) ?? '0x0000000000000000000000000000000000000000'
          ) as `0x${string}`,
        })
      }

      // Sort new messages chronologically
      newMessages.sort((a, b) => a.timestamp - b.timestamp)

      setMessages((prev) => {
        // Combine existing and new, deduplicating by timestamp+sender+content
        const combined = [...prev, ...newMessages]
        const unique = combined.filter(
          (msg, index, self) =>
            index ===
            self.findIndex(
              (m) =>
                m.timestamp === msg.timestamp &&
                m.sender === msg.sender &&
                m.content === msg.content
            )
        )
        // Keep only the latest N messages
        return unique.slice(-limit)
      })

      setError(null)
    } catch (err) {
      console.error('❌ Failed to load chat messages:', err)
      // setError(err.message || 'Failed to load messages')
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [roomName, limit])

  // Initial load + periodic refresh
  useEffect(() => {
    setLoading(true)
    loadMessages()

    timerRef.current = setInterval(loadMessages, refreshMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadMessages, refreshMs])

  return { messages, loading, error, reload: loadMessages }
}
