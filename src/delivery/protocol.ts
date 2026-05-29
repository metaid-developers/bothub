export type DeliveryProtocolKind =
  | 'plain'
  | 'order_status'
  | 'delivery'
  | 'order_end'
  | 'needs_rating'

export interface ParsedDeliveryProtocol {
  kind: DeliveryProtocolKind
  orderCorrelationId: string
  displayText: string
  rawText: string
  deliveryResult: string
  structuredPayload: Record<string, unknown> | null
}

interface ProtocolTag {
  kind: Exclude<DeliveryProtocolKind, 'plain'>
  orderCorrelationId: string
  rest: string
}

const PROTOCOL_TAG_RE =
  /^\[(ORDER_STATUS|DELIVERY|ORDER_END|NeedsRating)(?::([^\]\s]+))?(?:\s+[^\]]+)?\]\s*/i
const ORDER_PIN_LINE_RE =
  /^\s*order\s+pin\s+id\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._:-]{5,127})\s*$/im

function toKind(tag: string): Exclude<DeliveryProtocolKind, 'plain'> {
  const normalized = tag.toLowerCase()
  if (normalized === 'order_status') return 'order_status'
  if (normalized === 'order_end') return 'order_end'
  if (normalized === 'needsrating') return 'needs_rating'
  return 'delivery'
}

function parseProtocolTag(content: string): ProtocolTag | null {
  const match = content.trimStart().match(PROTOCOL_TAG_RE)
  if (!match) return null

  return {
    kind: toKind(match[1] ?? ''),
    orderCorrelationId: (match[2] ?? '').trim(),
    rest: stripOrderProtocolPinLine(content.trimStart().slice(match[0].length)),
  }
}

function stripOrderProtocolPinLine(content: string): string {
  return String(content || '')
    .split(/\r?\n/)
    .filter((line) => !ORDER_PIN_LINE_RE.test(line))
    .join('\n')
    .trim()
}

function parseStructuredPayload(value: string): Record<string, unknown> | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export function parseDeliveryProtocol(content: string): ParsedDeliveryProtocol {
  const rawText = String(content || '')
  const parsedTag = parseProtocolTag(rawText)

  if (!parsedTag) {
    return {
      kind: 'plain',
      orderCorrelationId: '',
      displayText: rawText.trim(),
      rawText,
      deliveryResult: '',
      structuredPayload: null,
    }
  }

  if (parsedTag.kind !== 'delivery') {
    return {
      kind: parsedTag.kind,
      orderCorrelationId: parsedTag.orderCorrelationId,
      displayText: parsedTag.rest,
      rawText,
      deliveryResult: '',
      structuredPayload: null,
    }
  }

  const structuredPayload = parseStructuredPayload(parsedTag.rest)
  const rawResult = structuredPayload?.result
  const hasStringResult = typeof rawResult === 'string'
  const deliveryResult = hasStringResult ? rawResult.trim() : ''

  return {
    kind: 'delivery',
    orderCorrelationId: parsedTag.orderCorrelationId,
    displayText: deliveryResult || parsedTag.rest,
    rawText,
    deliveryResult,
    structuredPayload: hasStringResult ? structuredPayload : null,
  }
}
