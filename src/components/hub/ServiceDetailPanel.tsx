import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { clsx } from 'clsx'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { SkillServiceCore } from '@/api/aggregator.types'
import { useServiceDetailQuery } from '@/api/queries'
import { ErrorState } from '@/components/common/ErrorState'
import { ServiceDetailSkeleton } from '@/components/common/LoadingSkeleton'
import { ProviderProfile } from '@/components/hub/ProviderProfile'
import { RequestModal } from '@/components/hub/RequestModal'
import { t } from '@/i18n'
import { formatPrice } from '@/lib/format'
import { avatarColor, avatarInitials } from '@/lib/avatar'
import { useWallet } from '@/wallet/useWallet'

export interface ServiceDetailRating {
  avg: number
  count: number
}

export interface ServiceDetailPanelProps {
  serviceId: string
  onClose: () => void
  /** List cache rating; detail API does not include ratings in v1 */
  rating?: ServiceDetailRating | null
}

function DetailIcon({ service }: { service: SkillServiceCore }) {
  const initials = avatarInitials(service.displayName)
  const bgColor = avatarColor(service.displayName)
  const [failed, setFailed] = useState(false)

  if (service.serviceIcon && !failed) {
    return (
      <img
        src={service.serviceIcon}
        alt=""
        onError={() => setFailed(true)}
        className="h-16 w-16 shrink-0 rounded-xl border border-hub-border object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl font-display text-xl font-semibold text-white/90"
      aria-hidden
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}

function RatingStars({ avg, count }: { avg: number; count: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, avg)))
  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      aria-label={t('hub.ratingLabel', { rating: avg.toFixed(1), count })}
    >
      <span className="flex gap-0.5 text-hub-accent" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < filled ? 'opacity-100' : 'opacity-25'}>
            ★
          </span>
        ))}
      </span>
      <span className="font-medium text-white/90">{avg.toFixed(1)}</span>
      <span className="text-hub-muted">({count})</span>
    </div>
  )
}

function PricingBlock({ service }: { service: SkillServiceCore }) {
  const price = formatPrice(service.price, service.currency)
  const isMrc20 = service.settlementKind === 'mrc20'

  return (
    <section
      className="rounded-xl border border-hub-border/80 bg-hub-surface2/40 p-3"
      aria-label={t('hub.pricing')}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-hub-muted">
        {t('hub.pricing')}
      </h3>
      <dl className="mt-2 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-hub-muted">{t('hub.price')}</dt>
          <dd className="text-right font-semibold text-hub-accent">
            {price.amount}{' '}
            <span className="text-[11px] font-medium uppercase tracking-wide text-hub-muted">
              {price.currency}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-hub-muted">{t('hub.settlement')}</dt>
          <dd className="font-medium text-white">
            {service.settlementKind === 'native' ? t('hub.nativeCoin') : 'MRC20'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-hub-muted">{t('hub.paymentChain')}</dt>
          <dd className="font-mono text-xs uppercase text-white/90">{service.paymentChain}</dd>
        </div>
        {isMrc20 ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-hub-muted">{t('hub.mrc20Ticker')}</dt>
              <dd className="font-mono text-xs text-white/90">{service.mrc20Ticker ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-hub-muted">{t('hub.mrc20Id')}</dt>
              <dd
                className="truncate font-mono text-xs text-white/90"
                title={service.mrc20Id ?? undefined}
              >
                {service.mrc20Id ?? '—'}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  )
}

export function ServiceDetailPanel({ serviceId, onClose, rating }: ServiceDetailPanelProps) {
  const [requestOpen, setRequestOpen] = useState(false)
  const walletStatus = useWallet((s) => s.status)
  const walletIdentity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && Boolean(walletIdentity?.globalMetaId)
  const { data, isLoading, isError, error, refetch } = useServiceDetailQuery(serviceId)

  const payTooltip = !walletConnected ? t('wallet.requiredPay') : undefined

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel
          className={clsx(
            'relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden',
            'rounded-card border border-hub-border bg-hub-surface shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]',
          )}
          aria-label={t('hub.serviceDetail')}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-hub-border px-5 py-4">
            <Dialog.Title className="font-display text-sm font-semibold uppercase tracking-wide text-hub-muted">
              {t('hub.serviceDetail')}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-hub-muted transition hover:bg-hub-surface2 hover:text-white"
              aria-label={t('hub.closeDetail')}
            >
              <XMarkIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? <ServiceDetailSkeleton label={t('hub.loadingDetail')} /> : null}

            {isError ? (
              <ErrorState
                title={t('hub.detailError')}
                message={error instanceof Error ? error.message : undefined}
                onRetry={() => void refetch()}
              />
            ) : null}

            {data ? (
              <div className="space-y-4">
                <header className="flex gap-3">
                  <DetailIcon service={data.service} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold leading-snug text-white">
                      {data.service.displayName}
                    </h2>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-hub-muted">
                      {data.service.serviceName}
                    </p>
                    {data.service.providerSkill ? (
                      <span className="mt-2 inline-flex rounded-full bg-hub-surface2 px-2 py-0.5 text-[11px] font-medium text-hub-muted">
                        {data.service.providerSkill}
                      </span>
                    ) : null}
                    {rating ? (
                      <div className="mt-2">
                        <RatingStars avg={rating.avg} count={rating.count} />
                      </div>
                    ) : null}
                  </div>
                </header>

                <p className="text-sm leading-relaxed text-hub-muted">{data.service.description}</p>

                <PricingBlock service={data.service} />

                <ProviderProfile provider={data.provider} />

                <button
                  type="button"
                  title={payTooltip}
                  onClick={() => setRequestOpen(true)}
                  className="w-full rounded-xl bg-hub-accent py-2.5 text-sm font-semibold text-hub-bg transition hover:bg-hub-accent-hover"
                >
                  {t('hub.payRequest')}
                </button>

                {requestOpen ? (
                  <RequestModal
                    open={requestOpen}
                    onClose={() => setRequestOpen(false)}
                    service={data.service}
                    provider={data.provider}
                    wallet={walletIdentity ?? null}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
