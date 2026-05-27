import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ServicesQueryParams } from '@/api/queries'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import {
  defaultHubFilters,
  FiltersBar,
  type HubFilters,
} from '@/components/hub/FiltersBar'
import { OnlineBotsSidebar } from '@/components/hub/OnlineBotsSidebar'
import {
  ServiceDetailPanel,
  type ServiceDetailRating,
} from '@/components/hub/ServiceDetailPanel'
import { ServicesPanel } from '@/components/hub/ServicesPanel'

const SERVICE_SEARCH_PARAM = 'service'

function toQueryParams(filters: HubFilters): ServicesQueryParams {
  return {
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.outputType ? { outputType: filters.outputType } : {}),
    sortBy: filters.sortBy,
    order: filters.order,
  }
}

export function useSelectedServiceId(): [
  string | undefined,
  (id: string | undefined) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedServiceId = searchParams.get(SERVICE_SEARCH_PARAM) ?? undefined

  const setSelectedServiceId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) {
            next.set(SERVICE_SEARCH_PARAM, id)
          } else {
            next.delete(SERVICE_SEARCH_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return [selectedServiceId, setSelectedServiceId]
}

export function BotHubPage() {
  const [filters, setFilters] = useState<HubFilters>(defaultHubFilters)
  const [pageServices, setPageServices] = useState<SkillServiceListItem[]>([])
  const [selectedServiceId, setSelectedServiceId] = useSelectedServiceId()

  const queryParams = useMemo(() => toQueryParams(filters), [filters])

  const selectedRating = useMemo((): ServiceDetailRating | null => {
    if (!selectedServiceId) return null
    const item = pageServices.find((s) => s.id === selectedServiceId)
    if (!item || item.ratingCount <= 0) return null
    return { avg: item.ratingAvg, count: item.ratingCount }
  }, [pageServices, selectedServiceId])

  const handleServicesLoaded = useCallback((items: SkillServiceListItem[]) => {
    setPageServices(items)
  }, [])

  const handleSelectService = useCallback(
    (service: SkillServiceListItem) => {
      setSelectedServiceId(service.id)
    },
    [setSelectedServiceId],
  )

  const handleCloseDetail = useCallback(() => {
    setSelectedServiceId(undefined)
  }, [setSelectedServiceId])

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <OnlineBotsSidebar services={pageServices} />

      <div className="min-w-0 flex-1">
        <FiltersBar value={filters} onChange={setFilters} />
        <ServicesPanel
          queryParams={queryParams}
          onServicesLoaded={handleServicesLoaded}
          onSelectService={handleSelectService}
          selectedServiceId={selectedServiceId}
        />
      </div>

      <div className="hidden w-80 shrink-0 xl:block">
        {selectedServiceId ? (
          <ServiceDetailPanel
            serviceId={selectedServiceId}
            rating={selectedRating}
            onClose={handleCloseDetail}
          />
        ) : (
          <aside
            className="sticky top-20 rounded-card border border-dashed border-hub-border/80 bg-hub-surface/40 px-5 py-12 text-center"
            aria-label="Service detail"
          >
            <p className="font-display text-sm font-medium text-hub-muted">Select a service</p>
            <p className="mt-2 text-xs leading-relaxed text-hub-muted/70">
              Choose a card to view pricing, provider profile, and Pay &amp; Request.
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
