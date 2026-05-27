import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import type { TransferTask, WalletIdentity } from '@/wallet/types'
import { buildOrderPayload } from './buildOrderPayload'
import { ecdhEncryptWithSharedSecret } from './privateChatCrypto'
import { ORDER_RAW_REQUEST_MAX_CHARS, validateOrderRawRequest } from './orderMessage'

const SATOSHI_PER_UNIT = 100_000_000

export class PayAndRequestError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_prompt' | 'missing_provider_key' | 'payment_failed' | 'broadcast_failed',
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

export interface ExecutePayAndRequestResult {
  paymentTxid: string
  orderReference: string
  orderPinId: string
  sessionKey: string
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

function buildPrivateMessagePayload(toGlobalMetaId: string, encryptedContent: string): string {
  return JSON.stringify({
    to: toGlobalMetaId,
    timestamp: Math.floor(Date.now() / 1000),
    content: encryptedContent,
    contentType: 'text/plain',
    encrypt: 'ecdh',
    replyPin: '',
  })
}

function extractTransferTxids(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const txids = (result as { txids?: unknown }).txids
  if (!Array.isArray(txids)) return []
  return txids.map((id) => String(id).trim()).filter(Boolean)
}

function resolvePrimaryPinId(result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const direct = (result as { pinId?: unknown }).pinId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const txids = extractTransferTxids(result)
  return txids[0] ?? ''
}

async function executeServicePayment(
  service: SkillServiceCore,
  metalet: PayAndRequestMetalet,
): Promise<{ paymentTxid: string; paymentCommitTxid: string; orderReference: string }> {
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
    const transferResult = await metalet.transfer({
      tasks: [
        {
          genesis: service.mrc20Id.trim(),
          codehash: '',
          receivers: [{ address: service.paymentAddress.trim(), amount: service.price.trim() }],
        },
      ],
    })
    const txids = extractTransferTxids(transferResult)
    const paymentTxid = txids[txids.length - 1] ?? ''
    const paymentCommitTxid = txids.length > 1 ? txids[0] : ''
    if (!paymentTxid) {
      throw new PayAndRequestError('MRC20 payment did not return a transaction id', 'payment_failed')
    }
    return { paymentTxid, paymentCommitTxid, orderReference: '' }
  }

  const transferResult = await metalet.transfer({
    tasks: [
      {
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

function resolveCreatePinChain(service: SkillServiceCore): 'btc' | 'mvc' | 'doge' {
  const chain = service.paymentChain.trim().toLowerCase()
  if (chain === 'btc' || chain === 'doge' || chain === 'mvc') return chain
  if (service.settlementKind === 'mrc20') return 'btc'
  const currency = service.currency.trim().toUpperCase()
  if (currency === 'BTC') return 'btc'
  if (currency === 'DOGE') return 'doge'
  return 'mvc'
}

export async function executePayAndRequest(
  input: ExecutePayAndRequestInput,
): Promise<ExecutePayAndRequestResult> {
  const validation = validateOrderRawRequest(input.prompt, ORDER_RAW_REQUEST_MAX_CHARS)
  if (!validation.ok) {
    const reason =
      validation.reason === 'too_long'
        ? `Prompt must be at most ${validation.maxChars} characters`
        : 'Prompt is required'
    throw new PayAndRequestError(reason, 'invalid_prompt')
  }

  const chatPubkey = input.provider.chatPubkey?.trim() ?? ''
  if (!chatPubkey) {
    throw new PayAndRequestError('Provider chat public key is not available', 'missing_provider_key')
  }

  const providerGmid = input.provider.globalMetaId.trim()
  if (!providerGmid) {
    throw new PayAndRequestError('Provider global meta id is missing', 'missing_provider_key')
  }

  const { paymentTxid, paymentCommitTxid, orderReference } = await executeServicePayment(
    input.service,
    input.metalet,
  )

  const displaySummary =
    validation.rawRequest
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? input.service.displayName

  const orderPayload = buildOrderPayload({
    displayText: displaySummary,
    rawRequest: validation.rawRequest,
    price: input.service.price,
    currency: resolveProtocolCurrency(input.service),
    paymentTxid: isFreeServicePrice(input.service.price) ? '' : paymentTxid,
    paymentCommitTxid: paymentCommitTxid || undefined,
    orderReference: isFreeServicePrice(input.service.price) ? orderReference : '',
    paymentChain: input.service.paymentChain,
    settlementKind: input.service.settlementKind,
    mrc20Ticker: input.service.mrc20Ticker ?? undefined,
    mrc20Id: input.service.mrc20Id ?? undefined,
    serviceId: input.service.id,
    skillName: input.service.providerSkill || input.service.serviceName,
    serviceName: input.service.serviceName,
    outputType: input.service.outputType,
  })

  const { sharedSecret } = await input.metalet.ecdh({ externalPubKey: chatPubkey })
  const encrypted = ecdhEncryptWithSharedSecret(orderPayload, sharedSecret)
  const simplemsgBody = buildPrivateMessagePayload(providerGmid, encrypted)

  const pinResult = await input.metalet.createPin({
    chain: resolveCreatePinChain(input.service),
    dataList: [
      {
        metaidData: {
          operation: 'create',
          path: '/private/chat/simplemsg',
          body: simplemsgBody,
          contentType: 'application/json',
          encryption: '0',
          version: '1.0.0',
        },
      },
    ],
  })

  const orderPinId = resolvePrimaryPinId(pinResult)
  if (!orderPinId) {
    throw new PayAndRequestError('Order pin broadcast did not return an id', 'broadcast_failed')
  }

  const sessionTxid = paymentTxid || orderReference
  return {
    paymentTxid,
    orderReference,
    orderPinId,
    sessionKey: `${providerGmid}:${sessionTxid}`,
  }
}

export function buildDeliverySessionPath(sessionKey: string): string {
  return `/delivery?session=${encodeURIComponent(sessionKey)}`
}
