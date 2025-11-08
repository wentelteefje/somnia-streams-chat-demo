// src/lib/clients.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type PublicClient,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

const RPC_HTTP =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://dream-rpc.somnia.network";
const RPC_WS =
  process.env.NEXT_PUBLIC_WS_URL ?? "wss://dream-rpc.somnia.network/ws";

let _pubWs: PublicClient | null = null;
// Returns a viem public client (WS) configured for Somnia testnet (used for subscribe)
export function getPublicWsClient() {
  if (_pubWs) return _pubWs;
  _pubWs = createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(RPC_WS),
  });
  return _pubWs;
}

let _pub: PublicClient | null = null;
// Returns a viem public client (HTTP) configured for Somnia testnet
export function getPublicHttpClient(): PublicClient {
  if (_pub) return _pub;
  _pub = createPublicClient({
    chain: somniaTestnet,
    transport: http(RPC_HTTP),
  }) as unknown as PublicClient;
  return _pub;
}

let _wallet: ReturnType<typeof createWalletClient> | null = null;
// Returns a viem wallet client using PRIVATE_KEY on Somnia testnet
export function getWalletClient() {
  if (_wallet) return _wallet;
  _wallet = createWalletClient({
    account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
    chain: somniaTestnet,
    transport: http(RPC_HTTP),
  });
  return _wallet;
}

// Returns the EOA address derived from PRIVATE_KEY (onchain "sender" for writes)
export const publisherAddress = () => getWalletClient().account!.address;
