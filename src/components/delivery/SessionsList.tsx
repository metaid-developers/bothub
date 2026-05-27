import { clsx } from 'clsx'
import { EmptyState } from '@/components/common/EmptyState'
import type { DeliverySession } from '@/delivery/messageStore'
import { sessionPreviewText } from '@/delivery/messageDisplay'
import { t } from '@/i18n'
import { truncateGlobalMetaId } from '@/wallet/format'

export interface SessionsListProps {
  sessions: DeliverySession[]
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
              <div className="font-semibold text-white">
                {truncateGlobalMetaId(session.peerGlobalMetaId)}
              </div>
              {session.serviceLabel ? (
                <p className="mt-0.5 text-xs font-medium text-hub-accent">
                  {session.serviceLabel}
                </p>
              ) : null}
              <p className="mt-1 line-clamp-2 text-xs text-hub-muted">
                {sessionPreviewText(session.lastMessage.content)}
              </p>
              <p className="mt-1 text-[11px] text-hub-muted">
                {session.messageCount} message{session.messageCount === 1 ? '' : 's'}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
