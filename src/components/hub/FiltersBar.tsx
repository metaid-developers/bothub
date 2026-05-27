import { useEffect, useId, useState } from 'react'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import type {
  SkillServiceCurrency,
  SkillServiceOrder,
  SkillServiceOutputType,
  SkillServiceSortBy,
} from '@/api/aggregator.types'

export interface HubFilters {
  keyword: string
  currency: SkillServiceCurrency | ''
  outputType: SkillServiceOutputType | ''
  sortBy: SkillServiceSortBy
  order: SkillServiceOrder
}

export const defaultHubFilters: HubFilters = {
  keyword: '',
  currency: '',
  outputType: '',
  sortBy: 'rating',
  order: 'desc',
}

const CURRENCIES: { value: SkillServiceCurrency | ''; label: string }[] = [
  { value: '', label: 'All currencies' },
  { value: 'SPACE', label: 'SPACE' },
  { value: 'BTC', label: 'BTC' },
  { value: 'DOGE', label: 'DOGE' },
  { value: 'MRC20', label: 'MRC20' },
]

const OUTPUT_TYPES: { value: SkillServiceOutputType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
]

const SORT_OPTIONS: { sortBy: SkillServiceSortBy; order: SkillServiceOrder; label: string }[] =
  [
    { sortBy: 'rating', order: 'desc', label: 'Top rated' },
    { sortBy: 'updated', order: 'desc', label: 'Recently updated' },
    { sortBy: 'price', order: 'asc', label: 'Price: low to high' },
    { sortBy: 'price', order: 'desc', label: 'Price: high to low' },
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
          Services
        </h1>
        <p className="mt-1 text-sm text-hub-muted">
          Browse on-chain skill services from connected bots
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:max-w-2xl lg:flex-row lg:items-center lg:justify-end">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search services
          </label>
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hub-muted"
            aria-hidden
          />
          <input
            id={searchId}
            type="search"
            placeholder="Search services…"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-surface2 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-hub-muted/80 focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FunnelIcon className="hidden h-4 w-4 text-hub-muted sm:block" aria-hidden />
          <select
            aria-label="Currency filter"
            value={value.currency}
            onChange={(e) =>
              onChange({
                ...value,
                currency: e.target.value as HubFilters['currency'],
              })
            }
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {CURRENCIES.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Output type filter"
            value={value.outputType}
            onChange={(e) =>
              onChange({
                ...value,
                outputType: e.target.value as HubFilters['outputType'],
              })
            }
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {OUTPUT_TYPES.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort services"
            value={sortKey}
            onChange={(e) => {
              const match = SORT_OPTIONS.find(
                (o) => `${o.sortBy}:${o.order}` === e.target.value,
              )
              if (match) {
                onChange({ ...value, sortBy: match.sortBy, order: match.order })
              }
            }}
            className="rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2.5 text-sm text-white focus:border-hub-accent/60 focus:outline-none focus:ring-2 focus:ring-hub-accent/25"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.label} value={`${opt.sortBy}:${opt.order}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
