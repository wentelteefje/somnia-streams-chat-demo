// src/app/api/send/route.ts
export const runtime = 'nodejs'     // ✅ ensure Node.js runtime (has process.env)
export const dynamic = 'force-dynamic' // optional: avoid static optimization

import { NextResponse } from 'next/server'
import { sendMessage } from '@/lib/chatService'

export async function POST(req: Request) {
  try {
    const { room, content, senderName } = await req.json()

    if (!room || !content) {
      return NextResponse.json({ error: 'room & content required' }, { status: 400 })
    }

    const { txHash } = await sendMessage(room, content, senderName ?? '')
    return NextResponse.json({ ok: true, txHash })
  } catch (e) {
    // Log the real reason server-side, return a generic message client-side
    console.error('[api/send] error:', e)
    return NextResponse.json({ error: 'send failed (server)' }, { status: 500 })
  }
}