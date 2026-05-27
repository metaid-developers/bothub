import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getServiceDetail, listServices } from '@/api/aggregator'
import type { GetServiceDetailParams, ListServicesParams } from '@/api/aggregator.types'

export type ServicesQueryParams = Omit<ListServicesParams, 'cursor'>

export function servicesQueryKey(params: ServicesQueryParams = {}) {
  return ['bot-hub', 'skill-services', params] as const
}

export function serviceDetailQueryKey(
  serviceId: string,
  params?: GetServiceDetailParams,
) {
  return ['bot-hub', 'skill-service-detail', serviceId, params ?? {}] as const
}

export function useServicesQuery(params: ServicesQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: servicesQueryKey(params),
    queryFn: ({ pageParam }) =>
      listServices({
        ...params,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useServiceDetailQuery(
  serviceId: string | undefined,
  params?: GetServiceDetailParams,
) {
  return useQuery({
    queryKey: serviceDetailQueryKey(serviceId ?? '', params),
    queryFn: () => getServiceDetail(serviceId!, params),
    enabled: Boolean(serviceId),
  })
}
