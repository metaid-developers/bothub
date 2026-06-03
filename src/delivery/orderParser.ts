import {
  ORDER_METADATA_ORDER_ID_RE,
  ORDER_METADATA_ORDER_PIN_ID_RE,
  ORDER_METADATA_OUTPUT_TYPE_RE,
  ORDER_METADATA_SERVICE_ID_RE,
  ORDER_METADATA_SKILL_NAME_RE,
  ORDER_METADATA_TXID_RE,
  ORDER_PREFIX_RE,
  ORDER_PRICE_LINE_RE,
  extractMetadataLine,
  extractOrderDisplaySummary,
  extractOrderRawRequest,
} from '@/order/orderMessage'

export interface ParsedOrderMessage {
  displaySummary: string
  rawRequest: string
  price: string
  currency: string
  paymentTxid: string
  orderReference: string
  orderPinId: string
  serviceId: string
  skillName: string
  serviceName: string
  outputType: string
}

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function isOrderMessage(plaintext: string): boolean {
  const firstLine = String(plaintext || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')[0] ?? ''
  return ORDER_PREFIX_RE.test(firstLine)
}

export function parseOrderMessage(plaintext: string): ParsedOrderMessage | null {
  if (!isOrderMessage(plaintext)) return null

  const source = String(plaintext || '').replace(/\r\n?/g, '\n')
  const priceMatch = source.match(ORDER_PRICE_LINE_RE)
  const paymentTxid = extractMetadataLine(source, ORDER_METADATA_TXID_RE)
  const orderReference = extractMetadataLine(source, ORDER_METADATA_ORDER_ID_RE)
  const orderPinId = extractMetadataLine(source, ORDER_METADATA_ORDER_PIN_ID_RE)
  const serviceId = extractMetadataLine(source, ORDER_METADATA_SERVICE_ID_RE)
  const skillName = extractMetadataLine(source, ORDER_METADATA_SKILL_NAME_RE)
  const outputType = extractMetadataLine(source, ORDER_METADATA_OUTPUT_TYPE_RE)
  const displaySummary = extractOrderDisplaySummary(source)
  const rawRequest = extractOrderRawRequest(source)

  return {
    displaySummary,
    rawRequest,
    price: priceMatch?.[1] ? normalizeSingleLine(priceMatch[1]) : '',
    currency: priceMatch?.[2] ? normalizeSingleLine(priceMatch[2]) : '',
    paymentTxid,
    orderReference,
    orderPinId,
    serviceId,
    skillName,
    serviceName: skillName || displaySummary,
    outputType,
  }
}

export function getOrderCorrelationId(order: ParsedOrderMessage): string {
  return order.orderPinId || order.paymentTxid || order.orderReference
}

export function findCorrelationInText(
  plaintext: string,
  knownCorrelationIds: ReadonlySet<string>,
): string {
  if (!knownCorrelationIds.size) return ''
  const haystack = String(plaintext || '')
  for (const id of knownCorrelationIds) {
    if (id && haystack.includes(id)) return id
  }
  return ''
}
