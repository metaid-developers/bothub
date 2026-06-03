import { useState, type KeyboardEvent } from 'react'
import { clsx } from 'clsx'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { t } from '@/i18n'
import { formatPrice } from '@/lib/format'
import { avatarColor, avatarInitials } from '@/lib/avatar'

const PROVIDER_FALLBACK_NAME = () => t('hub.unknownBot')

function ServiceIcon({ service }: { service: SkillServiceListItem }) {
  const initials = avatarInitials(service.displayName)
  const bgColor = avatarColor(service.displayName)
  const [failed, setFailed] = useState(false)

  if (service.serviceIcon && !failed) {
    return (
      <img
        src={service.serviceIcon}
        alt=""
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-xl border border-hub-border object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-lg font-semibold text-white/90"
      aria-hidden
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}

function ProviderAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initials = avatarInitials(name)
  const bgColor = avatarColor(name)
  const [failed, setFailed] = useState(false)

  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt=""
        onError={() => setFailed(true)}
        className="h-7 w-7 shrink-0 rounded-full border border-hub-border object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white/90"
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

export interface ServiceCardProps {
  service: SkillServiceListItem
  className?: string
  selected?: boolean
  onSelect?: (service: SkillServiceListItem) => void
  onRequest?: (service: SkillServiceListItem) => void
}

export function ServiceCard({
  service,
  className,
  selected,
  onSelect,
  onRequest,
}: ServiceCardProps) {
  const price = formatPrice(service.price, service.currency)
  const providerName = service.providerName?.trim() || PROVIDER_FALLBACK_NAME()
  const selectable = Boolean(onSelect)

  const handleCardClick = () => {
    onSelect?.(service)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(service)
    }
  }

  return (
    <article
      data-hub-service-card
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? handleCardClick : undefined}
      onKeyDown={selectable ? handleCardKeyDown : undefined}
      className={clsx(
        'flex h-full flex-col rounded-card border border-hub-border bg-hub-surface p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)] transition hover:border-hub-border/80 hover:bg-hub-surface2/80',
        selectable &&
          'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent',
        selected && 'border-hub-accent/70 ring-1 ring-hub-accent/35',
        className,
      )}
    >
      <div className="flex gap-3">
        <ServiceIcon service={service} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold leading-snug text-white">
            {service.displayName}
          </h2>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[11px] text-hub-muted">
              {service.serviceName}
            </span>
            <p className="shrink-0 text-right">
              <span className="text-base font-semibold text-hub-accent">{price.amount}</span>{' '}
              <span className="text-[11px] font-medium uppercase tracking-wide text-hub-muted">
                {price.currency}
              </span>
            </p>
          </div>
          {service.providerSkill ? (
            <span className="mt-2 inline-flex rounded-full bg-hub-surface2 px-2 py-0.5 text-[11px] font-medium text-hub-muted">
              {service.providerSkill}
            </span>
          ) : null}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-hub-muted">
            {service.description}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <RatingStars avg={service.ratingAvg} count={service.ratingCount} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-hub-border/70 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-hub-online shadow-[0_0_8px_rgba(34,197,94,0.55)]"
            title={t('hub.online')}
            aria-hidden
          />
          <ProviderAvatar name={providerName} avatar={service.providerAvatar} />
          <span className="truncate text-xs font-medium text-white">{providerName}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!onRequest}
        onClick={(event) => {
          event.stopPropagation()
          onRequest?.(service)
        }}
        className="mt-4 w-full rounded-xl bg-hub-accent py-2.5 text-sm font-semibold text-hub-bg opacity-90 transition enabled:hover:bg-hub-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        title={onRequest ? undefined : t('hub.requestUnavailableTitle')}
      >
        {t('hub.payRequest')}
      </button>
    </article>
  )
}
