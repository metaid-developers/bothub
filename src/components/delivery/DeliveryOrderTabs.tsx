import { clsx } from 'clsx'
import type {
  DeliveryConversation,
  DeliveryOrderThread,
} from '@/delivery/conversationWorkspace'

interface DeliveryOrderTabsProps {
  conversation: DeliveryConversation | null
  selectedTabId: string
  onSelectTab: (tabId: string) => void
}

function tabLabel(thread: DeliveryOrderThread): string {
  return thread.serviceLabel.trim() || thread.requestSummary.trim() || thread.orderId
}

function countLabel(thread: DeliveryOrderThread): string {
  const parts: string[] = []
  if (thread.assetCount > 0) parts.push(`${thread.assetCount} 个成果`)
  if (thread.messageCount > 0) parts.push(`${thread.messageCount} 条消息`)
  return parts.join(' / ')
}

export function DeliveryOrderTabs({
  conversation,
  selectedTabId,
  onSelectTab,
}: DeliveryOrderTabsProps) {
  const disabled = !conversation

  return (
    <div
      role="tablist"
      aria-label="交付请求"
      className="flex gap-1 overflow-x-auto border-b border-hub-border px-4 py-2"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedTabId === 'all'}
        aria-disabled={disabled ? 'true' : undefined}
        disabled={disabled}
        onClick={() => onSelectTab('all')}
        className={clsx(
          'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
          selectedTabId === 'all'
            ? 'bg-hub-accent text-white'
            : 'bg-hub-surface2 text-hub-muted hover:text-white',
          disabled && 'cursor-not-allowed opacity-60 hover:text-hub-muted',
        )}
      >
        All
      </button>
      {conversation?.orderThreads.map((thread) => {
        const selected = selectedTabId === thread.tabId
        const counts = countLabel(thread)
        return (
          <button
            key={thread.tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelectTab(thread.tabId)}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1.5 text-left text-xs font-semibold transition',
              selected
                ? 'bg-hub-accent text-white'
                : 'bg-hub-surface2 text-hub-muted hover:text-white',
            )}
          >
            <span>{tabLabel(thread)}</span>
            {counts && (
              <span className="ml-2 text-[10px] font-normal opacity-75">
                {counts}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
