import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import type { DeliveryConversation } from '@/delivery/conversationWorkspace'
import { t } from '@/i18n'

interface DeliveryConversationHeaderProps {
  conversation: DeliveryConversation | null
}

function displayName(conversation: DeliveryConversation): string {
  return (
    conversation.providerName?.trim() ||
    conversation.providerGlobalMetaId.trim() ||
    conversation.id
  )
}

function countLabel(count: number, suffix: string): string {
  return `${count} ${suffix}`
}

export function DeliveryConversationHeader({
  conversation,
}: DeliveryConversationHeaderProps) {
  if (!conversation) {
    return (
      <div
        role="status"
        aria-label={t('delivery.workspace.noConversationSelectedAria')}
        className="shrink-0 border-b border-hub-border px-4 py-3"
      >
        <p className="text-sm font-semibold text-white">
          {t('delivery.workspace.noConversationSelectedTitle')}
        </p>
        <p className="mt-1 text-xs text-hub-muted">
          {t('delivery.workspace.noConversationSelectedHint')}
        </p>
      </div>
    )
  }

  const name = displayName(conversation)

  return (
    <header className="shrink-0 border-b border-hub-border px-4 py-3">
      <div className="flex items-center gap-3">
        <PeerAvatar
          name={conversation.providerName}
          avatarUrl={conversation.providerAvatarUrl}
          globalMetaId={conversation.providerGlobalMetaId || conversation.id}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-hub-muted">
            <span>
              {countLabel(
                conversation.activeOrderCount,
                t('delivery.workspace.activeOrderCountSuffix'),
              )}
            </span>
            {conversation.deliveredOrderCount > 0 && (
              <span>
                {countLabel(
                  conversation.deliveredOrderCount,
                  t('delivery.workspace.deliveredOrderCountSuffix'),
                )}
              </span>
            )}
            <span>
              {countLabel(conversation.assetCount, t('delivery.workspace.assetCountSuffix'))}
            </span>
            {conversation.messageCount > 0 && (
              <span>
                {countLabel(
                  conversation.messageCount,
                  t('delivery.workspace.messageCountSuffix'),
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
