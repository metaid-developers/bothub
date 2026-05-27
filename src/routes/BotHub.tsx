import { useCallback, useMemo, useState } from 'react'
import type { ServicesQueryParams } from '@/api/queries'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import {
  defaultHubFilters,
  FiltersBar,
  type HubFilters,
} from '@/components/hub/FiltersBar'
import { OnlineBotsSidebar } from '@/components/hub/OnlineBotsSidebar'
import { ServicesPanel } from '@/components/hub/ServicesPanel'

function toQueryParams(filters: HubFilters): ServicesQueryParams {
  return {
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.outputType ? { outputType: filters.outputType } : {}),
    sortBy: filters.sortBy,
    order: filters.order,
  }
}

/** M4: detail panel selection — placeholder until ServiceDetailPanel ships */
export function useSelectedServiceId(): [
  string | undefined,
  (id: string | undefined) => void,
] {
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>()
  return [selectedServiceId, setSelectedServiceId]
}

export function BotHubPage() {
  const [filters, setFilters] = useState<HubFilters>(defaultHubFilters)
  const [pageServices, setPageServices] = useState<SkillServiceListItem[]>([])
  const [, setSelectedServiceId] = useSelectedServiceId()

  const queryParams = useMemo(() => toQueryParams(filters), [filters])

  const handleServicesLoaded = useCallback((items: SkillServiceListItem[]) => {
    setPageServices(items)
  }, [])

  const handleSelectService = useCallback(
    (service: SkillServiceListItem) => {
      setSelectedServiceId(service.id)
    },
    [setSelectedServiceId],
  )

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <OnlineBotsSidebar services={pageServices} />

      <div className="min-w-0 flex-1">
        <FiltersBar value={filters} onChange={setFilters} />
        <ServicesPanel
          queryParams={queryParams}
          onServicesLoaded={handleServicesLoaded}
          onSelectService={handleSelectService}
        />
      </div>

      <aside
        className="hidden w-72 shrink-0 xl:block"
        aria-label="Service detail"
        data-m4-placeholder
      >
        <div className="sticky top-20 rounded-card border border-dashed border-hub-border/80 bg-hub-surface/40 px-5 py-12 text-center">
          <p className="font-display text-sm font-medium text-hub-muted">
            Select a service
          </p>
          <p className="mt-2 text-xs leading-relaxed text-hub-muted/70">
            Details and Pay &amp; Request flow open here in the next milestone.
          </p>
        </div>
      </aside>
    </div>
  )
}
