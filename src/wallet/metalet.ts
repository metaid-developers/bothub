import { normalizeGlobalMetaidResponse } from './normalizeGlobalMetaid'
import type { EcdhResult, GlobalMetaidResult, MetaletWalletApi, TransferTask } from './types'

export { normalizeGlobalMetaidResponse } from './normalizeGlobalMetaid'

export const METALET_COMMON_ECDH_WAIT_TIMEOUT_MS = 5_000
export const METALET_ECDH_RESPONSE_TIMEOUT_MS = 10_000

const METALET_COMMON_ECDH_POLL_INTERVAL_MS = 50

export class MetaletNotInstalledError extends Error {
  constructor() {
    super('Metalet wallet extension is not installed')
    this.name = 'MetaletNotInstalledError'
  }
}

export class MetaletEcdhUnavailableError extends Error {
  constructor(message = 'Metalet ECDH API is unavailable') {
    super(message)
    this.name = 'MetaletEcdhUnavailableError'
  }
}

export class MetaletEcdhTimeoutError extends Error {
  constructor(message = 'Metalet ECDH request timed out') {
    super(message)
    this.name = 'MetaletEcdhTimeoutError'
  }
}

function getWallet(): MetaletWalletApi {
  if (typeof window === 'undefined' || !window.metaidwallet) {
    throw new MetaletNotInstalledError()
  }
  return window.metaidwallet
}

type MetaletEcdh = (params: { externalPubKey: string; path?: string }) => Promise<EcdhResult>

function resolveCommonEcdh(wallet: MetaletWalletApi): MetaletEcdh | null {
  const common = wallet.common
  return typeof common?.ecdh === 'function' ? (params) => common.ecdh!(params) : null
}

function resolveTopLevelEcdh(wallet: MetaletWalletApi): MetaletEcdh | null {
  if (typeof wallet.ecdh !== 'function') return null
  if (wallet.ecdh === wallet.common?.ecdh) return null
  return (params) => wallet.ecdh!(params)
}

function waitForCommonEcdh(
  wallet: MetaletWalletApi,
  timeoutMs = METALET_COMMON_ECDH_WAIT_TIMEOUT_MS,
): Promise<MetaletEcdh> {
  const immediate = resolveCommonEcdh(wallet)
  if (immediate) return Promise.resolve(immediate)

  return new Promise((resolve, reject) => {
    let settled = false
    function finish(ecdh?: MetaletEcdh, err?: Error) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(interval)
      if (ecdh) {
        resolve(ecdh)
      } else {
        reject(err ?? new MetaletEcdhUnavailableError())
      }
    }

    const timeout = setTimeout(() => {
      finish(undefined, new MetaletEcdhUnavailableError('Metalet common.ecdh API is unavailable'))
    }, timeoutMs)

    const interval = setInterval(() => {
      const ecdh = resolveCommonEcdh(wallet)
      if (ecdh) finish(ecdh)
    }, METALET_COMMON_ECDH_POLL_INTERVAL_MS)
  })
}

function withMetaletEcdhTimeout<T>(
  promise: Promise<T>,
  timeoutMs = METALET_ECDH_RESPONSE_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new MetaletEcdhTimeoutError('Metalet ECDH request timed out'))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function invokeMetaletEcdh(ecdh: MetaletEcdh, params: Parameters<MetaletEcdh>[0]): Promise<EcdhResult> {
  return withMetaletEcdhTimeout(Promise.resolve().then(() => ecdh(params)))
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
  return normalizeGlobalMetaidResponse(res)
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
  const wallet = getWallet()
  let commonEcdh: MetaletEcdh

  try {
    commonEcdh = await waitForCommonEcdh(wallet)
  } catch (err) {
    const topLevelEcdh = resolveTopLevelEcdh(wallet)
    if (topLevelEcdh) return invokeMetaletEcdh(topLevelEcdh, params)
    throw new MetaletEcdhUnavailableError(
      err instanceof Error && err.message ? err.message : undefined,
    )
  }

  try {
    return await invokeMetaletEcdh(commonEcdh, params)
  } catch (err) {
    if (!(err instanceof MetaletEcdhTimeoutError)) throw err

    const topLevelEcdh = resolveTopLevelEcdh(wallet)
    if (topLevelEcdh) return invokeMetaletEcdh(topLevelEcdh, params)
    throw new MetaletEcdhTimeoutError(
      'Metalet common.ecdh request timed out and top-level wallet.ecdh API is unavailable',
    )
  }
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
