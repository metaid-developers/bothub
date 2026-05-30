export interface WalletIdentity {
  globalMetaId: string
  mvcAddress: string
  btcAddress: string
  dogeAddress: string
  metaid?: string
  name?: string
  avatar?: string
  avatarUrl?: string
  chatPubkey?: string
  chatPublicKey?: string
  profileUpdatedAt?: string | number
}

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface GlobalMetaidResult {
  globalMetaId: string
  mvcAddress: string
  btcAddress: string
  dogeAddress: string
}

export interface TransferTask {
  chain?: string
  currency?: string
  genesis?: string
  codehash?: string
  receivers: Array<{ address: string; amount: string }>
}

export interface EcdhResult {
  sharedSecret: string
  externalPubKey?: string
  ecdhPubKey?: string
  creatorPubkey?: string
}

export interface MetaletWalletApi {
  common?: {
    ecdh?: (params: { externalPubKey: string; path?: string }) => Promise<EcdhResult>
  }
  connect: () => Promise<unknown>
  disconnect: () => Promise<unknown>
  getGlobalMetaid: () => Promise<GlobalMetaidResult>
  getBalance: (params?: { path?: string }) => Promise<unknown>
  transfer: (params: { tasks: TransferTask[] }) => Promise<unknown>
  createPin: (params: Record<string, unknown>) => Promise<unknown>
  ecdh: (params: { externalPubKey: string; path?: string }) => Promise<EcdhResult>
  eciesEncrypt: (params: { message: string }) => Promise<{ encrypted: string }>
  eciesDecrypt: (params: { encrypted: string }) => Promise<{ message: string }>
  on: (eventName: string, handler: (...args: unknown[]) => void) => void
  removeListener: (eventName: string) => void
  isConnected?: () => Promise<{ connected?: boolean }>
}

declare global {
  interface Window {
    metaidwallet?: MetaletWalletApi
  }
}

export {}
