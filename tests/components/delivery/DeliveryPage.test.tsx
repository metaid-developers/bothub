import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryPage } from '@/routes/Delivery'

const mocks = vi.hoisted(() => ({
  walletState: {
    identity: null,
    status: 'disconnected',
  },
  socketState: {
    status: 'disconnected',
    lastError: null,
  },
  messageState: {
    byPeer: {},
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
    const composer = screen.getByRole('textbox', {
      name: 'Follow-up composer coming in Task 7',
    })

    expectBefore(sessions, header)
    expectBefore(header, timeline)
    expectBefore(timeline, assets)
    expectBefore(assets, composer)
  })
})
