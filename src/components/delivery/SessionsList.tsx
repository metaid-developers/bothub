import { clsx } from 'clsx'
import { EmptyState } from '@/components/common/EmptyState'
import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import { peerDisplayName } from '@/components/delivery/peerDisplay'
import { sessionPreviewText } from '@/delivery/messageDisplay'
import type { EnrichedDeliverySession } from '@/delivery/sessionDisplay'
import { t } from '@/i18n'
import { truncateGlobalMetaId } from '@/wallet/format'

export interface SessionsListProps {
  sessions: EnrichedDeliverySession[]
  selectedSessionKey: string | null
  onSelectSession: (sessionKey: string) => void
  walletConnected: boolean
  loading?: boolean
}

export function SessionsList({
  sessions,
  selectedSessionKey,
  onSelectSession,
  walletConnected,
  loading = false,
}: SessionsListProps) {
  if (!walletConnected) {
    return (
      <EmptyState
        title={t('delivery.walletNotConnectedTitle')}
        description={t('delivery.walletNotConnectedHint')}
        className="py-8"
      />
    )
  }

  if (loading) {
    return null
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        title={t('delivery.noSessionsTitle')}
        description={t('delivery.noSessionsHint')}
        className="py-8"
      />
    )
  }

  return (
    <ul className="flex flex-col gap-1" aria-label={t('delivery.sessions')}>
      {sessions.map((session) => {
        const selected = session.sessionKey === selectedSessionKey
        const displayName = peerDisplayName({
          name: session.peerName,
          globalMetaId: session.peerGlobalMetaId,
        })
        return (
          <li key={session.sessionKey}>
            <button
              type="button"
              onClick={() => onSelectSession(session.sessionKey)}
              className={clsx(
                'w-full rounded-card border px-3 py-3 text-left transition-colors',
                selected
                  ? 'border-hub-accent/60 bg-hub-surface2'
                  : 'border-hub-border bg-hub-surface/60 hover:border-hub-muted/50',
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <PeerAvatar
                  name={session.peerName}
                  avatarUrl={session.peerAvatarUrl}
                  globalMetaId={session.peerGlobalMetaId}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-semibold text-white">{displayName}</span>
                    <span className="shrink-0 rounded-full border border-hub-border px-2 py-0.5 text-[10px] font-medium text-hub-muted">
                      {t(`delivery.status.${session.status}`)}
                    </span>
                  </div>
                  {session.peerName ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-hub-muted">
                      {truncateGlobalMetaId(session.peerGlobalMetaId)}
                    </p>
                  ) : null}
                </div>
              </div>
              {session.serviceLabel ? (
                <p className="mt-0.5 text-xs font-medium text-hub-accent">{session.serviceLabel}</p>
              ) : null}
              <p className="mt-1 line-clamp-2 text-xs text-hub-muted">
                {sessionPreviewText(
                  session.lastMessage.content,
                  session.lastMessage.protocolTag,
                  session.lastMessage.decryptError,
                )}
              </p>
              <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-hub-muted">
                <span>
                  {session.messageCount} {t('delivery.workspace.messageCountSuffix')}
                </span>
                <span>
                  {session.assetCount} {t('delivery.workspace.assetCountSuffix')}
                </span>
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
