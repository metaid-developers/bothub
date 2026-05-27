import { useEffect, useRef } from 'react'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { MessageBubble } from './MessageBubble'

export interface MessageListProps {
  peerGlobalMetaId: string | null
  messages: DeliveryMessage[]
  selfGlobalMetaId: string
}

export function MessageList({
  peerGlobalMetaId,
  messages,
  selfGlobalMetaId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [peerGlobalMetaId, messages.length])

  if (!peerGlobalMetaId) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-card border border-dashed border-hub-border bg-hub-surface/40 p-6 text-sm text-hub-muted">
        Select a session to view messages
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-card border border-hub-border bg-hub-surface/40 p-6 text-sm text-hub-muted">
        No messages yet for this peer
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-[320px] flex-col gap-3 overflow-y-auto rounded-card border border-hub-border bg-hub-surface/40 p-4"
      aria-label="Message timeline"
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
