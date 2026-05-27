export const ORDER_PREFIX = '[ORDER]'
export const ORDER_RAW_REQUEST_OPEN_TAG = '<raw_request>'
export const ORDER_RAW_REQUEST_CLOSE_TAG = '</raw_request>'
export const ORDER_RAW_REQUEST_MAX_CHARS = 4000

export const ORDER_PREFIX_RE = /^\s*\[ORDER\]\s*/i
export const RAW_REQUEST_BLOCK_RE =
  /<raw_request>\s*\n?([\s\S]*?)\n?\s*<\/raw_request>/i
export const ORDER_METADATA_TXID_RE = /^txid:\s*(.+)$/im
export const ORDER_METADATA_ORDER_ID_RE = /^order id:\s*(.+)$/im
export const ORDER_METADATA_SERVICE_ID_RE = /^service id:\s*(.+)$/im
export const ORDER_METADATA_SKILL_NAME_RE = /^skill name:\s*(.+)$/im
export const ORDER_METADATA_OUTPUT_TYPE_RE = /^output type:\s*(.+)$/im
export const ORDER_PRICE_LINE_RE = /^支付金额\s+(\S+)\s+(\S+)\s*$/im

function normalizeMultilineText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''
}

function normalizeSingleLineText(value: unknown): string {
  return normalizeMultilineText(value).replace(/\s+/g, ' ').trim()
}

function normalizePaymentChain(value: unknown): string {
  const normalized = normalizeSingleLineText(value).toLowerCase()
  if (normalized === 'btc' || normalized === 'doge' || normalized === 'mvc') return normalized
  return ''
}

function normalizeSettlementKind(value: unknown): string {
  const normalized = normalizeSingleLineText(value).toLowerCase()
  if (normalized === 'mrc20') return 'mrc20'
  if (normalized === 'native') return 'native'
  return ''
}

function normalizeMrc20Ticker(value: unknown): string {
  const normalized = normalizeSingleLineText(value).toUpperCase()
  return normalized.replace(/[^A-Z0-9]/g, '')
}

function normalizeOutputType(value: unknown): string {
  const normalized = normalizeSingleLineText(value).toLowerCase()
  if (
    normalized === 'image' ||
    normalized === 'video' ||
    normalized === 'audio' ||
    normalized === 'other' ||
    normalized === 'text'
  ) {
    return normalized
  }
  return ''
}

function isZeroAmount(value: unknown): boolean {
  const raw = normalizeSingleLineText(value)
  if (!raw) return false
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric === 0
}

function resolveOrderSettlementMetadata(input: BuildOrderPayloadInput | undefined) {
  const normalizedCurrency = normalizeSingleLineText(input?.currency).toUpperCase()
  const currencyMrc20Match = normalizedCurrency.match(/^([A-Z0-9]+)-MRC20$/)
  const explicitSettlementKind = normalizeSettlementKind(input?.settlementKind)
  const settlementKind = explicitSettlementKind || (currencyMrc20Match ? 'mrc20' : 'native')

  let paymentChain = normalizePaymentChain(input?.paymentChain)
  if (!paymentChain) {
    if (settlementKind === 'mrc20') {
      paymentChain = 'btc'
    } else if (normalizedCurrency === 'BTC') {
      paymentChain = 'btc'
    } else if (normalizedCurrency === 'DOGE') {
      paymentChain = 'doge'
    } else if (normalizedCurrency) {
      paymentChain = 'mvc'
    }
  }

  const tickerFromCurrency = currencyMrc20Match?.[1] || ''
  const mrc20Ticker =
    settlementKind === 'mrc20'
      ? normalizeMrc20Ticker(input?.mrc20Ticker) || normalizeMrc20Ticker(tickerFromCurrency)
      : ''
  const mrc20Id = settlementKind === 'mrc20' ? normalizeSingleLineText(input?.mrc20Id) : ''
  const paymentCommitTxid = normalizeSingleLineText(input?.paymentCommitTxid)

  return {
    paymentChain,
    settlementKind,
    mrc20Ticker,
    mrc20Id,
    paymentCommitTxid,
  }
}

function getFallbackDisplaySummary(rawRequest: string): string {
  const normalized = normalizeMultilineText(rawRequest)
  if (!normalized) return ''
  const firstLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return firstLine || normalized
}

export interface BuildOrderPayloadInput {
  displayText?: string
  rawRequest?: string
  price?: string
  currency?: string
  paymentTxid?: string
  paymentCommitTxid?: string
  orderReference?: string
  paymentChain?: string
  settlementKind?: string
  mrc20Ticker?: string
  mrc20Id?: string
  serviceId?: string
  skillName?: string
  serviceName?: string
  outputType?: string
}

