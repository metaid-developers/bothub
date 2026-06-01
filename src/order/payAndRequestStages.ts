import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import type { TransferTask, WalletIdentity } from '@/wallet/types'
import { buildOrderPayload } from './buildOrderPayload'
import {
  buildCreatePinDiagnostic,
  recordCreatePinDiagnostic,
  type CreatePinDiagnosticContext,
  type CreatePinDiagnosticPhase,
} from './createPinDiagnostics'
import { ORDER_RAW_REQUEST_MAX_CHARS, validateOrderRawRequest } from './orderMessage'
import {
  collectTxidLikeStrings,
  getResolvedCreatePinFailureMessage,
  isCreatePinTransportResponseLostError,
  resolvePrimaryPinId,
} from './pinResult'
import { ecdhEncryptWithSharedSecret } from './privateChatCrypto'
import {
  ECDH_WALLET_RESPONSE_TIMEOUT_MS,
  WalletResponseTimeoutError,
  withWalletResponseTimeout,
} from './walletTimeout'

const SATOSHI_PER_UNIT = 100_000_000
const SIMPLEMSG_PATH = '/protocols/simplemsg'

export class PayAndRequestError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_prompt'
      | 'missing_wallet'
      | 'missing_provider_key'
      | 'encryption_failed'
      | 'payment_failed'
      | 'broadcast_failed',
  ) {
    super(message)
    this.name = 'PayAndRequestError'
  }
}

export interface PayAndRequestMetalet {
  transfer: (params: { tasks: TransferTask[] }) => Promise<unknown>
  ecdh: (params: { externalPubKey: string; path?: string }) => Promise<{ sharedSecret: string }>
  createPin: (params: Record<string, unknown>) => Promise<unknown>
}

export interface ExecutePayAndRequestInput {
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  wallet: WalletIdentity
  metalet: PayAndRequestMetalet
}

export interface PayAndRequestPaymentResult {
  paymentTxid: string
  paymentCommitTxid: string
  orderReference: string
}

export interface PreparedPayAndRequest {
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  payment: PayAndRequestPaymentResult
  orderPayload: string
  encryptedContent: string
  simplemsgBody: string
  sessionKey: string
  displaySummary: string
}

export interface ExecutePayAndRequestResult extends PayAndRequestPaymentResult {
  orderPinId: string
  sessionKey: string
  orderPayload: string
  displaySummary: string
}

export class PayAndRequestBroadcastError extends PayAndRequestError {
  constructor(
    message: string,
    readonly partial: PreparedPayAndRequest,
    readonly cause?: unknown,
  ) {
    super(message, 'broadcast_failed')
    this.name = 'PayAndRequestBroadcastError'
  }
}

interface ValidatedPayAndRequestInput extends ExecutePayAndRequestInput {
  rawRequest: string
  displaySummary: string
  providerGlobalMetaId: string
  providerChatPubkey: string
}

export function generateRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isFreeServicePrice(price: string): boolean {
  const raw = price.trim()
  if (!raw) return false
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric === 0
}

export function validatePayAndRequestInput(
  input: ExecutePayAndRequestInput,
): ValidatedPayAndRequestInput {
  const validation = validateOrderRawRequest(input.prompt, ORDER_RAW_REQUEST_MAX_CHARS)
  if (!validation.ok) {
    const reason =
      validation.reason === 'too_long'
        ? `Prompt must be at most ${validation.maxChars} characters`
        : 'Prompt is required'
    throw new PayAndRequestError(reason, 'invalid_prompt')
  }

  if (!input.wallet.globalMetaId.trim()) {
    throw new PayAndRequestError(
      'Connect your Metalet wallet before sending a request.',
      'missing_wallet',
    )
  }

  const providerChatPubkey = input.provider.chatPubkey?.trim() ?? ''
  if (!providerChatPubkey) {
    throw new PayAndRequestError('Provider chat public key is not available', 'missing_provider_key')
  }

  const providerGlobalMetaId = input.provider.globalMetaId.trim()
  if (!providerGlobalMetaId) {
    throw new PayAndRequestError('Provider global meta id is missing', 'missing_provider_key')
  }

  const displaySummary =
    validation.rawRequest
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? input.service.displayName

  return {
    ...input,
    rawRequest: validation.rawRequest,
    displaySummary,
    providerGlobalMetaId,
    providerChatPubkey,
  }
}

