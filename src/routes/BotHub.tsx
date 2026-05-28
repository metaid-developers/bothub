import { useCallback, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
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
import { t } from '@/i18n'

const SERVICE_SEARCH_PARAM = 'service'
const BOTS_SIDEBAR_ID = 'hub-online-bots'

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
  const [botsOpen, setBotsOpen] = useState(false)
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
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setBotsOpen((open) => !open)}
            aria-expanded={botsOpen}
            aria-controls={BOTS_SIDEBAR_ID}
            className="flex w-full items-center justify-between rounded-card border border-hub-border bg-hub-surface px-4 py-3 text-sm font-semibold text-white"
          >
            {t('hub.toggleBots')}
            {botsOpen ? (
              <ChevronUpIcon className="h-5 w-5 text-hub-muted" aria-hidden />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-hub-muted" aria-hidden />
            )}
          </button>
          {botsOpen ? (
            <div className="mt-3">
              <OnlineBotsSidebar services={pageServices} id={BOTS_SIDEBAR_ID} />
            </div>
          ) : null}
        </div>

        <OnlineBotsSidebar
          services={pageServices}
          id={BOTS_SIDEBAR_ID}
          className="hidden md:flex md:w-56 lg:w-60"
        />

        <div className="min-w-0 flex-1">
          <FiltersBar value={filters} onChange={setFilters} />
          <ServicesPanel
            queryParams={queryParams}
            onServicesLoaded={handleServicesLoaded}
            onSelectService={handleSelectService}
            selectedServiceId={selectedServiceId}
          />
        </div>
      </div>

      {selectedServiceId ? (
        <ServiceDetailPanel
          serviceId={selectedServiceId}
          rating={selectedRating}
          onClose={handleCloseDetail}
        />
      ) : null}
    </>
  )
}
