import type { DeliveryMessage } from '@/delivery/messageStore'
import { isOrderMessage, parseOrderMessage } from '@/delivery/orderParser'
import { parseDeliveryProtocol, type DeliveryProtocolKind } from '@/delivery/protocol'

export type MessageBubbleVariant =
  | 'text'
  | 'order'
  | 'status'
  | 'delivery'
  | 'completion'
  | 'rating_reserved'
  | 'system'

function protocolKindFromTag(
  protocolTag: string | null | undefined,
): DeliveryProtocolKind | null {
  const normalized = protocolTag?.trim().toLowerCase()
  if (!normalized || normalized === 'plain' || normalized === 'order') return null
  if (normalized === 'order_status') return 'order_status'
  if (normalized === 'delivery') return 'delivery'
  if (normalized === 'order_end') return 'order_end'
  if (normalized === 'needs_rating' || normalized === 'needsrating') {
    return 'needs_rating'
  }
  return null
}

function variantFromProtocolKind(
  kind: DeliveryProtocolKind,
): MessageBubbleVariant | null {
  if (kind === 'order_status') return 'status'
  if (kind === 'delivery') return 'delivery'
  if (kind === 'order_end') return 'completion'
  if (kind === 'needs_rating') return 'rating_reserved'
  return null
}

export function protocolKindForMessage(message: DeliveryMessage): DeliveryProtocolKind {
  return protocolKindFromTag(message.protocolTag) ?? parseDeliveryProtocol(message.content).kind
}

export function protocolDisplayTextForMessage(message: DeliveryMessage): string {
  const parsed = parseDeliveryProtocol(message.content)
  const kind = protocolKindForMessage(message)
  if (parsed.kind !== 'plain' && parsed.displayText) return parsed.displayText
  if (kind === 'delivery') return '已收到交付'
  if (kind === 'order_status') return '交付状态更新'
  if (kind === 'order_end') return '订单已完成'
  if (kind === 'needs_rating') return '评价待开放'
  return parsed.displayText
}

export function getMessageVariant(message: DeliveryMessage): MessageBubbleVariant {
  if (isOrderMessage(message.content)) {
    return 'order'
  }
  const protocolVariant = variantFromProtocolKind(protocolKindForMessage(message))
  if (protocolVariant) {
    return protocolVariant
  }
  if (message.decryptError) {
    return 'system'
  }
  return 'text'
}

export function sessionPreviewText(content: string, protocolTag?: string): string {
  const order = parseOrderMessage(content)
  if (order) {
    return truncatePreview(order.displaySummary || '请求')
  }

  const protocol = parseDeliveryProtocol(content)
  const protocolKind = protocolKindFromTag(protocolTag) ?? protocol.kind
  const protocolText = protocol.kind === 'plain' ? '' : protocol.displayText
  if (protocolKind === 'delivery') {
    return truncatePreview(protocolText || '已收到交付')
  }
  if (protocolKind === 'order_status') {
    return truncatePreview(protocolText || '交付状态更新')
  }
  if (protocolKind === 'order_end') {
    return truncatePreview(protocolText || '订单已完成')
  }
  if (protocolKind === 'needs_rating') {
    return truncatePreview(protocolText || '评价待开放')
  }

  return truncatePreview(content)
}

function truncatePreview(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 77)}…`
}
