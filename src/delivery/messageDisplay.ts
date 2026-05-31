import type { DeliveryMessage } from '@/delivery/messageStore'
import { isOrderMessage, parseOrderMessage } from '@/delivery/orderParser'
import { parseDeliveryProtocol } from '@/delivery/protocol'

export type MessageBubbleVariant =
  | 'text'
  | 'order'
  | 'status'
  | 'delivery'
  | 'completion'
  | 'rating_reserved'
  | 'system'

export function getMessageVariant(message: DeliveryMessage): MessageBubbleVariant {
  if (message.decryptError && !isOrderMessage(message.content)) {
    return 'system'
  }
  if (isOrderMessage(message.content)) {
    return 'order'
  }
  const protocol = parseDeliveryProtocol(message.content)
  if (protocol.kind === 'order_status') {
    return 'status'
  }
  if (protocol.kind === 'delivery') {
    return 'delivery'
  }
  if (protocol.kind === 'order_end') {
    return 'completion'
  }
  if (protocol.kind === 'needs_rating') {
    return 'rating_reserved'
  }
  return 'text'
}

export function sessionPreviewText(content: string): string {
  const order = parseOrderMessage(content)
  if (order) {
    return truncatePreview(order.displaySummary || '请求')
  }

  const protocol = parseDeliveryProtocol(content)
  if (protocol.kind === 'delivery') {
    return truncatePreview(protocol.displayText || '已收到交付')
  }
  if (protocol.kind === 'order_status') {
    return truncatePreview(protocol.displayText || '交付状态更新')
  }
  if (protocol.kind === 'order_end') {
    return truncatePreview(protocol.displayText || '订单已完成')
  }
  if (protocol.kind === 'needs_rating') {
    return truncatePreview(protocol.displayText || '评价待开放')
  }

  return truncatePreview(content)
}

function truncatePreview(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 77)}…`
}
