import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { SkillServiceCore } from '@/api/aggregator.types'
import { useServiceDetailQuery } from '@/api/queries'
import { ProviderProfile } from '@/components/hub/ProviderProfile'
import { RequestModal } from '@/components/hub/RequestModal'
import { formatPrice } from '@/lib/format'
import { useWallet } from '@/wallet/useWallet'

const WALLET_REQUIRED_TOOLTIP = 'Connect your Metalet wallet to pay and request this service'

export interface ServiceDetailRating {
  avg: number
  count: number
}

export interface ServiceDetailPanelProps {
  serviceId: string
  onClose: () => void
  /** List cache rating; detail API does not include ratings in v1 */
  rating?: ServiceDetailRating | null
  className?: string
}

function DetailIcon({ service }: { service: SkillServiceCore }) {
  const initial = service.displayName.trim().charAt(0).toUpperCase() || '?'
  if (service.serviceIcon) {
    return (
      <img
        src={service.serviceIcon}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl border border-hub-border object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-hub-border bg-hub-accent/15 font-display text-xl font-semibold text-hub-accent"
      aria-hidden
    >
      {initial}
    </div>
  )
}

function RatingStars({ avg, count }: { avg: number; count: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, avg)))
  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      aria-label={`Rating ${avg.toFixed(1)} from ${count} reviews`}
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
    <section className="rounded-xl border border-hub-border/80 bg-hub-surface2/40 p-3" aria-label="Pricing">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-hub-muted">Pricing</h3>
      <dl className="mt-2 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-hub-muted">Price</dt>
          <dd className="text-right font-semibold text-hub-accent">
            {price.amount}{' '}
            <span className="text-[11px] font-medium uppercase tracking-wide text-hub-muted">
              {price.currency}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-hub-muted">Settlement</dt>
          <dd className="font-medium capitalize text-white">{service.settlementKind}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-hub-muted">Payment chain</dt>
          <dd className="font-mono text-xs uppercase text-white/90">{service.paymentChain}</dd>
        </div>
        {isMrc20 ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-hub-muted">MRC20 ticker</dt>
              <dd className="font-mono text-xs text-white/90">{service.mrc20Ticker ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-hub-muted">MRC20 id</dt>
              <dd className="truncate font-mono text-xs text-white/90" title={service.mrc20Id ?? undefined}>
                {service.mrc20Id ?? '—'}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-1" aria-busy="true" aria-label="Loading service details">
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-xl bg-hub-surface2" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-hub-surface2" />
          <div className="h-3 w-1/2 rounded bg-hub-surface2" />
        </div>
      </div>
      <div className="h-24 rounded-xl bg-hub-surface2" />
      <div className="h-28 rounded-xl bg-hub-surface2" />
    </div>
  )
}

export function ServiceDetailPanel({
  serviceId,
  onClose,
  rating,
  className,
}: ServiceDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const walletStatus = useWallet((s) => s.status)
  const walletIdentity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && walletIdentity != null
  const { data, isLoading, isError, error } = useServiceDetailQuery(serviceId)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (panelRef.current?.contains(target)) return
      if (target.closest('[data-hub-service-card]')) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const payDisabled = !walletConnected
  const payTooltip = payDisabled ? WALLET_REQUIRED_TOOLTIP : undefined

  return (
    <aside
      ref={panelRef}
      className={clsx(
        'sticky top-20 rounded-card border border-hub-border bg-hub-surface p-4 shadow-[0_16px_48px_-28px_rgba(0,0,0,0.9)]',
        className,
      )}
      aria-label="Service detail"
      role="complementary"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-hub-muted">
          Service detail
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-hub-muted transition hover:bg-hub-surface2 hover:text-white"
          aria-label="Close service detail"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {isLoading ? <DetailSkeleton /> : null}

      {isError ? (
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-6 text-center text-sm text-red-200"
          role="alert"
        >
          Could not load service details
          {error instanceof Error ? (
            <p className="mt-2 text-xs text-red-300/80">{error.message}</p>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <header className="flex gap-3">
            <DetailIcon service={data.service} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold leading-snug text-white">
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
            disabled={payDisabled}
            title={payTooltip}
            onClick={() => setRequestOpen(true)}
            className="w-full rounded-xl bg-hub-accent py-2.5 text-sm font-semibold text-hub-bg transition enabled:hover:bg-hub-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pay &amp; Request
          </button>

          {walletIdentity && requestOpen ? (
            <RequestModal
              open={requestOpen}
              onClose={() => setRequestOpen(false)}
              service={data.service}
              provider={data.provider}
              wallet={walletIdentity}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
