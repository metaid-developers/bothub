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
import { useWallet } from '@/wallet/useWallet'

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
    useWallet.setState({
      identity: null,
      status: 'disconnected',
      errorMessage: null,
    })
    executePayAndRequest.mockResolvedValue(result)
    persistPendingOrder.mockResolvedValue({
      order: { id: 'idqbuyer:idqprovider:order-ref-1' },
    })
    persistFailedToSendOrder.mockResolvedValue({
      order: { id: 'idqbuyer:idqprovider:failed-order' },
    })
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
    delete window.__bothubLastCreatePinDiagnostic
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/delivery?order=idqbuyer%3Aidqprovider%3Aorder-ref-1',
      ),
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

  it('navigates a persisted paid order using the payment txid correlation id', async () => {
    const paidService = { ...service, price: '1' }
    const paidResult: ExecutePayAndRequestResult = {
      ...result,
      paymentTxid: 'paid-txid-1',
      orderReference: '',
      sessionKey: 'idqprovider:paid-txid-1',
      orderPayload: '[ORDER] Paid fortune\ntxid: paid-txid-1',
    }
    executePayAndRequest.mockResolvedValue(paidResult)
    persistPendingOrder.mockResolvedValueOnce({
      order: { id: 'idqbuyer:idqprovider:paid-txid-1' },
    })

    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={paidService}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/delivery?order=idqbuyer%3Aidqprovider%3Apaid-txid-1',
      ),
    )

    expect(persistPendingOrder).toHaveBeenCalledWith({
      wallet,
      service: paidService,
      provider,
      prompt: 'Paid fortune',
      result: paidResult,
    })
  })

  it('persists a resolved free order without a returned pin id as pending, not failed', async () => {
    const resolvedWithoutPin: ExecutePayAndRequestResult = {
      ...result,
      orderPinId: '',
      sessionKey: 'idqprovider:order-ref-without-pin',
      orderReference: 'order-ref-without-pin',
    }
    executePayAndRequest.mockResolvedValue(resolvedWithoutPin)
    persistPendingOrder.mockResolvedValueOnce({
      order: { id: 'idqbuyer:idqprovider:order-ref-without-pin' },
    })

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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/delivery?order=idqbuyer%3Aidqprovider%3Aorder-ref-without-pin',
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
    expect(screen.queryByText(/免费请求暂时发送失败/)).not.toBeInTheDocument()
  })

  it('blocks stale connected wallet state before creating an order', async () => {
    useWallet.setState({
      identity: wallet,
      status: 'connected',
      errorMessage: null,
    })
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText('钱包连接已失效，请重新连接 Metalet 后再下单。'),
    ).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(persistPendingOrder).not.toHaveBeenCalled()
    expect(useWallet.getState().identity).toBeNull()
    expect(useWallet.getState().status).toBe('disconnected')
  })

  it('clears global wallet state when checkout preflight finds Metalet is disconnected', async () => {
    useWallet.setState({
      identity: wallet,
      status: 'connected',
      errorMessage: null,
    })
    vi.mocked(metalet.ensureReady).mockRejectedValue(
      new Error('Metalet wallet is not connected to this site. Connect Metalet and try again.'),
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText('钱包连接已失效，请重新连接 Metalet 后再下单。'),
    ).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(useWallet.getState().identity).toBeNull()
    expect(useWallet.getState().status).toBe('disconnected')
    expect(useWallet.getState().errorMessage).toBeNull()
  })

  it('does not clear global wallet state for non-readiness checkout errors', async () => {
    useWallet.setState({
      identity: wallet,
      status: 'connected',
      errorMessage: null,
    })
    vi.mocked(metalet.ensureReady).mockRejectedValue(new Error('Order encryption failed'))

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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(await screen.findByText('下单失败，请稍后重试。')).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(useWallet.getState().identity).toEqual(wallet)
    expect(useWallet.getState().status).toBe('connected')
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

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

  it('keeps order navigation when hydration fails after pending persistence succeeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(useMessageStore.getState().hydrateFromDb).mockRejectedValueOnce(
      new Error('hydrate failed'),
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/delivery?order=idqbuyer%3Aidqprovider%3Aorder-ref-1',
      ),
    )

    expect(console.warn).toHaveBeenCalledWith(
      'Order was saved locally but could not hydrate Delivery.',
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Tell me my fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(await screen.findByText(/连接 Metalet 钱包后即可下单/)).toBeInTheDocument()
    expect(executePayAndRequest).not.toHaveBeenCalled()
  })

  it('blocks checkout before wallet or payment prompts when the provider chat key is missing', async () => {
    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={{ ...service, price: '1' }}
          provider={{ ...provider, chatPubkey: null }}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(/服务方暂时无法接单/),
    ).toBeInTheDocument()
    expect(metalet.ensureReady).not.toHaveBeenCalled()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(persistPendingOrder).not.toHaveBeenCalled()
  })

  it('blocks paid MRC20 checkout with buyer-facing copy before wallet or payment prompts', async () => {
    render(
      <MemoryRouter>
        <RequestModal
          open
          onClose={vi.fn()}
          service={{
            ...service,
            price: '1',
            currency: 'MRC20',
            settlementKind: 'mrc20',
            paymentChain: 'btc',
            mrc20Ticker: 'DEMO',
            mrc20Id: 'mrc20-genesis-id-demo',
          }}
          provider={provider}
          wallet={wallet}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'MRC20 fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(
        '暂不支持 MRC20 服务下单，请选择原生币或免费服务。',
      ),
    ).toBeInTheDocument()
    expect(metalet.ensureReady).not.toHaveBeenCalled()
    expect(executePayAndRequest).not.toHaveBeenCalled()
    expect(persistPendingOrder).not.toHaveBeenCalled()
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
    persistFailedToSendOrder.mockResolvedValueOnce({
      order: { id: 'idqbuyer:idqprovider:paid-txid-1' },
    })
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(/付款已完成，但请求消息未成功发送/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/payment succeeded but the order message failed/i),
    ).not.toBeInTheDocument()
    expect(persistFailedToSendOrder).toHaveBeenCalledWith({
      wallet,
      service: { ...service, price: '1' },
      provider,
      prompt: 'Paid fortune',
      partial,
    })
    expect(useMessageStore.getState().hydrateFromDb).toHaveBeenCalledWith(wallet.globalMetaId)
    fireEvent.click(screen.getByRole('button', { name: '打开我的交付' }))
    expect(navigate).toHaveBeenCalledWith(
      '/delivery?order=idqbuyer%3Aidqprovider%3Apaid-txid-1',
    )
  })

  it('keeps recoverable order navigation when hydration fails after failed-order persistence succeeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
    persistFailedToSendOrder.mockResolvedValueOnce({
      order: { id: 'idqbuyer:idqprovider:paid-txid-1' },
    })
    vi.mocked(useMessageStore.getState().hydrateFromDb).mockRejectedValueOnce(
      new Error('hydrate failed'),
    )
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(/付款已完成，但请求消息未成功发送/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开我的交付' }))

    expect(navigate).toHaveBeenCalledWith(
      '/delivery?order=idqbuyer%3Aidqprovider%3Apaid-txid-1',
    )
    expect(console.warn).toHaveBeenCalledWith(
      'Failed order was saved locally but could not hydrate Delivery.',
      expect.any(Error),
    )
  })

  it('does not offer Delivery recovery when a paid failed order cannot be saved locally', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
    persistFailedToSendOrder.mockRejectedValueOnce(new Error('IndexedDB unavailable'))
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Paid fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(/本地恢复记录也未能保存/),
    ).toHaveTextContent('支付参考：paid-txid-1')
    expect(screen.queryByRole('button', { name: '打开我的交付' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '无法保存恢复记录' })).toBeDisabled()
    expect(console.warn).toHaveBeenCalledWith(
      'Failed order could not be saved locally.',
      expect.any(Error),
    )
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Free fortune' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    expect(
      await screen.findByText(/免费请求暂时发送失败/),
    ).toHaveTextContent(
      '免费请求暂时发送失败，已在我的交付中保存，可继续处理。',
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

  it('shows sanitized createPin diagnostics behind dev-only details after a recoverable broadcast failure', async () => {
    const partial: PreparedPayAndRequest = {
      service,
      provider,
      prompt: 'Free diagnostic',
      payment: {
        paymentTxid: '',
        paymentCommitTxid: '',
        orderReference: 'free-order-ref-2',
      },
      orderPayload: '[ORDER] Free diagnostic\norder id: free-order-ref-2',
      encryptedContent: 'ciphertext',
      simplemsgBody: '{"content":"ciphertext"}',
      sessionKey: 'idqprovider:free-order-ref-2',
      displaySummary: 'Free diagnostic',
    }
    window.__bothubLastCreatePinDiagnostic = {
      at: '2026-06-01T00:00:00.000Z',
      phase: 'failure_envelope',
      serviceId: service.id,
      serviceName: service.serviceName,
      providerGlobalMetaId: provider.globalMetaId,
      providerName: provider.name ?? '',
      paymentTxid: '',
      orderReference: 'free-order-ref-2',
      sessionKey: 'idqprovider:free-order-ref-2',
      resolvedPinId: '',
      failureMessage: 'user canceled',
      errorName: '',
      errorMessage: '',
      txidCandidates: [],
      resultShape: { type: 'object', keys: ['error'] },
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

    fireEvent.change(screen.getByLabelText('填写你的需求'), {
      target: { value: 'Free diagnostic' },
    })
    fireEvent.click(screen.getByRole('button', { name: '检查订单' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并下单' }))

    fireEvent.click(await screen.findByText('发单诊断详情'))

    expect(screen.getByText(/failure_envelope/)).toBeInTheDocument()
    expect(screen.getByText(/user canceled/)).toBeInTheDocument()
    expect(screen.queryByText(/ciphertext/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[ORDER\]/)).not.toBeInTheDocument()
  })
})
