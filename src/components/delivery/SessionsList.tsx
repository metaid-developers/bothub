import { clsx } from 'clsx'
import { EmptyState } from '@/components/common/EmptyState'
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
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate font-semibold text-white">
                  {truncateGlobalMetaId(session.peerGlobalMetaId)}
                </span>
                <span className="shrink-0 rounded-full border border-hub-border px-2 py-0.5 text-[10px] font-medium text-hub-muted">
                  {t(`delivery.status.${session.status}`)}
                </span>
              </div>
              {session.serviceLabel ? (
                <p className="mt-0.5 text-xs font-medium text-hub-accent">
                  {session.serviceLabel}
                </p>
              ) : null}
              <p className="mt-1 line-clamp-2 text-xs text-hub-muted">
                {sessionPreviewText(session.lastMessage.content)}
              </p>
              <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-hub-muted">
                <span>
                  {session.messageCount} message{session.messageCount === 1 ? '' : 's'}
                </span>
                <span>
                  {session.assetCount} asset{session.assetCount === 1 ? '' : 's'}
                </span>
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
