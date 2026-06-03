import type { DeliveryMessage } from '@/delivery/messageStore'
import { isOrderMessage, parseOrderMessage } from '@/delivery/orderParser'
import { parseDeliveryProtocol, type DeliveryProtocolKind } from '@/delivery/protocol'
import { t } from '@/i18n'

export type MessageBubbleVariant =
  | 'text'
  | 'order'
  | 'status'
  | 'delivery'
  | 'completion'
  | 'rating_reserved'
  | 'system'

function protocolKindFromTag(protocolTag: string | null | undefined): DeliveryProtocolKind | null {
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

function variantFromProtocolKind(kind: DeliveryProtocolKind): MessageBubbleVariant | null {
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
  if (kind === 'delivery') return t('delivery.message.receivedDelivery')
  if (kind === 'order_status') return t('delivery.message.statusUpdate')
  if (kind === 'order_end') return t('delivery.message.orderCompleted')
  if (kind === 'needs_rating') return t('delivery.message.ratingReserved')
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

export function sessionPreviewText(
  content: string,
  protocolTag?: string,
  decryptError?: string,
): string {
  const order = parseOrderMessage(content)
  if (order) {
    return truncatePreview(order.displaySummary || t('delivery.message.order'))
  }

  const protocol = parseDeliveryProtocol(content)
  if (protocol.kind !== 'plain') {
    return previewForProtocolKind(protocol.kind, protocol.displayText)
  }

  if (decryptError?.trim()) {
    return t('delivery.decryptFailedDefault')
  }

  const protocolKind = protocolKindFromTag(protocolTag)
  const protocolText = ''
  if (!protocolKind) return truncatePreview(content)
  return previewForProtocolKind(protocolKind, protocolText)
}

function previewForProtocolKind(kind: DeliveryProtocolKind, displayText: string): string {
  if (kind === 'delivery') {
    return truncatePreview(displayText || t('delivery.message.receivedDelivery'))
  }
  if (kind === 'order_status') {
    return truncatePreview(displayText || t('delivery.message.statusUpdate'))
  }
  if (kind === 'order_end') {
    return truncatePreview(displayText || t('delivery.message.orderCompleted'))
  }
  if (kind === 'needs_rating') {
    return truncatePreview(displayText || t('delivery.message.ratingReserved'))
  }

  return truncatePreview(displayText)
}

function truncatePreview(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 77)}…`
}
