// src/lib/chatService.ts
import { SDK, SchemaEncoder, zeroBytes32 } from '@somnia-chain/streams'
import { getPublicHttpClient, getWalletClient, publisherAddress } from './clients'
import { waitForTransactionReceipt } from 'viem/actions'
import { toHex, type Hex, type Hash, type Abi, parseAbiItem, encodeEventTopics, encodeAbiParameters } from 'viem'
import { simulateContract } from 'viem/actions'
import { chatSchema } from './chatSchema'
import { ensureChatEventSchema, CHAT_EVENT_ID, CHAT_EVENT_SIG } from './chatEvents'

const enc = new SchemaEncoder(chatSchema)

function getSdk(withWallet = false) {
  return withWallet
    ? new SDK({ public: getPublicHttpClient(), wallet: getWalletClient() })
    : new SDK({ public: getPublicHttpClient() })
}

// If you have a constant schemaId, you can hardcode it.
// Otherwise: compute + ensure registration once.
let _schemaId: `0x${string}` | null = null

export async function ensureChatSchema(): Promise<`0x${string}`> {
  const sdk = getSdk(true)
  if (_schemaId) return _schemaId
  
  const id = await sdk.streams.computeSchemaId(chatSchema)
  if (!id) throw new Error('Failed to compute chat schemaId')

  const exists = await sdk.streams.isDataSchemaRegistered(id)
  if (!exists) {
    const registrations = [{ id: 'ChatMessageData', schema: chatSchema }]
    const tx = await sdk.streams.registerDataSchemas(registrations)

    if (!tx) throw new Error('registerDataSchemas returned null/undefined')
    if (tx instanceof Error) throw tx

    await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx as Hash})
  }
  _schemaId = id
  console.log(id, "here")
  return id
}

export async function sendMessage(roomName: string, content: string, senderName: string) {
  if (!roomName?.trim()) throw new Error('roomName is required')
  if (!content?.trim()) throw new Error('content is required')

  const sdk = getSdk(true)
  const schemaId = await ensureChatSchema()
  await ensureChatEventSchema()


  // --- NEW: fetch protocol address & abi from the SDK ---
  const proto = await sdk.streams.getSomniaDataStreamsProtocolInfo()
  if (!proto || proto instanceof Error) {
    throw new Error('Could not resolve Streams protocol address/ABI for this chain')
  }
  const protocolAddress = proto.address as `0x${string}`
  const protocolAbi = proto.abi as Abi
  // ---

  const roomId = toHex(roomName, { size: 32 })
  const now = Date.now().toString()

  const data: Hex = enc.encodeData([
    { name: 'timestamp',  value: now,                type: 'uint64'  },
    { name: 'roomId',     value: roomId,             type: 'bytes32' },
    { name: 'content',    value: content,            type: 'string'  },
    { name: 'senderName', value: senderName ?? '',   type: 'string'  },
    { name: 'sender',     value: publisherAddress(), type: 'address' },
  ])

  const dataId = toHex(`${roomName}-${now}`, { size: 32 })

  // Build event topics/data
  const abiItem = parseAbiItem(`event ${CHAT_EVENT_SIG}`)
  const topics = encodeEventTopics({ abi: [abiItem], args: { roomId } })
  const argumentTopics = topics
    .slice(1)
    .flatMap(t => (t == null ? [] : Array.isArray(t) ? t : [t])) as Hex[]
  const nonIndexed = abiItem.inputs.filter(i => !i.indexed)
  const eventData = nonIndexed.length ? encodeAbiParameters(nonIndexed, []) : '0x'

  // One tx: publish data + emit event
  const tx = await sdk.streams.setAndEmitEvents(
    [{ id: dataId, schemaId, data }],
    [{ id: CHAT_EVENT_ID, argumentTopics, data: eventData }]
  )
  if (!tx) throw new Error('Failed to setAndEmitEvents')
  await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx as Hash})
console.log(tx, "here too")
  return { txHash: tx }
}
