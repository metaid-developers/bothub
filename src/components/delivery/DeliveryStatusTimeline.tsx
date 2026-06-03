import { useId, useState } from 'react'
import { clsx } from 'clsx'
import { MessageBubble } from '@/components/delivery/MessageBubble'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { WorkspaceOrder } from '@/delivery/workspace'
import { t } from '@/i18n'

interface DeliveryStatusTimelineProps {
  order: WorkspaceOrder | null
  messages?: DeliveryMessage[]
  selfGlobalMetaId: string
  mode?: 'order' | 'all'
}

interface TimelineMilestone {
  label: string
  status: 'done' | 'current' | 'pending'
  timestamp?: number
}

function hasDecryptGap(messages: DeliveryMessage[]): boolean {
  return messages.some(isDecryptGapMessage)
}

function isDecryptGapMessage(message: DeliveryMessage): boolean {
  return (
    Boolean(message.decryptError) ||
    (message.content === message.rawContent &&
      message.encryption.trim().toLowerCase() === 'ecdh')
  )
}

function displayMessages(
  messages: DeliveryMessage[],
  showDetails: boolean,
): DeliveryMessage[] {
  if (!showDetails) {
    return messages.filter((message) => !isDecryptGapMessage(message))
  }

  return messages.map((message) => {
    if (message.decryptError || !isDecryptGapMessage(message)) return message
    return {
      ...message,
      decryptError: t('delivery.workspace.rawDecryptPlaceholder'),
    }
  })
}

export function DeliveryStatusTimeline({
  order,
  messages: allMessages,
  selfGlobalMetaId,
  mode = 'order',
}: DeliveryStatusTimelineProps) {
  const [showDetails, setShowDetails] = useState(false)
  const detailsId = useId()

  if (mode === 'all') {
    const messages = allMessages ?? []
    const decryptGap = hasDecryptGap(messages)

    if (messages.length === 0) {
      return (
        <div
          role="status"
          className="flex min-h-[320px] flex-col items-center justify-center rounded-card border border-dashed border-hub-border bg-hub-surface/50 px-6 py-16 text-center"
        >
          <p className="font-display text-lg font-semibold text-white">
            {t('delivery.noMessagesTitle')}
          </p>
          <p className="mt-2 max-w-sm text-sm text-hub-muted">
            {t('delivery.workspace.noConversationMessagesHint')}
          </p>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-col overflow-auto">
        {decryptGap && (
          <div className="px-4 py-3">
            <div
              role="status"
              aria-label={t('delivery.workspace.decryptSyncAria')}
              className="rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
            >
              <p className="text-amber-300/90">
                {t('delivery.workspace.decryptSyncCopy')}
              </p>
              <button
                type="button"
                aria-controls={detailsId}
                aria-expanded={showDetails}
                onClick={() => setShowDetails(!showDetails)}
                className="mt-1 text-hub-accent underline-offset-2 hover:underline"
              >
                {t('delivery.technicalDetails')}
              </button>
            </div>
          </div>
        )}
        <div id={detailsId} className="space-y-0.5 px-4 pb-3 pt-3">
          {displayMessages(messages, showDetails).map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              selfGlobalMetaId={selfGlobalMetaId}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-card border border-dashed border-hub-border bg-hub-surface/50 px-6 py-12 text-center min-h-[320px] py-16"
      >
        <p className="font-display text-lg font-semibold text-white">
          {t('delivery.workspace.noSelectedTitle')}
        </p>
      </div>
    )
  }

  const milestones = buildMilestones(order)
  const messages = order.messages
  const decryptGap = hasDecryptGap(messages)

  return (
    <div className="flex min-h-0 flex-col overflow-auto">
      <div className="px-4 py-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-hub-muted">
          {t('delivery.workspace.progress')}
        </h3>
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className={clsx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  milestone.status === 'done'
                    ? 'bg-green-500/20 text-green-400'
                    : milestone.status === 'current'
                      ? 'bg-hub-accent/20 text-hub-accent'
                      : 'bg-hub-border/30 text-hub-muted',
                )}
              >
                {milestone.status === 'done' ? '\u2713' : index + 1}
              </div>
              <div className="min-w-0">
                <p
                  className={clsx(
                    'text-xs',
                    milestone.status === 'done'
                      ? 'text-green-400'
                      : milestone.status === 'current'
                        ? 'text-white'
                        : 'text-hub-muted',
                  )}
                >
                  {milestone.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {decryptGap && (
          <div
            role="status"
            aria-label={t('delivery.workspace.decryptSyncAria')}
            className="mt-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
          >
            <p className="text-amber-300/90">
              {t('delivery.workspace.decryptSyncCopy')}
            </p>
            <button
              type="button"
              aria-controls={detailsId}
              aria-expanded={showDetails}
              onClick={() => setShowDetails(!showDetails)}
              className="mt-1 text-hub-accent underline-offset-2 hover:underline"
            >
              {t('delivery.technicalDetails')}
            </button>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <details open className="border-t border-hub-border">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-hub-muted">
            {t('delivery.workspace.messages')}
          </summary>
          <div id={detailsId} className="space-y-0.5 pb-2">
            {displayMessages(messages, showDetails).map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                selfGlobalMetaId={selfGlobalMetaId}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function buildMilestones(order: WorkspaceOrder): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = []

  milestones.push({
    label: t('delivery.workspace.milestones.requestSent'),
    status: 'done',
  })

  if (order.status === 'active' || order.status === 'delivering') {
    milestones.push({
      label: t('delivery.workspace.milestones.processing'),
      status: 'current',
    })
  } else if (order.status === 'delivered' || order.status === 'completed') {
    milestones.push({
      label: t('delivery.workspace.milestones.processing'),
      status: 'done',
    })
  } else if (order.status === 'failed') {
    milestones.push({
      label: t('delivery.workspace.milestones.processing'),
      status: 'done',
    })
  } else {
    milestones.push({
      label: t('delivery.workspace.milestones.processing'),
      status: 'pending',
    })
  }

  if (order.assetCount > 0 && (order.status === 'delivered' || order.status === 'completed')) {
    milestones.push({
      label: t('delivery.workspace.milestones.assetsDelivered'),
      status: 'done',
    })
  } else if (order.status === 'delivering') {
    milestones.push({
      label: t('delivery.workspace.milestones.assetsDelivered'),
      status: 'pending',
    })
  } else if (order.status === 'completed') {
    milestones.push({
      label: t('delivery.workspace.milestones.assetsDelivered'),
      status: 'done',
    })
  }

  if (order.status === 'completed') {
    milestones.push({
      label: t('delivery.workspace.milestones.completed'),
      status: 'done',
    })
  } else if (order.status === 'failed' || order.status === 'failed_to_send') {
    milestones.push({
      label: t('delivery.workspace.milestones.needsAttention'),
      status: 'current',
    })
  }

  return milestones
}
