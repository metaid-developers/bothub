import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import { RequestModal } from '@/components/hub/RequestModal'
import { useMessageStore } from '@/delivery/messageStore'
import {
  PayAndRequestBroadcastError,
  type ExecutePayAndRequestResult,
} from '@/order/flow'
import type { PreparedPayAndRequest } from '@/order/payAndRequestStages'
import * as metalet from '@/wallet/metalet'
import type { WalletIdentity } from '@/wallet/types'

const navigate = vi.fn()
const executePayAndRequest = vi.fn()
const persistPendingOrder = vi.fn()
const persistFailedToSendOrder = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('@/order/flow', async () => {
  const actual = await vi.importActual<typeof import('@/order/flow')>('@/order/flow')
  return {
    ...actual,
    executePayAndRequest: (...args: unknown[]) => executePayAndRequest(...args),
  }
})

vi.mock('@/delivery/orderStore', () => ({
  persistPendingOrder: (...args: unknown[]) => persistPendingOrder(...args),
  persistFailedToSendOrder: (...args: unknown[]) => persistFailedToSendOrder(...args),
}))

vi.mock('@/wallet/metalet', () => ({
  ensureReady: vi.fn(),
  transfer: vi.fn(),
  ecdh: vi.fn(),
  createPin: vi.fn(),
}))

const wallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

const provider: ProviderInfo = {
  metaid: 'provider-metaid',
  globalMetaId: 'idqprovider',
  address: '1Provider',
  name: 'Fortune Bot',
  avatar: null,
  chatPubkey: '04' + 'ab'.repeat(64),
}

const service: SkillServiceCore = {
  id: 'svc-1',
  currentPinId: 'svc-current',
  sourceServicePinId: 'svc-source',
  serviceName: 'fortune-reading',
  displayName: 'Fortune Reading',
  description: 'desc',
  serviceIcon: '',
  providerSkill: 'fortune-skill',
  outputType: 'text',
  price: '0',
  currency: 'SPACE',
  settlementKind: 'native',
  paymentChain: 'mvc',
  mrc20Ticker: null,
  mrc20Id: null,
  paymentAddress: '1Payment',
  status: 0,
  operation: 'create',
  disabled: false,
  chainName: 'mvc',
  createdAt: 0,
  updatedAt: 0,
}

const result: ExecutePayAndRequestResult = {
  paymentTxid: '',
  paymentCommitTxid: '',
  orderReference: 'order-ref-1',
  orderPinId: 'pin-order-1',
  sessionKey: 'idqprovider:order-ref-1',
  orderPayload: '[ORDER] Fortune Reading',
  displaySummary: 'Fortune Reading',
}

