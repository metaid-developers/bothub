import { normalizeGlobalMetaidResponse } from './normalizeGlobalMetaid'
import type { EcdhResult, GlobalMetaidResult, MetaletWalletApi, TransferTask } from './types'

export { normalizeGlobalMetaidResponse } from './normalizeGlobalMetaid'

export const METALET_COMMON_ECDH_WAIT_TIMEOUT_MS = 5_000
export const METALET_QUERY_RESPONSE_TIMEOUT_MS = 5_000
export const METALET_AUTHORIZE_RESPONSE_TIMEOUT_MS = 120_000
export const METALET_ECDH_RESPONSE_TIMEOUT_MS = METALET_AUTHORIZE_RESPONSE_TIMEOUT_MS
export const METALET_INSTALL_WAIT_TIMEOUT_MS = 2_000

const METALET_COMMON_ECDH_POLL_INTERVAL_MS = 50
const METALET_INSTALL_POLL_INTERVAL_MS = 100

function authorizeTimeoutMessage(action: string): string {
  return `Confirm the ${action} request in Metalet, or retry from Bothub if the Metalet window closed.`
}

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
  constructor(message = authorizeTimeoutMessage('ECDH')) {
    super(message)
    this.name = 'MetaletEcdhTimeoutError'
  }
}

export class MetaletAuthorizeTimeoutError extends Error {
  constructor(action: string) {
    super(authorizeTimeoutMessage(action))
    this.name = 'MetaletAuthorizeTimeoutError'
  }
}

export class MetaletResponseTimeoutError extends Error {
  constructor(action: string) {
    super(
      `Metalet wallet did not respond to ${action}. Reload or unlock Metalet, reconnect it to this site, and try again.`,
    )
    this.name = 'MetaletResponseTimeoutError'
  }
}

function getWallet(): MetaletWalletApi {
  if (typeof window === 'undefined' || !window.metaidwallet) {
    throw new MetaletNotInstalledError()
  }
  return window.metaidwallet
}

function metaletStatusMessage(status: string): string {
  switch (status) {
    case 'locked':
      return 'Metalet wallet is locked. Unlock Metalet and try again.'
    case 'not-connected':
      return 'Metalet wallet is not connected to this site. Connect Metalet and try again.'
    case 'not-logged-in':
      return 'Metalet wallet is not logged in. Open Metalet and sign in.'
    case 'no-wallets':
      return 'Metalet wallet has no wallet set up.'
    case 'canceled':
      return 'Metalet request was canceled.'
    default:
      return `Metalet wallet returned status: ${status}`
  }
}

function assertNoMetaletStatus(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const status = (value as { status?: unknown }).status
  if (typeof status === 'string' && status.trim()) {
    throw new Error(metaletStatusMessage(status.trim()))
  }
  const error = (value as { error?: unknown }).error
  if (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
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
      reject(new MetaletEcdhTimeoutError())
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

function withMetaletAuthorizeTimeout<T>(
  promise: Promise<T>,
  action: string,
  timeoutMs = METALET_AUTHORIZE_RESPONSE_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new MetaletAuthorizeTimeoutError(action))
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

function withMetaletResponseTimeout<T>(
  promise: Promise<T>,
  action: string,
  timeoutMs = METALET_QUERY_RESPONSE_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new MetaletResponseTimeoutError(action))
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
  return withMetaletEcdhTimeout(Promise.resolve().then(() => ecdh(params))).then((result) => {
    assertNoMetaletStatus(result)
    if (!result.sharedSecret?.trim()) {
      throw new Error('Metalet ECDH response did not include a shared secret')
    }
    return result
  })
}

export function isMetaletInstalled(): boolean {
  return typeof window !== 'undefined' && Boolean(window.metaidwallet)
}

export function waitForMetaletInstalled(
  timeoutMs = METALET_INSTALL_WAIT_TIMEOUT_MS,
): Promise<boolean> {
  if (isMetaletInstalled()) return Promise.resolve(true)
  if (typeof window === 'undefined') return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false

    const finish = (installed: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(interval)
      resolve(installed)
    }

    const interval = setInterval(() => {
      if (isMetaletInstalled()) {
        finish(true)
      }
    }, METALET_INSTALL_POLL_INTERVAL_MS)

    const timeout = setTimeout(() => {
      finish(isMetaletInstalled())
    }, timeoutMs)
  })
}

export async function connect(): Promise<unknown> {
  const res = await withMetaletAuthorizeTimeout(
    Promise.resolve().then(() => getWallet().connect()),
    'connect',
  )
  assertNoMetaletStatus(res)
  return res
}

export async function disconnect(): Promise<unknown> {
  return getWallet().disconnect()
}

export async function getGlobalMetaid(): Promise<GlobalMetaidResult> {
  const res = await withMetaletResponseTimeout(getWallet().getGlobalMetaid(), 'getGlobalMetaid')
  assertNoMetaletStatus(res)
  return normalizeGlobalMetaidResponse(res)
}

export async function ensureReady(expectedGlobalMetaId?: string): Promise<GlobalMetaidResult> {
  const wallet = getWallet()
  if (typeof wallet.ping === 'function') {
    const pingResult = await withMetaletResponseTimeout(wallet.ping(), 'ping')
    assertNoMetaletStatus(pingResult)
  }
  if (typeof wallet.isConnected === 'function') {
    const connectedResult = await withMetaletResponseTimeout(wallet.isConnected(), 'isConnected')
    assertNoMetaletStatus(connectedResult)
    if (
      connectedResult &&
      typeof connectedResult === 'object' &&
      (connectedResult as { connected?: unknown }).connected === false
    ) {
      throw new Error('Metalet wallet is not connected to this site. Connect Metalet and try again.')
    }
  }

  const identity = await getGlobalMetaid()
  const expected = expectedGlobalMetaId?.trim()
  if (expected && identity.globalMetaId.trim() !== expected) {
    throw new Error('Connected Metalet account changed. Reconnect your wallet before sending a request.')
  }
  return identity
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
    throw new MetaletEcdhTimeoutError()
  }
}

export async function eciesEncrypt(params: { message: string }): Promise<{ encrypted: string }> {
  return getWallet().eciesEncrypt(params)
}

export async function eciesDecrypt(params: { encrypted: string }): Promise<{ message: string }> {
  return getWallet().eciesDecrypt(params)
}

export function on(eventName: string, handler: (...args: unknown[]) => void): void {
  const wallet = getWallet()
  if (typeof wallet.on === 'function') {
    wallet.on(eventName, handler)
  }
}

export function removeListener(eventName: string, handler?: (...args: unknown[]) => void): void {
  const wallet = getWallet()
  if (typeof wallet.removeListener === 'function') {
    wallet.removeListener(eventName, handler)
  }
}
