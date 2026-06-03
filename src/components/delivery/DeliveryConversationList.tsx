import { clsx } from 'clsx'
import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import type { DeliveryConversation } from '@/delivery/conversationWorkspace'
import { sessionPreviewText } from '@/delivery/messageDisplay'
import type { DeliverySyncUiStatus } from '@/delivery/syncStatusStore'
import { getLanguage, t } from '@/i18n'

interface DeliveryConversationListProps {
  conversations: DeliveryConversation[]
  selectedConversationId: string | null
  walletConnected: boolean
  syncStatus: DeliverySyncUiStatus
  failedPeerCount?: number
  onSelectConversation: (conversationId: string) => void
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return t('time.justNow')
  if (diffMin < 60) return t('time.minutesAgo', { count: diffMin })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return t('time.daysAgo', { count: diffDays })
  return new Intl.DateTimeFormat(getLanguage(), {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function displayName(conversation: DeliveryConversation): string {
  return (
    conversation.providerName?.trim() || conversation.providerGlobalMetaId.trim() || conversation.id
  )
}

function latestPreview(conversation: DeliveryConversation): string | null {
  const lastMessage = conversation.lastMessage
  if (!lastMessage) return null
  return sessionPreviewText(lastMessage.content, lastMessage.protocolTag, lastMessage.decryptError)
}

export function DeliveryConversationList({
  conversations,
  selectedConversationId,
  walletConnected,
  syncStatus,
  failedPeerCount = 0,
  onSelectConversation,
}: DeliveryConversationListProps) {
  if (!walletConnected && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
        <p className="text-sm font-semibold text-white">{t('delivery.walletNotConnectedTitle')}</p>
        <p className="max-w-xs text-xs text-hub-muted">{t('delivery.walletNotConnectedHint')}</p>
      </div>
    )
  }

  if (conversations.length > 0) {
    return (
      <div>
        {syncStatus === 'partial' && failedPeerCount > 0 && (
          <p className="mb-2 px-1 text-xs text-amber-400/70">
            {t('delivery.workspace.syncPartial', { count: failedPeerCount })}
          </p>
        )}
        {syncStatus === 'error' && (
          <p className="mb-2 px-1 text-xs text-red-400/70">{t('delivery.workspace.syncError')}</p>
        )}
        <ConversationCardList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={onSelectConversation}
        />
      </div>
    )
  }

  if (syncStatus === 'hydrating' || (syncStatus === 'idle' && walletConnected)) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncHydrating')}</p>
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncSyncing')}</p>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncError')}</p>
      </div>
    )
  }

  if (walletConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
        <p className="text-sm font-semibold text-white">
          {t('delivery.workspace.noConversationsTitle')}
        </p>
        <p className="max-w-xs text-xs text-hub-muted">
          {t('delivery.workspace.noConversationsHint')}
        </p>
      </div>
    )
  }

  return null
}

function ConversationCardList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: {
  conversations: DeliveryConversation[]
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string) => void
}) {
  return (
    <ul role="list" aria-label={t('delivery.workspace.conversations')} className="space-y-1">
      {conversations.map((conversation) => {
        const name = displayName(conversation)
        const preview = latestPreview(conversation)
        const isSelected = conversation.id === selectedConversationId
        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
              aria-label={name}
              aria-current={isSelected ? 'true' : undefined}
              className={clsx(
                'w-full overflow-hidden rounded-card border px-3 py-2.5 text-left transition',
                isSelected
                  ? 'border-hub-accent/60 bg-hub-surface2/90'
                  : 'border-transparent bg-hub-surface2/40 hover:bg-hub-surface2/70',
              )}
            >
              <div className="flex items-center gap-2.5">
                <PeerAvatar
                  name={conversation.providerName}
                  avatarUrl={conversation.providerAvatarUrl}
                  globalMetaId={conversation.providerGlobalMetaId || conversation.id}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-white">{name}</p>
                    {conversation.activeOrderCount > 0 && (
                      <span className="shrink-0 rounded-full bg-hub-accent/15 px-2 py-0.5 text-[10px] font-semibold text-hub-accent">
                        {conversation.activeOrderCount}{' '}
                        {t('delivery.workspace.activeOrderCountSuffix')}
                      </span>
                    )}
                  </div>
                  {preview && <p className="mt-0.5 truncate text-xs text-hub-muted">{preview}</p>}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-hub-muted/60">
                    <span>{formatTime(conversation.latestActivityAt)}</span>
                    {conversation.deliveredOrderCount > 0 && (
                      <span>
                        {conversation.deliveredOrderCount}{' '}
                        {t('delivery.workspace.deliveredOrderCountSuffix')}
                      </span>
                    )}
                    {conversation.assetCount > 0 && (
                      <span>
                        {conversation.assetCount} {t('delivery.workspace.assetCountSuffix')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
