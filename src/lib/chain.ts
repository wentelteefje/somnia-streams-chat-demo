// src/lib/chain.ts
import { defineChain } from "viem";

const RPC_HTTP =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://dream-rpc.somnia.network";
const RPC_WS =
  process.env.NEXT_PUBLIC_WS_URL ?? "wss://dream-rpc.somnia.network/ws";

// Somnia testnet chain config for viem
export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  network: "somnia-testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_HTTP], webSocket: [RPC_WS] },
    public: { http: [RPC_HTTP], webSocket: [RPC_WS] },
  },
} as const);
