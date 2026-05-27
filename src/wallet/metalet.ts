import type { EcdhResult, GlobalMetaidResult, MetaletWalletApi, TransferTask } from './types'

export class MetaletNotInstalledError extends Error {
  constructor() {
    super('Metalet wallet extension is not installed')
    this.name = 'MetaletNotInstalledError'
  }
}

function getWallet(): MetaletWalletApi {
  if (typeof window === 'undefined' || !window.metaidwallet) {
    throw new MetaletNotInstalledError()
  }
  return window.metaidwallet
}

export function isMetaletInstalled(): boolean {
  return typeof window !== 'undefined' && Boolean(window.metaidwallet)
}

export async function connect(): Promise<unknown> {
  return getWallet().connect()
}

export async function disconnect(): Promise<unknown> {
  return getWallet().disconnect()
}

export async function getGlobalMetaid(): Promise<GlobalMetaidResult> {
  const res = await getWallet().getGlobalMetaid()
  return {
    globalMetaId: res.globalMetaId,
    mvcAddress: res.mvcAddress,
    btcAddress: res.btcAddress,
    dogeAddress: res.dogeAddress,
  }
}

export async function getBalance(params?: { path?: string }): Promise<unknown> {
  return getWallet().getBalance(params)
}

export async function transfer(params: { tasks: TransferTask[] }): Promise<unknown> {
  return getWallet().transfer(params)
}

export async function createPin(params: Record<string, unknown>): Promise<unknown> {
  return getWallet().createPin(params)
}

export async function ecdh(params: {
  externalPubKey: string
  path?: string
}): Promise<EcdhResult> {
  return getWallet().ecdh(params)
}

export async function eciesEncrypt(params: { message: string }): Promise<{ encrypted: string }> {
  return getWallet().eciesEncrypt(params)
}

export async function eciesDecrypt(params: { encrypted: string }): Promise<{ message: string }> {
  return getWallet().eciesDecrypt(params)
}

export function on(eventName: string, handler: (...args: unknown[]) => void): void {
  getWallet().on(eventName, handler)
}

export function removeListener(eventName: string): void {
  getWallet().removeListener(eventName)
}
