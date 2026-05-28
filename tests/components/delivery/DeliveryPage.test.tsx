import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryPage } from '@/routes/Delivery'
import type { WalletIdentity } from '@/wallet/types'

const mocks = vi.hoisted(() => ({
  walletState: {
    identity: null as WalletIdentity | null,
    status: 'disconnected',
  },
  socketState: {
    status: 'disconnected',
    lastError: null,
  },
  messageState: {
    byPeer: {},
    assetsBySession: {},
    selectedSessionKey: null,
    setSelectedSession: vi.fn(),
    hydrateFromDb: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn(() => []),
    messagesForSession: vi.fn(() => []),
  },
}))

vi.mock('@/wallet/useWallet', () => ({
  useWallet: (selector: (state: typeof mocks.walletState) => unknown) =>
    selector(mocks.walletState),
}))

vi.mock('@/ws/useSocket', () => ({
  useSocket: (selector: (state: typeof mocks.socketState) => unknown) =>
    selector(mocks.socketState),
}))

vi.mock('@/delivery/messageStore', () => ({
  useMessageStore: (selector: (state: typeof mocks.messageState) => unknown) =>
    selector(mocks.messageState),
}))

function expectBefore(first: Element, second: Element) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

describe('DeliveryPage layout', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    mocks.walletState.identity = null
    mocks.walletState.status = 'disconnected'
    mocks.messageState.byPeer = {}
    mocks.messageState.assetsBySession = {}
    mocks.messageState.selectedSessionKey = null
    vi.clearAllMocks()
  })

  it('orders the mobile workspace as sessions, header, timeline, assets, then composer', () => {
    render(
      <MemoryRouter initialEntries={['/delivery']}>
        <DeliveryPage />
      </MemoryRouter>,
    )

    const sessions = screen.getByRole('heading', { name: 'Sessions' })
    const header = screen.getByRole('status', { name: 'No delivery session selected' })
    const timeline = screen.getByText('Select a session to view messages')
    const assets = screen.getByRole('heading', { name: 'Delivered assets' })
    const composer = screen.getByRole('textbox', { name: 'Message provider' })

    expectBefore(sessions, header)
    expectBefore(header, timeline)
    expectBefore(timeline, assets)
    expectBefore(assets, composer)
  })

  it('keeps the composer wallet-gated when a disconnected wallet has a cached identity', () => {
    mocks.walletState.identity = {
      globalMetaId: 'idqbuyer',
      mvcAddress: '1BuyerMvc',
      btcAddress: 'bc1buyer',
      dogeAddress: 'Dbuyer',
    }
    mocks.walletState.status = 'disconnected'
    mocks.messageState.byPeer = {
      idqprovider: [
        {
          id: 'pin-order',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: '04' + 'ab'.repeat(64),
          fromGlobalMetaId: 'idqbuyer',
          toGlobalMetaId: 'idqprovider',
          content: '[ORDER] Cached identity order\norder id: order-1',
          rawContent: '[ORDER] Cached identity order\norder id: order-1',
          encryption: 'plain',
          contentType: 'text/plain',
          orderCorrelationId: 'order-1',
          timestamp: 1,
          pinId: 'pin-order',
        },
      ],
    }

    render(
      <MemoryRouter initialEntries={['/delivery']}>
        <DeliveryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('textbox', { name: 'Message provider' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Connect wallet to reply')).toBeInTheDocument()
  })
})
