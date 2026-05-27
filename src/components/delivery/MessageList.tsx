import { useEffect, useRef } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { t } from '@/i18n'
import { MessageBubble } from './MessageBubble'

export interface MessageListProps {
  sessionKey: string | null
  messages: DeliveryMessage[]
  selfGlobalMetaId: string
}

export function MessageList({
  sessionKey,
  messages,
  selfGlobalMetaId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionKey, messages.length])

  if (!sessionKey) {
    return (
      <EmptyState
        title={t('delivery.selectSession')}
        className="min-h-[320px] py-16"
      />
    )
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        title={t('delivery.noMessagesTitle')}
        description={t('delivery.noMessagesHint')}
        className="min-h-[320px] py-16"
      />
    )
  }

  return (
    <div
      className="flex h-full min-h-[320px] flex-col gap-3 overflow-y-auto rounded-card border border-hub-border bg-hub-surface/40 p-4"
      aria-label={t('delivery.messages')}
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          selfGlobalMetaId={selfGlobalMetaId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
