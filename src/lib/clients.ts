// src/lib/clients.ts
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from './chain'

let _pub: PublicClient | null = null
export function getPublicHttpClient(): PublicClient {
  if (_pub) return _pub
  _pub = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/'),
  }) as unknown as PublicClient
  return _pub
}

let _wallet: ReturnType<typeof createWalletClient> | null = null
export function getWalletClient() {
  if (_wallet) return _wallet
  _wallet = createWalletClient({
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/'),
  })
  return _wallet
}

export const publisherAddress = () => getWalletClient().account!.address
