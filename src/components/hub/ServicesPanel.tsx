import { useEffect, useMemo, useRef } from 'react'
import { clsx } from 'clsx'
import { useServicesQuery, type ServicesQueryParams } from '@/api/queries'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { ServiceCard } from '@/components/hub/ServiceCard'

function ServiceCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-card border border-hub-border bg-hub-surface p-4"
      aria-hidden
    >
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-xl bg-hub-surface2" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-hub-surface2" />
          <div className="h-3 w-1/2 rounded bg-hub-surface2" />
          <div className="h-8 w-full rounded bg-hub-surface2" />
        </div>
      </div>
      <div className="mt-4 h-10 rounded-xl bg-hub-surface2" />
    </div>
  )
}

export interface ServicesPanelProps {
  queryParams: ServicesQueryParams
  className?: string
  onServicesLoaded?: (items: SkillServiceListItem[]) => void
  onSelectService?: (service: SkillServiceListItem) => void
  selectedServiceId?: string
}

export function ServicesPanel({
  queryParams,
  className,
  onServicesLoaded,
  onSelectService,
  selectedServiceId,
}: ServicesPanelProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useServicesQuery(queryParams)

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
      <div
        className={clsx('grid gap-4 sm:grid-cols-2', className)}
        aria-busy="true"
        aria-label="Loading services"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className={clsx(
          'rounded-card border border-red-500/30 bg-red-950/20 px-4 py-8 text-center text-sm text-red-200',
          className,
        )}
        role="alert"
      >
        Could not load services
        {error instanceof Error ? (
          <p className="mt-2 text-xs text-red-300/80">{error.message}</p>
        ) : null}
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <div
        className={clsx(
          'rounded-card border border-dashed border-hub-border bg-hub-surface/50 px-6 py-16 text-center',
          className,
        )}
      >
        <p className="font-display text-lg font-semibold text-white">No services found</p>
        <p className="mt-2 text-sm text-hub-muted">Try clearing filters or another keyword.</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2" aria-label="Skill services">
        {services.map((service) => (
          <li key={`${service.id}-${service.updatedAt}`}>
            <ServiceCard
              service={service}
              onSelect={onSelectService}
              selected={selectedServiceId === service.id}
            />
          </li>
        ))}
      </ul>

      <div ref={loadMoreRef} className="h-4 w-full" aria-hidden />

      {isFetchingNextPage ? (
        <p className="mt-4 text-center text-sm text-hub-muted">Loading more…</p>
      ) : hasNextPage ? (
        <p className="mt-4 text-center text-sm text-hub-muted">Scroll for more</p>
      ) : services.length > 0 ? (
        <p className="mt-4 text-center text-xs text-hub-muted/80">End of list</p>
      ) : null}
    </div>
  )
}
