import { useEffect, useMemo, useRef } from 'react'
import { useServicesQuery, type ServicesQueryParams } from '@/api/queries'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ServiceListSkeleton } from '@/components/common/LoadingSkeleton'
import { ServiceCard } from '@/components/hub/ServiceCard'
import { t } from '@/i18n'

export interface ServicesPanelProps {
  queryParams: ServicesQueryParams
  className?: string
  onServicesLoaded?: (items: SkillServiceListItem[]) => void
  onSelectService?: (service: SkillServiceListItem) => void
  onRequestService?: (service: SkillServiceListItem) => void
  selectedServiceId?: string
}

export function ServicesPanel({
  queryParams,
  className,
  onServicesLoaded,
  onSelectService,
  onRequestService,
  selectedServiceId,
}: ServicesPanelProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
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
  } = useServicesQuery(queryParams)

  const services = useMemo(
    () => data?.pages.flatMap((page) => page.list) ?? [],
    [data],
  )

  useEffect(() => {
    onServicesLoaded?.(services)
  }, [services, onServicesLoaded])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <ServiceListSkeleton
        className={className}
        label={t('hub.loadingServices')}
      />
    )
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

  if (services.length === 0) {
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
      <ul
        className="grid list-none gap-4 p-0 md:grid-cols-2"
        aria-label="Skill services"
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

      <div ref={loadMoreRef} className="h-4 w-full" aria-hidden />

      {isFetchingNextPage || isRefetching ? (
        <p className="mt-4 text-center text-sm text-hub-muted">{t('hub.loadingMore')}</p>
      ) : hasNextPage ? (
        <p className="mt-4 text-center text-sm text-hub-muted">{t('hub.scrollMore')}</p>
      ) : services.length > 0 ? (
        <p className="mt-4 text-center text-xs text-hub-muted/80">{t('hub.endOfList')}</p>
      ) : null}
    </div>
  )
}
