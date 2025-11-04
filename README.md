# 🗨️ Somnia Streams Chat Demo (Streams v0.9.4)

A simple chat example built on the **Somnia Data Streams** protocol.  

---

## ⚙️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local env file

```bash
touch .env.local
```

Open it and add:
```bash
RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=0x<your_publisher_address_private_key>

CHAT_SCHEMA_ID=0x80fda840ee61c587e4ca61af66e60ce19f0ac64ad923a25f0b061875c84c20f2
NEXT_PUBLIC_PUBLISHER_ADDRESS=<your_publisher_address>
```

> 🪙 Get free testnet tokens for gas at https://testnet.somnia.network/.

---

## 🧩 Notes on events
- **Data streams**: Anyone can write.
- **Event streams**: Only the wallet that registered the event schema can emit that event.

If you use the provided `ChatMessageV2` event and see
`Unauthorized()` or `EventSchemaNotRegistered()`:

1. Register your own event ID and signature in
`src/lib/chatEvents.ts` like this:

```ts
export const CHAT_EVENT_ID  = 'ChatMessage<YourName>'
export const CHAT_EVENT_SIG = 'ChatMessage<YourName>(bytes32 indexed roomId)'
```

---

## ▶️ Run the app

Start the Next.js dev server:

```bash
npm run dev
```

Enjoy building on **Somnia Streams v0.9.4** 🪄