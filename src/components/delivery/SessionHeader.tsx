import { t } from '@/i18n'
import { truncateGlobalMetaId } from '@/wallet/format'
import type { DeliverySessionStatus } from '@/delivery/sessionDisplay'

export interface SessionHeaderProps {
  session: {
    peerGlobalMetaId: string
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

  return (
    <header className="border-b border-hub-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">
          {truncateGlobalMetaId(session.peerGlobalMetaId)}
        </p>
        <span className="rounded-full border border-hub-border px-2 py-0.5 text-[11px] font-medium text-hub-muted">
          {t(`delivery.status.${session.status}`)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-hub-muted">
        {session.serviceLabel || t('delivery.unknownService')}
      </p>
    </header>
  )
}
