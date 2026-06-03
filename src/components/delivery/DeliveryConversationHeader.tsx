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

export function DeliveryConversationHeader({
  conversation,
}: DeliveryConversationHeaderProps) {
  if (!conversation) {
    return (
      <div
        role="status"
        aria-label={t('delivery.workspace.noConversationSelectedAria')}
        className="border-b border-hub-border px-4 py-3"
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
    <header className="border-b border-hub-border px-4 py-3">
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
            <span>{conversation.activeOrderCount} 个进行中</span>
            {conversation.deliveredOrderCount > 0 && (
              <span>{conversation.deliveredOrderCount} 个已交付</span>
            )}
            <span>{conversation.assetCount} 个成果</span>
            {conversation.messageCount > 0 && (
              <span>{conversation.messageCount} 条消息</span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