export function normalizeOrderRawRequest(value: unknown): string {
  return normalizeMultilineText(value)
}

export function extractOrderRawRequest(plaintext: string): string {
  const source = String(plaintext || '').replace(/\r\n?/g, '\n')
  const match = source.match(RAW_REQUEST_BLOCK_RE)
  return match?.[1] ? match[1].trim() : ''
}

export function extractMetadataLine(plaintext: string, pattern: RegExp): string {
  const source = String(plaintext || '').replace(/\r\n?/g, '\n')
  const match = source.match(pattern)
  return match?.[1] ? match[1].trim() : ''
}

export function extractOrderDisplaySummary(plaintext: string): string {
  const source = String(plaintext || '').replace(/\r\n?/g, '\n')
  const firstLine = source.split('\n')[0] || ''
  return firstLine.replace(ORDER_PREFIX_RE, '').trim()
}

export function validateOrderRawRequest(value: unknown, maxChars = ORDER_RAW_REQUEST_MAX_CHARS) {
  const rawRequest = normalizeOrderRawRequest(value)
  if (!rawRequest) {
    return {
      ok: false as const,
      reason: 'required' as const,
      rawRequest,
      maxChars,
    }
  }
  if (rawRequest.length > maxChars) {
    return {
      ok: false as const,
      reason: 'too_long' as const,
      rawRequest,
      maxChars,
    }
  }
  return {
    ok: true as const,
    rawRequest,
    maxChars,
  }
}

export function buildOrderRawRequestBlock(rawRequest: string): string {
  const normalized = normalizeOrderRawRequest(rawRequest)
  return `${ORDER_RAW_REQUEST_OPEN_TAG}\n${normalized}\n${ORDER_RAW_REQUEST_CLOSE_TAG}`
}

export function buildOrderPayload(input: BuildOrderPayloadInput | undefined): string {
  const rawRequest = normalizeOrderRawRequest(input?.rawRequest)
  const displaySummary =
    normalizeSingleLineText(input?.displayText) ||
    getFallbackDisplaySummary(rawRequest) ||
    normalizeSingleLineText(input?.serviceName) ||
    normalizeSingleLineText(input?.skillName) ||
    'Service Order'
  const effectiveRawRequest =
    rawRequest ||
    getFallbackDisplaySummary(displaySummary) ||
    normalizeSingleLineText(input?.serviceName) ||
    normalizeSingleLineText(input?.skillName) ||
    'Service Order'
  const paymentTxid = normalizeSingleLineText(input?.paymentTxid)
  const orderReference = normalizeSingleLineText(input?.orderReference)
  const settlement = resolveOrderSettlementMetadata(input)
  const omitPaymentSettlementMetadata = !paymentTxid && orderReference && isZeroAmount(input?.price)

  const metadataLines = [
    `支付金额 ${String(input?.price || '').trim()} ${String(input?.currency || '').trim()}`,
  ]
  if (paymentTxid) {
    metadataLines.push(`txid: ${paymentTxid}`)
  } else if (orderReference) {
    metadataLines.push(`order id: ${orderReference}`)
  }
  if (!omitPaymentSettlementMetadata && settlement.paymentChain) {
    metadataLines.push(`payment chain: ${settlement.paymentChain}`)
  }
  if (!omitPaymentSettlementMetadata && settlement.settlementKind) {
    metadataLines.push(`settlement kind: ${settlement.settlementKind}`)
  }
  if (!omitPaymentSettlementMetadata && settlement.mrc20Ticker) {
    metadataLines.push(`mrc20 ticker: ${settlement.mrc20Ticker}`)
  }
  if (!omitPaymentSettlementMetadata && settlement.mrc20Id) {
    metadataLines.push(`mrc20 id: ${settlement.mrc20Id}`)
  }
  if (!omitPaymentSettlementMetadata && settlement.paymentCommitTxid) {
    metadataLines.push(`commit txid: ${settlement.paymentCommitTxid}`)
  }
  metadataLines.push(
    `service id: ${String(input?.serviceId || '').trim()}`,
    `skill name: ${String(input?.skillName || '').trim()}`,
  )
  const outputType = normalizeOutputType(input?.outputType)
  if (outputType) {
    metadataLines.push(`output type: ${outputType}`)
  }

  return [
    `${ORDER_PREFIX} ${displaySummary}`,
    buildOrderRawRequestBlock(effectiveRawRequest),
    ...metadataLines,
  ].join('\n')
}
