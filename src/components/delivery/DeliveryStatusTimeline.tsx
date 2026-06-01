import { useId, useState } from 'react'
import { clsx } from 'clsx'
import { MessageBubble } from '@/components/delivery/MessageBubble'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { WorkspaceOrder } from '@/delivery/workspace'
import { t } from '@/i18n'

interface DeliveryStatusTimelineProps {
  order: WorkspaceOrder | null
  selfGlobalMetaId: string
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

export function DeliveryStatusTimeline({
  order,
  selfGlobalMetaId,
}: DeliveryStatusTimelineProps) {
  const [showDetails, setShowDetails] = useState(false)
  const detailsId = useId()

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
            aria-label="交付记录需要同步"
            className="mt-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
          >
            <p className="text-amber-300/90">有交付记录暂时无法显示，已保留原始记录。</p>
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
            {(showDetails
              ? messages
              : messages.filter((message) => !isDecryptGapMessage(message))
            ).map((message) => {
              const displayMessage =
                !message.decryptError && isDecryptGapMessage(message)
                  ? {
                      ...message,
                      decryptError: '原始记录暂未显示',
                    }
                  : message
              return (
                <MessageBubble
                  key={message.id}
                  message={displayMessage}
                  selfGlobalMetaId={selfGlobalMetaId}
                />
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function buildMilestones(order: WorkspaceOrder): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = []

  milestones.push({ label: '请求已发送', status: 'done' })

  if (order.status === 'active' || order.status === 'delivering') {
    milestones.push({ label: '服务处理中', status: 'current' })
  } else if (order.status === 'delivered' || order.status === 'completed') {
    milestones.push({ label: '服务处理中', status: 'done' })
  } else if (order.status === 'failed') {
    milestones.push({ label: '服务处理中', status: 'done' })
  } else {
    milestones.push({ label: '服务处理中', status: 'pending' })
  }

  if (order.assetCount > 0 && (order.status === 'delivered' || order.status === 'completed')) {
    milestones.push({ label: '成果已交付', status: 'done' })
  } else if (order.status === 'delivering') {
    milestones.push({ label: '成果已交付', status: 'pending' })
  } else if (order.status === 'completed') {
    milestones.push({ label: '成果已交付', status: 'done' })
  }

  if (order.status === 'completed') {
    milestones.push({ label: '已完结', status: 'done' })
  } else if (order.status === 'failed' || order.status === 'failed_to_send') {
    milestones.push({ label: '需要处理', status: 'current' })
  }

  return milestones
}
