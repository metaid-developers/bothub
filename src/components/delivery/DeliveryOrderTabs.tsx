import { clsx } from 'clsx'
import type {
  DeliveryConversation,
  DeliveryOrderThread,
} from '@/delivery/conversationWorkspace'
import { t } from '@/i18n'

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
  if (thread.assetCount > 0) {
    parts.push(`${thread.assetCount} ${t('delivery.workspace.assetCountSuffix')}`)
  }
  if (thread.messageCount > 0) {
    parts.push(`${thread.messageCount} ${t('delivery.workspace.messageCountSuffix')}`)
  }
  return parts.join(` ${t('delivery.workspace.countSeparator')} `)
}

function tabDomId(tabId: string): string {
  return `delivery-tab-${tabId.replace(/[^A-Za-z0-9_-]/g, '-')}`
}

function panelDomId(tabId: string): string {
  return `delivery-panel-${tabId.replace(/[^A-Za-z0-9_-]/g, '-')}`
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
      aria-label={t('delivery.workspace.tabsAria')}
      className="hub-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-hub-border px-4 py-2"
    >
      <button
        id={tabDomId('all')}
        type="button"
        role="tab"
        aria-controls={panelDomId('all')}
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
        {t('delivery.workspace.allTab')}
      </button>
      {conversation?.orderThreads.map((thread) => {
        const selected = selectedTabId === thread.tabId
        const counts = countLabel(thread)
        const label = tabLabel(thread)
        const title = counts ? `${label} ${counts}` : label
        return (
          <button
            key={thread.tabId}
            id={tabDomId(thread.tabId)}
            type="button"
            role="tab"
            aria-controls={panelDomId(thread.tabId)}
            aria-label={title}
            aria-selected={selected}
            title={title}
            onClick={() => onSelectTab(thread.tabId)}
            className={clsx(
              'inline-flex max-w-[16rem] shrink-0 items-center rounded-full px-3 py-1.5 text-left text-xs font-semibold transition',
              selected
                ? 'bg-hub-accent text-white'
                : 'bg-hub-surface2 text-hub-muted hover:text-white',
            )}
          >
            <span className="min-w-0 truncate">{label}</span>
            {counts && (
              <span className="ml-2 shrink-0 text-[10px] font-normal opacity-75">
                {counts}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
