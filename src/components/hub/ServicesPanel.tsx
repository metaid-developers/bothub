import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useServicesQuery, type ServicesQueryParams } from '@/api/queries'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ServiceListSkeleton } from '@/components/common/LoadingSkeleton'
import { ServiceCard } from '@/components/hub/ServiceCard'
import { t } from '@/i18n'

const SERVICES_PAGE_SIZE = 30

export interface ServicesPanelProps {
  queryParams: ServicesQueryParams
  className?: string
  freeOnly?: boolean
  onServicesLoaded?: (items: SkillServiceListItem[]) => void
  onSelectService?: (service: SkillServiceListItem) => void
  onRequestService?: (service: SkillServiceListItem) => void
  selectedServiceId?: string
}

function isFreeService(service: SkillServiceListItem): boolean {
  const price = service.price.trim()
  if (!price) return false
  const amount = Number(price)
  return Number.isFinite(amount) && amount === 0
}

export function ServicesPanel({
  queryParams,
  className,
  freeOnly = false,
  onServicesLoaded,
  onSelectService,
  onRequestService,
  selectedServiceId,
}: ServicesPanelProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const pagedQueryParams = useMemo(
    () => ({ ...queryParams, size: SERVICES_PAGE_SIZE }),
    [queryParams],
  )
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useServicesQuery(pagedQueryParams)

  const pages = useMemo(() => data?.pages ?? [], [data?.pages])
  const maxLoadedPageIndex = Math.max(0, pages.length - 1)
  const safePageIndex = Math.min(pageIndex, maxLoadedPageIndex)

  const currentPageServices = useMemo(
    () => pages[safePageIndex]?.list.slice(0, SERVICES_PAGE_SIZE) ?? [],
    [pages, safePageIndex],
  )
  const services = useMemo(
    () => (freeOnly ? currentPageServices.filter(isFreeService) : currentPageServices),
    [currentPageServices, freeOnly],
  )

  const hasPreviousPage = safePageIndex > 0
  const hasLoadedNextPage = safePageIndex < pages.length - 1
  const canGoNext = hasLoadedNextPage || Boolean(hasNextPage)

  useEffect(() => {
    onServicesLoaded?.(services)
  }, [services, onServicesLoaded])

  useEffect(() => {
    setPageIndex(0)
  }, [freeOnly, pagedQueryParams])

  useEffect(() => {
    if (pageIndex > maxLoadedPageIndex) {
      setPageIndex(maxLoadedPageIndex)
    }
  }, [maxLoadedPageIndex, pageIndex])

  async function handleNextPage() {
    if (hasLoadedNextPage) {
      setPageIndex((current) => current + 1)
      return
    }
    if (!hasNextPage || isFetchingNextPage) return
    const nextPageIndex = safePageIndex + 1
    await fetchNextPage()
    setPageIndex(nextPageIndex)
  }

  if (isLoading) {
    return <ServiceListSkeleton className={className} label={t('hub.loadingServices')} />
  }

  if (isError) {
    return (
      <ErrorState
        className={className}
        title={t('hub.servicesError')}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    )
  }

  if (services.length === 0 && !hasPreviousPage && !canGoNext) {
    return (
      <EmptyState
        className={className}
        title={t('hub.noServicesTitle')}
        description={t('hub.noServicesHint')}
      />
    )
  }

  return (
    <div className={className}>
      {services.length > 0 ? (
        <ul
          className="grid list-none gap-4 p-0 lg:grid-cols-2 xl:grid-cols-3"
          aria-label={t('hub.serviceList')}
        >
          {services.map((service) => (
            <li key={`${service.id}-${service.updatedAt}`}>
              <ServiceCard
                service={service}
                onSelect={onSelectService}
                onRequest={onRequestService ?? onSelectService}
                selected={selectedServiceId === service.id}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-hub-border bg-hub-surface px-4 py-6 text-center text-sm text-hub-muted">
          {t('hub.currentPageNoServices')}
        </p>
      )}

      <nav
        aria-label={t('hub.pagination')}
        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hub-border/70 pt-4"
      >
        <p className="text-xs text-hub-muted">
          {t('hub.pageStatus', { page: safePageIndex + 1 })}
          <span className="ml-2 text-hub-muted/70">{t('hub.pageSize')}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPreviousPage}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            className="inline-flex items-center gap-1 rounded-card border border-hub-border px-3 py-2 text-xs font-semibold text-hub-muted transition hover:bg-hub-surface2 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-hub-muted"
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
            {t('hub.previousPage')}
          </button>
          <button
            type="button"
            disabled={!canGoNext || isFetchingNextPage}
            onClick={() => void handleNextPage()}
            aria-label={t('hub.nextPage')}
            className="inline-flex items-center gap-1 rounded-card border border-hub-border px-3 py-2 text-xs font-semibold text-white transition hover:bg-hub-surface2 disabled:cursor-not-allowed disabled:text-hub-muted disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {isFetchingNextPage ? t('hub.loadingMore') : t('hub.nextPage')}
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </nav>

      {isRefetching && !isFetchingNextPage ? (
        <p className="mt-3 text-center text-xs text-hub-muted">{t('hub.loadingMore')}</p>
      ) : !canGoNext && services.length > 0 ? (
        <p className="mt-3 text-center text-xs text-hub-muted/80">{t('hub.endOfList')}</p>
      ) : null}
    </div>
  )
}