function resolveProtocolCurrency(service: SkillServiceCore): string {
  const currency = service.currency.trim().toUpperCase()
  if (service.settlementKind === 'mrc20') {
    const ticker = (service.mrc20Ticker ?? '').trim().toUpperCase()
    if (ticker) return `${ticker}-MRC20`
    if (currency.endsWith('-MRC20')) return currency
    return 'MRC20'
  }
  if (currency === 'MVC' || currency === 'MICROVISIONCHAIN') return 'SPACE'
  return currency
}

function amountToAtomicString(price: string): string {
  const numeric = Number(price)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new PayAndRequestError('Invalid service price', 'payment_failed')
  }
  return String(Math.floor(numeric * SATOSHI_PER_UNIT))
}

function extractTransferTxids(result: unknown): string[] {
  return collectTxidLikeStrings(result)
}

export async function executeServicePayment(
  service: SkillServiceCore,
  metalet: PayAndRequestMetalet,
): Promise<PayAndRequestPaymentResult> {
  if (isFreeServicePrice(service.price)) {
    return {
      paymentTxid: '',
      paymentCommitTxid: '',
      orderReference: generateRandomHex(32),
    }
  }

  if (!service.paymentAddress.trim()) {
    throw new PayAndRequestError('Service payment address is missing', 'payment_failed')
  }

  if (service.settlementKind === 'mrc20') {
    if (!service.mrc20Id?.trim()) {
      throw new PayAndRequestError('MRC20 asset id is missing for this service', 'payment_failed')
    }
    throw new PayAndRequestError(
      'MRC20 checkout is not available in BotHub yet. Choose a native paid or free service.',
      'payment_failed',
    )
  }

  const transferResult = await metalet.transfer({
    tasks: [
      {
        chain: service.paymentChain.trim(),
        currency: service.currency.trim(),
        receivers: [
          {
            address: service.paymentAddress.trim(),
            amount: amountToAtomicString(service.price),
          },
        ],
      },
    ],
  })
  const txids = extractTransferTxids(transferResult)
  const paymentTxid = txids[txids.length - 1] ?? ''
  if (!paymentTxid) {
    throw new PayAndRequestError('Payment did not return a transaction id', 'payment_failed')
  }
  return { paymentTxid, paymentCommitTxid: '', orderReference: '' }
}

function buildPrivateMessagePayload(toGlobalMetaId: string, encryptedContent: string): string {
  return JSON.stringify({
    to: toGlobalMetaId,
    timestamp: Date.now(),
    content: encryptedContent,
    contentType: 'text/plain',
    encrypt: 'ecdh',
    replyPin: '',
  })
}

function resolvePreparedSessionKey(providerGlobalMetaId: string, payment: PayAndRequestPaymentResult): string {
  const correlationId = payment.paymentTxid || payment.orderReference
  return correlationId ? `${providerGlobalMetaId}:${correlationId}` : providerGlobalMetaId
}

export async function prepareEncryptedOrderMessage(
  input: ValidatedPayAndRequestInput,
  payment: PayAndRequestPaymentResult,
): Promise<PreparedPayAndRequest> {
  const orderPayload = buildOrderPayload({
    displayText: input.displaySummary,
    rawRequest: input.rawRequest,
    price: input.service.price,
    currency: resolveProtocolCurrency(input.service),
    paymentTxid: isFreeServicePrice(input.service.price) ? '' : payment.paymentTxid,
    paymentCommitTxid: payment.paymentCommitTxid || undefined,
    orderReference: isFreeServicePrice(input.service.price) ? payment.orderReference : '',
    paymentChain: input.service.paymentChain,
    settlementKind: input.service.settlementKind,
    mrc20Ticker: input.service.mrc20Ticker ?? undefined,
    mrc20Id: input.service.mrc20Id ?? undefined,
    serviceId: input.service.id,
    skillName: input.service.providerSkill || input.service.serviceName,
    serviceName: input.service.serviceName,
    outputType: input.service.outputType,
  })

  let sharedSecret: string
  try {
    const ecdhResult = await withWalletResponseTimeout(
      input.metalet.ecdh({ externalPubKey: input.providerChatPubkey }),
      'Order encryption timed out waiting for Metalet ECDH response',
      ECDH_WALLET_RESPONSE_TIMEOUT_MS,
    )
    sharedSecret = ecdhResult.sharedSecret
  } catch (err) {
    const message =
      err instanceof WalletResponseTimeoutError
        ? err.message
        : err instanceof Error && err.message
          ? `Order encryption failed: ${err.message}`
          : 'Order encryption failed'
    throw new PayAndRequestError(message, 'encryption_failed')
  }

  const encryptedContent = ecdhEncryptWithSharedSecret(orderPayload, sharedSecret)
  const simplemsgBody = buildPrivateMessagePayload(input.providerGlobalMetaId, encryptedContent)

  return {
    service: input.service,
    provider: input.provider,
    prompt: input.rawRequest,
    payment,
    orderPayload,
    encryptedContent,
    simplemsgBody,
    sessionKey: resolvePreparedSessionKey(input.providerGlobalMetaId, payment),
    displaySummary: input.displaySummary,
  }
}

