import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { ServicesPanel } from '@/components/hub/ServicesPanel'
import listFixture from '@/mocks/aggregator/list.json'

const useServicesQuery = vi.fn()
const services = listFixture.data!.list as SkillServiceListItem[]

vi.mock('@/api/queries', () => ({
  useServicesQuery: (...args: unknown[]) => useServicesQuery(...args),
}))

describe('ServicesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useServicesQuery.mockReturnValue({
      data: { pages: [{ list: services, nextCursor: null }] },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
      isRefetching: false,
    })
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      })),
    )
  })

  it('uses the explicit request handler for card-level Pay & Request', () => {
    const onRequestService = vi.fn()
    const onSelectService = vi.fn()

    render(
      <ServicesPanel
        queryParams={{}}
        onSelectService={onSelectService}
        onRequestService={onRequestService}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Pay & Request' })[0])

    expect(onRequestService).toHaveBeenCalledWith(services[0])
    expect(onSelectService).not.toHaveBeenCalled()
  })
})
