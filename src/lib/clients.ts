// src/lib/clients.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

let _pub: PublicClient | null = null;

// Returns a viem public client (HTTP) configured for Somnia testnet
export function getPublicHttpClient(): PublicClient {
  if (_pub) return _pub;
  _pub = createPublicClient({
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network/"),
  }) as unknown as PublicClient;
  return _pub;
}

let _wallet: ReturnType<typeof createWalletClient> | null = null;

// Returns a viem wallet client using PRIVATE_KEY on Somnia testnet
export function getWalletClient() {
  if (_wallet) return _wallet;
  _wallet = createWalletClient({
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network/"),
  });
  return _wallet;
}

// Returns the EOA address derived from PRIVATE_KEY (onchain "sender" for writes)
export const publisherAddress = () => getWalletClient().account!.address;