function resolveCreatePinChain(service: SkillServiceCore): 'btc' | 'mvc' | 'doge' {
  const chain = service.paymentChain.trim().toLowerCase()
  if (chain === 'btc' || chain === 'doge' || chain === 'mvc') return chain
  if (service.settlementKind === 'mrc20') return 'btc'
  const currency = service.currency.trim().toUpperCase()
  if (currency === 'BTC') return 'btc'
  if (currency === 'DOGE') return 'doge'
  return 'mvc'
}

function buildCreatePinDiagnosticContext(
  prepared: PreparedPayAndRequest,
): CreatePinDiagnosticContext {
  return {
    service: {
      id: prepared.service.id,
      serviceName: prepared.service.serviceName,
      displayName: prepared.service.displayName,
      providerSkill: prepared.service.providerSkill,
    },
    provider: {
      globalMetaId: prepared.provider.globalMetaId,
      name: prepared.provider.name,
    },
    payment: {
      paymentTxid: prepared.payment.paymentTxid,
      orderReference: prepared.payment.orderReference,
    },
    sessionKey: prepared.sessionKey,
  }
}

function recordCreatePinAttempt(input: {
  phase: CreatePinDiagnosticPhase
  prepared: PreparedPayAndRequest
  result?: unknown
  error?: unknown
  resolvedPinId?: string
  failureMessage?: string
}): void {
  recordCreatePinDiagnostic(
    buildCreatePinDiagnostic({
      phase: input.phase,
      context: buildCreatePinDiagnosticContext(input.prepared),
      result: input.result,
      error: input.error,
      resolvedPinId: input.resolvedPinId,
      failureMessage: input.failureMessage,
    }),
  )
}

export async function broadcastPreparedOrder(
  prepared: PreparedPayAndRequest,
  metalet: Pick<PayAndRequestMetalet, 'createPin'>,
): Promise<string> {
  let pinResult: unknown
  try {
    pinResult = await withWalletResponseTimeout(
      metalet.createPin({
        chain: resolveCreatePinChain(prepared.service),
        dataList: [
          {
            metaidData: {
              operation: 'create',
              path: SIMPLEMSG_PATH,
              body: prepared.simplemsgBody,
              contentType: 'application/json',
              encryption: '0',
              version: '1.0.0',
            },
          },
        ],
      }),
      'Order pin broadcast timed out waiting for wallet response',
    )
  } catch (err) {
    if (isCreatePinTransportResponseLostError(err)) {
      recordCreatePinAttempt({
        phase: 'response_lost',
        prepared,
        error: err,
      })
      return ''
    }
    recordCreatePinAttempt({
      phase: 'rejected',
      prepared,
      error: err,
    })
    const message =
      err instanceof WalletResponseTimeoutError ? err.message : 'Order pin broadcast failed'
    throw new PayAndRequestBroadcastError(message, prepared, err)
  }

  const orderPinId = resolvePrimaryPinId(pinResult)
  const failure = getResolvedCreatePinFailureMessage(pinResult)
  recordCreatePinAttempt({
    phase: orderPinId ? 'success_pin' : failure ? 'failure_envelope' : 'indeterminate_success',
    prepared,
    result: pinResult,
    resolvedPinId: orderPinId,
    failureMessage: failure,
  })
  if (orderPinId) return orderPinId

  if (failure) {
    throw new PayAndRequestBroadcastError(
      `Order pin broadcast failed: ${failure}`,
      prepared,
      pinResult,
    )
  }
  return ''
}

export async function executePayAndRequest(
  input: ExecutePayAndRequestInput,
): Promise<ExecutePayAndRequestResult> {
  const validated = validatePayAndRequestInput(input)
  const payment = await executeServicePayment(validated.service, validated.metalet)
  const prepared = await prepareEncryptedOrderMessage(validated, payment)
  const orderPinId = await broadcastPreparedOrder(prepared, validated.metalet)
  const sessionKey =
    prepared.sessionKey === validated.providerGlobalMetaId && orderPinId
      ? `${validated.providerGlobalMetaId}:${orderPinId}`
      : prepared.sessionKey

  return {
    ...payment,
    orderPinId,
    sessionKey,
    orderPayload: prepared.orderPayload,
    displaySummary: prepared.displaySummary,
  }
}
