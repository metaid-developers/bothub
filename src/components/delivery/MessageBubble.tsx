import { clsx } from 'clsx'
import type { DeliveryMessage } from '@/delivery/messageStore'

export interface MessageBubbleProps {
  message: DeliveryMessage
  selfGlobalMetaId: string
}

export function MessageBubble({ message, selfGlobalMetaId }: MessageBubbleProps) {
  const isSelf = message.fromGlobalMetaId.trim() === selfGlobalMetaId.trim()

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
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">Could not decrypt — showing ciphertext</p>
        ) : null}
      </div>
    </div>
  )
}
