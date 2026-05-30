import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import { peerDisplayName } from '@/components/delivery/peerDisplay'
import { t } from '@/i18n'
import { truncateGlobalMetaId } from '@/wallet/format'
import type { DeliverySessionStatus } from '@/delivery/sessionDisplay'

export interface SessionHeaderProps {
  session: {
    peerGlobalMetaId: string
    peerName?: string
    peerAvatarUrl?: string
    serviceLabel: string | null
    status: DeliverySessionStatus
  } | null
}

export function SessionHeader({ session }: SessionHeaderProps) {
  if (!session) {
    return (
      <div
        role="status"
        aria-label={t('delivery.noSelectedSessionLabel')}
        className="border-b border-hub-border px-4 py-3"
      >
        <p className="text-sm font-semibold text-white">{t('delivery.noSelectedSessionLabel')}</p>
        <p className="mt-1 text-xs text-hub-muted">{t('delivery.noSelectedSessionHint')}</p>
      </div>
    )
  }

  const displayName = peerDisplayName({
    name: session.peerName,
    globalMetaId: session.peerGlobalMetaId,
  })

  return (
    <header className="border-b border-hub-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <PeerAvatar
          name={session.peerName}
          avatarUrl={session.peerAvatarUrl}
          globalMetaId={session.peerGlobalMetaId}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {displayName}
            </p>
            <span className="rounded-full border border-hub-border px-2 py-0.5 text-[11px] font-medium text-hub-muted">
              {t(`delivery.status.${session.status}`)}
            </span>
          </div>
          <p className="mt-1 flex min-w-0 gap-1 text-xs text-hub-muted">
            {session.peerName ? (
              <span className="shrink-0 font-mono">
                {truncateGlobalMetaId(session.peerGlobalMetaId)}
              </span>
            ) : null}
            <span className="truncate">
              {session.serviceLabel || t('delivery.unknownService')}
            </span>
          </p>
        </div>
      </div>
    </header>
  )
}
