import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SkillServiceDetailData } from '@/api/aggregator.types'
import { ServiceDetailPanel } from '@/components/hub/ServiceDetailPanel'
import detailFixture from '@/mocks/aggregator/detail.json'

const detailData = detailFixture.data as SkillServiceDetailData

const useServiceDetailQuery = vi.fn()
const useWallet = vi.fn()

vi.mock('@/api/queries', () => ({
  useServiceDetailQuery: (...args: unknown[]) => useServiceDetailQuery(...args),
}))

vi.mock('@/wallet/useWallet', () => ({
  useWallet: (selector: (state: { status: string }) => unknown) =>
    useWallet(selector),
}))

function renderPanel(
  props: Partial<ComponentProps<typeof ServiceDetailPanel>> = {},
) {
  const onClose = props.onClose ?? vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return {
    onClose,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceDetailPanel
            serviceId="pin-zhuwei-current-001"
            rating={{ avg: 4.8, count: 12 }}
            onClose={onClose}
            {...props}
          />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  }
}

describe('ServiceDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useServiceDetailQuery.mockReturnValue({
      data: detailData,
      isLoading: false,
      isError: false,
      error: null,
    })
    useWallet.mockImplementation((selector: (state: { status: string }) => unknown) =>
      selector({ status: 'disconnected' }),
    )
  })

  it('renders detail fields from useServiceDetailQuery in a dialog', () => {
    renderPanel()

    expect(useServiceDetailQuery).toHaveBeenCalledWith('pin-zhuwei-current-001')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: detailData.service.displayName }),
    ).toBeInTheDocument()
    expect(screen.getByText(detailData.service.description)).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('native')).toBeInTheDocument()
    expect(screen.getByText('mvc')).toBeInTheDocument()
    expect(screen.getByText('Fortune Bot')).toBeInTheDocument()
    expect(screen.getByText('truncated')).toBeInTheDocument()
    expect(
      screen.getByLabelText(`Rating 4.8 from 12 reviews`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/deliverable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/example/i)).not.toBeInTheDocument()
  })

  it('keeps Pay & Request available with a connect-required hint when wallet is not connected', () => {
    renderPanel()

    const payButton = screen.getByRole('button', { name: 'Pay & Request' })
    expect(payButton).toBeEnabled()
    expect(payButton).toHaveAttribute('title', expect.stringMatching(/Metalet|Connect|连接/))
  })

  it('enables Pay & Request when wallet is connected', () => {
    useWallet.mockImplementation(
      (selector: (state: { status: string; identity: unknown }) => unknown) =>
        selector({
          status: 'connected',
          identity: {
            globalMetaId: 'idq1test',
            mvcAddress: '1Mvc',
            btcAddress: 'bc1q',
            dogeAddress: 'D',
          },
        }),
    )
    renderPanel()

    expect(screen.getByRole('button', { name: 'Pay & Request' })).toBeEnabled()
  })

  it('opens request modal when Pay & Request is clicked', () => {
    useWallet.mockImplementation(
      (selector: (state: { status: string; identity: unknown }) => unknown) =>
        selector({
          status: 'connected',
          identity: {
            globalMetaId: 'idq1test',
            mvcAddress: '1Mvc',
            btcAddress: 'bc1q',
            dogeAddress: 'D',
          },
        }),
    )
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Pay & Request' }))
    expect(screen.getByRole('dialog', { name: /pay & request/i })).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderPanel()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose from the close button', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close service detail' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows loading state while query is pending', async () => {
    useServiceDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    })
    renderPanel()

    expect(screen.getByLabelText('Loading service details')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(detailData.service.displayName)).not.toBeInTheDocument()
    })
  })
})
