import type { DeliveryMessage } from '@/delivery/messageStore'
import { isOrderMessage } from '@/delivery/orderParser'

export type MessageBubbleVariant = 'text' | 'order' | 'system'

export function getMessageVariant(message: DeliveryMessage): MessageBubbleVariant {
  if (message.decryptError && !isOrderMessage(message.content)) {
    return 'system'
  }
  if (isOrderMessage(message.content)) {
    return 'order'
  }
  return 'text'
}

export function sessionPreviewText(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 77)}…`
}
