import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { ServicesPanel } from '@/components/hub/ServicesPanel'
import listFixture from '@/mocks/aggregator/list.json'

const useServicesQuery = vi.fn()
const services = listFixture.data!.list as SkillServiceListItem[]

function serviceAt(index: number): SkillServiceListItem {
  const base = services[index % services.length]
  return {
    ...base,
    id: `${base.id}-${index + 1}`,
    sourceServicePinId: `${base.sourceServicePinId}-${index + 1}`,
    currentPinId: `${base.currentPinId}-${index + 1}`,
    displayName: `${base.displayName} ${index + 1}`,
    serviceName: `${base.serviceName}-${index + 1}`,
    updatedAt: base.updatedAt + index,
  }
}

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

  it('uses the explicit request handler for card-level request actions', () => {
    const onRequestService = vi.fn()
    const onSelectService = vi.fn()

    render(
      <ServicesPanel
        queryParams={{}}
        onSelectService={onSelectService}
        onRequestService={onRequestService}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: '下单请求' })[0])

    expect(onRequestService).toHaveBeenCalledWith(services[0])
    expect(onSelectService).not.toHaveBeenCalled()
  })

  it('requests thirty services and renders only the current page', () => {
    const firstPage = Array.from({ length: 35 }, (_, index) => serviceAt(index))
    useServicesQuery.mockReturnValue({
      data: { pages: [{ list: firstPage, nextCursor: 'next' }] },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      refetch: vi.fn(),
      isRefetching: false,
    })

    const { container } = render(<ServicesPanel queryParams={{ keyword: 'render' }} />)

    expect(useServicesQuery).toHaveBeenCalledWith({ keyword: 'render', size: 30 })
    expect(container.querySelectorAll('[data-hub-service-card]')).toHaveLength(30)
    expect(screen.getByText('第 1 页')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled()
    expect(screen.queryByText('继续滚动查看更多')).not.toBeInTheDocument()
  })

  it('filters loaded services to free price when freeOnly is selected', () => {
    const firstPage = [
      { ...serviceAt(0), displayName: 'Free service', price: '0' },
      { ...serviceAt(1), displayName: 'Paid service', price: '0.25' },
      { ...serviceAt(2), displayName: 'Also free service', price: '0.00' },
    ]
    useServicesQuery.mockReturnValue({
      data: { pages: [{ list: firstPage, nextCursor: null }] },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
      isRefetching: false,
    })

    const { container } = render(<ServicesPanel queryParams={{}} freeOnly />)

    expect(container.querySelectorAll('[data-hub-service-card]')).toHaveLength(2)
    expect(screen.getByText('Free service')).toBeInTheDocument()
    expect(screen.getByText('Also free service')).toBeInTheDocument()
    expect(screen.queryByText('Paid service')).not.toBeInTheDocument()
  })

  it('uses a three-column grid when there is enough horizontal space', () => {
    const { container } = render(<ServicesPanel queryParams={{}} />)

    expect(container.querySelector('ul[aria-label="服务列表"]')).toHaveClass('xl:grid-cols-3')
  })
})
