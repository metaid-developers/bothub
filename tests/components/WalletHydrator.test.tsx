import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletHydrator } from '@/components/WalletHydrator'
import { useWallet } from '@/wallet/useWallet'
import * as metalet from '@/wallet/metalet'

const mocks = vi.hoisted(() => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  setSelectedSession: vi.fn(),
  startHydrating: vi.fn(),
  failSync: vi.fn(),
  startSyncing: vi.fn(),
  finishSync: vi.fn(),
  resetSync: vi.fn(),
  hydrateDeliveryForWallet: vi.fn(async () => undefined),
  syncKnownPrivateChatHistory: vi.fn(async () => ({ failedPeers: [] })),
}))

vi.mock('@/wallet/metalet', () => ({
  isMetaletInstalled: vi.fn(() => true),
  waitForMetaletInstalled: vi.fn(async () => true),
  on: vi.fn(),
  removeListener: vi.fn(),
}))

vi.mock('@/ws/useSocket', () => ({
  useSocket: (
    selector: (state: {
      connect: typeof mocks.connectSocket
      disconnect: typeof mocks.disconnectSocket
    }) => unknown,
  ) =>
    selector({
      connect: mocks.connectSocket,
      disconnect: mocks.disconnectSocket,
    }),
}))

vi.mock('@/delivery/messageStore', () => ({
  useMessageStore: {
    getState: () => ({
      setSelectedSession: mocks.setSelectedSession,
    }),
  },
}))

vi.mock('@/delivery/syncStatusStore', () => ({
  useDeliverySyncStatusStore: {
    getState: () => ({
      startHydrating: mocks.startHydrating,
      failSync: mocks.failSync,
      startSyncing: mocks.startSyncing,
      finishSync: mocks.finishSync,
      reset: mocks.resetSync,
    }),
  },
}))

vi.mock('@/delivery/deliverySync', () => ({
  hydrateDeliveryForWallet: mocks.hydrateDeliveryForWallet,
  syncKnownPrivateChatHistory: mocks.syncKnownPrivateChatHistory,
}))

describe('WalletHydrator', () => {
  const originalWalletState = useWallet.getState()

  beforeEach(() => {
    vi.clearAllMocks()
    useWallet.setState({
      ...originalWalletState,
      identity: null,
      status: 'disconnected',
      errorMessage: null,
    })
  })

  it('syncs wallet state when Metalet reports an account change', async () => {
    const hydrateFromMetalet = vi.fn(async () => undefined)
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1active',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
      },
      status: 'connected',
      hydrateFromMetalet,
    })

    render(
      <WalletHydrator>
        <div>child content</div>
      </WalletHydrator>,
    )

    expect(screen.getByText('child content')).toBeInTheDocument()
    await waitFor(() => {
      expect(metalet.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function))
    })

    const handler = vi
      .mocked(metalet.on)
      .mock.calls.find(([eventName]) => eventName === 'accountsChanged')?.[1]
    expect(handler).toBeTypeOf('function')

    hydrateFromMetalet.mockClear()
    await act(async () => {
      await handler?.()
    })

    expect(hydrateFromMetalet).toHaveBeenCalledOnce()
  })
})
