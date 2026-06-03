import { useEffect, useId, useState } from 'react'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import type { SkillServiceCurrency, SkillServiceOutputType } from '@/api/aggregator.types'
import type { HubFilters } from '@/components/hub/filters'
import { t } from '@/i18n'

const CURRENCY_VALUES: Array<{
  value: SkillServiceCurrency | ''
  labelKey?: Parameters<typeof t>[0]
  label?: string
}> = [
  { value: '', labelKey: 'hub.currencyAll' },
  { value: 'SPACE', label: 'SPACE' },
  { value: 'BTC', label: 'BTC' },
  { value: 'DOGE', label: 'DOGE' },
  { value: 'MRC20', label: 'MRC20' },
]

const OUTPUT_TYPE_VALUES: Array<{
  value: SkillServiceOutputType | ''
  labelKey: Parameters<typeof t>[0]
}> = [
  { value: '', labelKey: 'filters.outputAll' },
  { value: 'text', labelKey: 'filters.text' },
  { value: 'image', labelKey: 'filters.image' },
  { value: 'video', labelKey: 'filters.video' },
  { value: 'audio', labelKey: 'filters.audio' },
  { value: 'other', labelKey: 'filters.other' },
]

const SORT_OPTIONS: Array<
  Pick<HubFilters, 'sortBy' | 'order'> & { labelKey: Parameters<typeof t>[0] }
> = [
  { sortBy: 'rating', order: 'desc', labelKey: 'hub.sortTopRated' },
  { sortBy: 'updated', order: 'desc', labelKey: 'hub.sortRecent' },
  { sortBy: 'price', order: 'asc', labelKey: 'hub.sortPriceAsc' },
  { sortBy: 'price', order: 'desc', labelKey: 'hub.sortPriceDesc' },
]

const KEYWORD_DEBOUNCE_MS = 300

interface FiltersBarProps {
  value: HubFilters
  onChange: (next: HubFilters) => void
  className?: string
}

export function FiltersBar({ value, onChange, className }: FiltersBarProps) {
  const searchId = useId()
  const [keywordDraft, setKeywordDraft] = useState(value.keyword)

  useEffect(() => {
    setKeywordDraft(value.keyword)
  }, [value.keyword])

  useEffect(() => {
    if (keywordDraft === value.keyword) return
    const timer = window.setTimeout(() => {
      onChange({ ...value, keyword: keywordDraft })
    }, KEYWORD_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [keywordDraft, value, onChange])

  const sortKey = `${value.sortBy}:${value.order}`

  return (
    <header
      className={clsx(
        'mb-5 flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {t('hub.servicesTitle')}
        </h1>
        <p className="mt-1 text-sm text-hub-muted">{t('hub.servicesSubtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:max-w-2xl md:flex-row md:items-center md:justify-end">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            {t('hub.searchServices')}
          </label>
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hub-muted"
            aria-hidden
          />
          <input
            id={searchId}
            type="search"
            placeholder={t('hub.searchPlaceholder')}
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-surface2 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-hub-muted/80 focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FunnelIcon className="hidden h-4 w-4 text-hub-muted sm:block" aria-hidden />
          <select
            aria-label={t('filters.currency')}
            value={value.currency}
            onChange={(e) =>
              onChange({
                ...value,
                currency: e.target.value as HubFilters['currency'],
              })
            }
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {CURRENCY_VALUES.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.labelKey ? t(opt.labelKey) : opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filters.outputType')}
            value={value.outputType}
            onChange={(e) =>
              onChange({
                ...value,
                outputType: e.target.value as HubFilters['outputType'],
              })
            }
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {OUTPUT_TYPE_VALUES.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filters.sort')}
            value={sortKey}
            onChange={(e) => {
              const match = SORT_OPTIONS.find((o) => `${o.sortBy}:${o.order}` === e.target.value)
              if (match) {
                onChange({ ...value, sortBy: match.sortBy, order: match.order })
              }
            }}
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.sortBy}:${opt.order}`} value={`${opt.sortBy}:${opt.order}`}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