describe('RequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMessageStore.setState({ byPeer: {}, assetsBySession: {}, selectedSessionKey: null })
    executePayAndRequest.mockResolvedValue(result)
    persistPendingOrder.mockResolvedValue({})
    persistFailedToSendOrder.mockResolvedValue({})
    vi.mocked(metalet.ensureReady).mockResolvedValue({
      globalMetaId: wallet.globalMetaId,
      mvcAddress: wallet.mvcAddress,
      btcAddress: wallet.btcAddress,
      dogeAddress: wallet.dogeAddress,
    })
    vi.spyOn(useMessageStore.getState(), 'hydrateFromDb').mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists the pending order and hydrates before navigating to Delivery', async () => {
    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/delivery?session=idqprovider%3Aorder-ref-1'),
    )

    expect(persistPendingOrder).toHaveBeenCalledWith({
      wallet,
      service,
      provider,
      prompt: 'Tell me my fortune',
      result,
    })
    expect(useMessageStore.getState().hydrateFromDb).toHaveBeenCalledWith(wallet.globalMetaId)
    expect(persistPendingOrder.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0],
    )
    expect(
      (
        useMessageStore.getState().hydrateFromDb as unknown as {
          mock: { invocationCallOrder: number[] }
        }
      ).mock.invocationCallOrder[0],
    ).toBeLessThan(navigate.mock.invocationCallOrder[0])
    expect(metalet.ensureReady).toHaveBeenCalledWith(wallet.globalMetaId)
    expect(vi.mocked(metalet.ensureReady).mock.invocationCallOrder[0]).toBeLessThan(
      executePayAndRequest.mock.invocationCallOrder[0],
    )
  })

  it('persists a resolved free order without a returned pin id as pending, not failed', async () => {
    const resolvedWithoutPin: ExecutePayAndRequestResult = {
      ...result,
      orderPinId: '',
      sessionKey: 'idqprovider:order-ref-without-pin',
      orderReference: 'order-ref-without-pin',
    }
    executePayAndRequest.mockResolvedValue(resolvedWithoutPin)

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/delivery?session=idqprovider%3Aorder-ref-without-pin',
      ),
    )

    expect(persistPendingOrder).toHaveBeenCalledWith({
      wallet,
      service,
      provider,
      prompt: 'Tell me my fortune',
      result: resolvedWithoutPin,
    })
    expect(persistFailedToSendOrder).not.toHaveBeenCalled()
    expect(screen.queryByText(/free order message failed/i)).not.toBeInTheDocument()
  })

  it('blocks stale connected wallet state before creating an order', async () => {
    vi.mocked(metalet.ensureReady).mockRejectedValue(
      new Error('Metalet wallet did not respond to ping. Reload Metalet and try again.'),
    )

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    expect(await screen.findByText(/did not respond to ping/i)).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(persistPendingOrder).not.toHaveBeenCalled()
  })

  it('still navigates after order success when pending persistence fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    persistPendingOrder.mockRejectedValue(new Error('IndexedDB unavailable'))

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/delivery?session=idqprovider%3Aorder-ref-1'),
    )

    expect(executePayAndRequest).toHaveBeenCalledTimes(1)
    expect(useMessageStore.getState().hydrateFromDb).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      'Order was sent but could not be saved locally.',
      expect.any(Error),
    )
  })

  it('shows a connect-required message before attempting payment when wallet is missing', async () => {
    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={null}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    expect(await screen.findByText(/connect your metalet wallet/i)).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
  })

  it('persists a recoverable failed_to_send row when payment succeeds but broadcast fails', async () => {
    const partial: PreparedPayAndRequest = {
      service: { ...service, price: '1' },
      provider,
      prompt: 'Paid fortune',
      payment: {
        paymentTxid: 'paid-txid-1',
        paymentCommitTxid: '',
        orderReference: '',
      },
      orderPayload: '[ORDER] Paid fortune\ntxid: paid-txid-1',
      encryptedContent: 'ciphertext',
      simplemsgBody: '{"content":"ciphertext"}',
      sessionKey: 'idqprovider:paid-txid-1',
      displaySummary: 'Paid fortune',
    }
    executePayAndRequest.mockRejectedValue(
      new PayAndRequestBroadcastError('Order pin broadcast failed', partial),
    )

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={{ ...service, price: '1' }}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    expect(
      await screen.findByText(/payment succeeded but the order message failed/i),
    ).toBeInTheDocument()
    expect(persistFailedToSendOrder).toHaveBeenCalledWith({
      wallet,
      service: { ...service, price: '1' },
      provider,
      prompt: 'Paid fortune',
      partial,
    })
    expect(useMessageStore.getState().hydrateFromDb).toHaveBeenCalledWith(wallet.globalMetaId)
    fireEvent.click(screen.getByRole('button', { name: /open delivery/i }))
    expect(navigate).toHaveBeenCalledWith('/delivery?session=idqprovider%3Apaid-txid-1')
  })

  it('uses free-order recovery wording when a free order broadcast fails', async () => {
    const partial: PreparedPayAndRequest = {
      service,
      provider,
      prompt: 'Free fortune',
      payment: {
        paymentTxid: '',
        paymentCommitTxid: '',
        orderReference: 'free-order-ref-1',
      },
      orderPayload: '[ORDER] Free fortune\norder id: free-order-ref-1',
      encryptedContent: 'ciphertext',
      simplemsgBody: '{"content":"ciphertext"}',
      sessionKey: 'idqprovider:free-order-ref-1',
      displaySummary: 'Free fortune',
    }
    executePayAndRequest.mockRejectedValue(
      new PayAndRequestBroadcastError('Order pin broadcast failed', partial),
    )

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={service}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/describe what you need/i), {
      target: { value: 'Free fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & pay/i }))

    expect(
      await screen.findByText(/order message failed/i),
    ).toHaveTextContent(
      'The free order message failed. The request was saved in Delivery for recovery.',
    )
    expect(
      screen.queryByText(/payment succeeded but the order message failed/i),
    ).not.toBeInTheDocument()
    expect(persistFailedToSendOrder).toHaveBeenCalledWith({
      wallet,
      service,
      provider,
      prompt: 'Free fortune',
      partial,
    })
  })
})
