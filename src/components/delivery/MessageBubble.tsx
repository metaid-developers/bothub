import { useState } from 'react'
import { clsx } from 'clsx'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { getMessageVariant } from '@/delivery/messageDisplay'
import { parseOrderMessage } from '@/delivery/orderParser'

export interface MessageBubbleProps {
  message: DeliveryMessage
  selfGlobalMetaId: string
}

function OrderBubble({
  message,
  isSelf,
}: {
  message: DeliveryMessage
  isSelf: boolean
}) {
  const [promptOpen, setPromptOpen] = useState(false)
  const order = parseOrderMessage(message.content)
  if (!order) {
    return (
      <TextBubble message={message} isSelf={isSelf} body={message.content} />
    )
  }

  const priceLabel =
    order.price || order.currency
      ? `${order.price} ${order.currency}`.trim()
      : ''

  return (
    <div className={clsx('flex', isSelf ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[min(100%,28rem)] rounded-card px-3 py-2 text-sm leading-relaxed',
          isSelf
            ? 'bg-hub-accent text-white'
            : 'border border-hub-border bg-hub-surface2 text-white',
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Order
        </p>
        <p className="mt-1 font-medium">{order.displaySummary}</p>
        {priceLabel ? (
          <p className="mt-1 text-xs opacity-90">Price: {priceLabel}</p>
        ) : null}
        {order.rawRequest ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setPromptOpen((open) => !open)}
              className="text-xs underline opacity-90"
            >
              {promptOpen ? 'Hide prompt' : 'Show prompt'}
            </button>
            {promptOpen ? (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-white/20 bg-black/10 p-2 text-xs">
                {order.rawRequest}
              </pre>
            ) : null}
          </div>
        ) : null}
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">Could not decrypt — showing ciphertext</p>
        ) : null}
      </div>
    </div>
  )
}

function TextBubble({
  message,
  isSelf,
  body,
}: {
  message: DeliveryMessage
  isSelf: boolean
  body: string
}) {
  return (
    <div className={clsx('flex', isSelf ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[min(100%,28rem)] rounded-card px-3 py-2 text-sm leading-relaxed',
          isSelf
            ? 'bg-hub-accent text-white'
            : 'border border-hub-border bg-hub-surface2 text-white',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">Could not decrypt — showing ciphertext</p>
        ) : null}
      </div>
    </div>
  )
}

function SystemBubble({ message }: { message: DeliveryMessage }) {
  return (
    <div className="flex justify-center">
      <p className="max-w-[min(100%,32rem)] rounded-full border border-hub-border bg-hub-surface2/80 px-3 py-1 text-center text-xs text-hub-muted">
        {message.decryptError
          ? 'Could not decrypt this message — stored ciphertext only.'
          : message.content || 'System message'}
      </p>
    </div>
  )
}

export function MessageBubble({ message, selfGlobalMetaId }: MessageBubbleProps) {
  const isSelf = message.fromGlobalMetaId.trim() === selfGlobalMetaId.trim()
  const variant = getMessageVariant(message)

  if (variant === 'system') {
    return <SystemBubble message={message} />
  }
  if (variant === 'order') {
    return <OrderBubble message={message} isSelf={isSelf} />
  }
  return <TextBubble message={message} isSelf={isSelf} body={message.content} />
}
