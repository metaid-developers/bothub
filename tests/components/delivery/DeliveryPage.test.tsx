import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryPage } from '@/routes/Delivery'
import { fetchUserProfileByGlobalMetaId } from '@/api/userProfile'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
import type { DeliveryAssetRecord } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
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
    byPeer: {} as Record<string, DeliveryMessage[]>,
    assetsBySession: {},
    selectedSessionKey: null as string | null,
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

vi.mock('@/api/userProfile', () => ({
  fetchUserProfileByGlobalMetaId: vi.fn(),
}))

vi.mock('@/delivery/decryptRetry', () => ({
  retryDecryptPeerMessages: vi.fn().mockResolvedValue({ attempted: 1, updated: 1 }),
}))

function expectBefore(first: Element, second: Element) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

const connectedWallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

function deliveryMessage(
  overrides: Partial<DeliveryMessage> & Pick<DeliveryMessage, 'peerGlobalMetaId'>,
): DeliveryMessage {
  const { peerGlobalMetaId, ...rest } = overrides
  return {
    id: `pin-${peerGlobalMetaId}`,
    peerGlobalMetaId,
    fromGlobalMetaId: peerGlobalMetaId,
    toGlobalMetaId: connectedWallet.globalMetaId,
    content: 'hello from provider',
    rawContent: 'hello from provider',
    encryption: 'plain',
    contentType: 'text/plain',
    timestamp: 1,
    pinId: `pin-${peerGlobalMetaId}`,
    ...rest,
  }
}

function deliveryAsset(overrides: Partial<DeliveryAssetRecord> = {}): DeliveryAssetRecord {
  return {
    id: `${connectedWallet.globalMetaId}:idqprovider:uncorrelated:metafile://cached.png`,
    walletGlobalMetaId: connectedWallet.globalMetaId,
    sessionId: `${connectedWallet.globalMetaId}:idqprovider:uncorrelated`,
    messageId: 'pin-idqprovider',
    uri: 'metafile://cached.png',
    pinId: 'cached',
    filename: 'cached.png',
    extension: 'png',
    kind: 'image',
    mimeType: 'image/png',
    previewUrl: 'https://file.example/cached-preview',
    downloadUrl: 'https://file.example/cached',
    fallbackUrl: 'https://file.example/cached-fallback',
    createdAt: 1,
    ...overrides,
  }
}

function renderDeliveryPage(initialEntry = '/delivery') {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <DeliveryPage />
    </MemoryRouter>,
  )
}

describe('DeliveryPage layout', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('indexedDB', undefined)
    mocks.walletState.identity = null
    mocks.walletState.status = 'disconnected'
    mocks.messageState.byPeer = {}
    mocks.messageState.assetsBySession = {}
    mocks.messageState.selectedSessionKey = null
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({})
    vi.mocked(retryDecryptPeerMessages).mockResolvedValue({ attempted: 1, updated: 1 })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('orders the mobile workspace as orders, header, timeline, assets, then composer', () => {
    renderDeliveryPage()

    const orders = screen.getByRole('heading', { name: '我的请求' })
    const header = screen.getByRole('status', { name: '选择一个请求查看交付' })
    const timeline = screen.getAllByText('选择一个请求查看交付进度')[0]
    const assets = screen.getByRole('heading', { name: '成果库' })
    const composer = screen.getByRole('textbox', { name: '补充需求或询问进度' })

    expectBefore(orders, header)
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
          peerName: 'Provider',
          peerAvatarUrl: 'https://cdn.example/provider.png',
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

    renderDeliveryPage()

    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    expect(screen.getByText('连接钱包后可继续沟通')).toBeInTheDocument()
    expect(screen.queryByText('Connect wallet to reply')).not.toBeInTheDocument()
  })

  it('fetches and displays selected peer profile even when the session already has a chat key', async () => {
    const peerGlobalMetaId = 'idq133unvv8x62807jsdg7mwwpyfc4pnv6zqzeuv2n'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: peerGlobalMetaId,
      name: '余生请多指教',
      avatarUrl:
        '/meta-socket/api/v1/users/avatar/accelerate/37efeed000000000000000000000000000000000000000000000000000000000i0?process=thumbnail',
      chatPubkey: '049759',
    })
    mocks.walletState.identity = {
      globalMetaId: 'idqbuyer',
      mvcAddress: '1BuyerMvc',
      btcAddress: 'bc1buyer',
      dogeAddress: 'Dbuyer',
    }
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        {
          id: 'pin-provider-message',
          peerGlobalMetaId,
          peerChatPubkey: '049759',
          fromGlobalMetaId: peerGlobalMetaId,
          toGlobalMetaId: 'idqbuyer',
          content: 'hello from provider',
          rawContent: 'hello from provider',
          encryption: 'plain',
          contentType: 'text/plain',
          timestamp: 1,
          pinId: 'pin-provider-message',
        },
      ],
    }

    renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(peerGlobalMetaId)
    expect(await screen.findAllByText('余生请多指教')).toHaveLength(3)
    expect(screen.getAllByRole('img', { name: '余生请多指教 头像' })).toHaveLength(3)
    expect(screen.queryByLabelText('idq133…uv2n 头像')).not.toBeInTheDocument()
  })

  it('hydrates the selected peer profile and retries decrypting failed ciphertext', async () => {
    const peerGlobalMetaId = 'idqprovider'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: peerGlobalMetaId,
      name: 'Provider Keyholder',
      avatarUrl: 'https://cdn.example/provider-keyholder.png',
      chatPubkey: 'profile-key',
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          id: 'pin-encrypted',
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
        }),
      ],
    }

    renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    await waitFor(() =>
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(peerGlobalMetaId),
    )
    await waitFor(() =>
      expect(retryDecryptPeerMessages).toHaveBeenCalledWith({
        walletIdentity: connectedWallet,
        peerGlobalMetaId,
        peerProfile: {
          chatPubkey: 'profile-key',
          name: 'Provider Keyholder',
          avatarUrl: 'https://cdn.example/provider-keyholder.png',
        },
      }),
    )
  })

  it('fetches a cached-identity disconnected profile without retrying decrypt', async () => {
    const peerGlobalMetaId = 'idqdisconnected-provider'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: peerGlobalMetaId,
      name: 'Disconnected Provider',
      avatarUrl: 'https://cdn.example/disconnected-provider.png',
      chatPubkey: 'disconnected-profile-key',
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'disconnected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
        }),
      ],
    }

    const view = renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    await waitFor(() =>
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(peerGlobalMetaId),
    )
    expect(await screen.findAllByText('Disconnected Provider')).toBeDefined()
    expect(retryDecryptPeerMessages).not.toHaveBeenCalled()

    mocks.walletState.status = 'connected'
    view.rerender(
      <MemoryRouter
        initialEntries={[`/delivery?session=${peerGlobalMetaId}`]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(retryDecryptPeerMessages).toHaveBeenCalledWith({
        walletIdentity: connectedWallet,
        peerGlobalMetaId,
        peerProfile: {
          chatPubkey: 'disconnected-profile-key',
          name: 'Disconnected Provider',
          avatarUrl: 'https://cdn.example/disconnected-provider.png',
        },
      }),
    )
    expect(retryDecryptPeerMessages).toHaveBeenCalledTimes(1)

    view.rerender(
      <MemoryRouter
        initialEntries={[`/delivery?session=${peerGlobalMetaId}`]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(retryDecryptPeerMessages).toHaveBeenCalledTimes(1))
  })

  it('hydrates visible session profiles beyond the selected session', async () => {
    vi.mocked(fetchUserProfileByGlobalMetaId).mockImplementation(async (peerGlobalMetaId) => ({
      globalMetaId: peerGlobalMetaId,
      name: peerGlobalMetaId === 'idqprovider-a' ? 'Provider Alpha' : 'Provider Beta',
      avatarUrl:
        peerGlobalMetaId === 'idqprovider-a'
          ? 'https://cdn.example/provider-alpha.png'
          : 'https://cdn.example/provider-beta.png',
      chatPubkey: peerGlobalMetaId === 'idqprovider-a' ? 'alpha-key' : 'beta-key',
    }))
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      'idqselected-complete': [
        deliveryMessage({
          peerGlobalMetaId: 'idqselected-complete',
          peerChatPubkey: 'selected-key',
          peerName: 'Selected Complete',
          peerAvatarUrl: 'https://cdn.example/selected-complete.png',
          timestamp: 3,
        }),
      ],
      'idqprovider-a': [
        deliveryMessage({
          peerGlobalMetaId: 'idqprovider-a',
          timestamp: 2,
        }),
      ],
      'idqprovider-b': [
        deliveryMessage({
          peerGlobalMetaId: 'idqprovider-b',
          timestamp: 1,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    await waitFor(() => {
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith('idqprovider-a')
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith('idqprovider-b')
    })
    expect(fetchUserProfileByGlobalMetaId).not.toHaveBeenCalledWith('idqselected-complete')
    expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(2)
    const orderList = screen.getByRole('list', { name: '我的请求' })
    expect(await within(orderList).findByText('Provider Alpha')).toBeInTheDocument()
    expect(await within(orderList).findByText('Provider Beta')).toBeInTheDocument()
    expect(
      within(orderList).getByRole('img', { name: 'Provider Alpha 头像' }),
    ).toBeInTheDocument()
    expect(
      within(orderList).getByRole('img', { name: 'Provider Beta 头像' }),
    ).toBeInTheDocument()
  })

  it('does not spend the decrypt retry key on plain visible profile hydration', async () => {
    const peerGlobalMetaId = 'idqprovider-visible-plain'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: peerGlobalMetaId,
      name: 'Visible Plain Provider',
      avatarUrl: 'https://cdn.example/visible-plain-provider.png',
      chatPubkey: 'visible-plain-key',
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      'idqselected-complete': [
        deliveryMessage({
          peerGlobalMetaId: 'idqselected-complete',
          peerChatPubkey: 'selected-key',
          peerName: 'Selected Complete',
          peerAvatarUrl: 'https://cdn.example/selected-complete.png',
          timestamp: 2,
        }),
      ],
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          timestamp: 1,
        }),
      ],
    }

    const view = renderDeliveryPage('/delivery')

    await waitFor(() =>
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(peerGlobalMetaId),
    )
    const sessionList = screen.getByRole('list', { name: '我的请求' })
    expect(await within(sessionList).findByText('Visible Plain Provider')).toBeInTheDocument()
    expect(
      within(sessionList).getByRole('img', { name: 'Visible Plain Provider 头像' }),
    ).toBeInTheDocument()
    expect(retryDecryptPeerMessages).not.toHaveBeenCalled()

    mocks.messageState.selectedSessionKey = peerGlobalMetaId
    mocks.messageState.byPeer = {
      'idqselected-complete': mocks.messageState.byPeer['idqselected-complete'],
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
          timestamp: 3,
        }),
      ],
    }
    view.rerender(
      <MemoryRouter
        initialEntries={['/delivery']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(retryDecryptPeerMessages).toHaveBeenCalledWith({
        walletIdentity: connectedWallet,
        peerGlobalMetaId,
        peerProfile: {
          chatPubkey: 'visible-plain-key',
          name: 'Visible Plain Provider',
          avatarUrl: 'https://cdn.example/visible-plain-provider.png',
        },
      }),
    )
    expect(retryDecryptPeerMessages).toHaveBeenCalledTimes(1)
  })

  it('caps visible hydration after filtering to missing peer profiles', async () => {
    const completeSessions = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const peerGlobalMetaId = `idqcomplete-${index + 1}`
        return [
          peerGlobalMetaId,
          [
            deliveryMessage({
              peerGlobalMetaId,
              peerChatPubkey: `complete-key-${index + 1}`,
              peerName: `Complete Provider ${index + 1}`,
              peerAvatarUrl: `https://cdn.example/complete-${index + 1}.png`,
              timestamp: 30 - index,
            }),
          ],
        ]
      }),
    )
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: 'idqmissing-after-complete',
      name: 'Missing After Complete',
      avatarUrl: 'https://cdn.example/missing-after-complete.png',
      chatPubkey: 'missing-after-complete-key',
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      ...completeSessions,
      'idqmissing-after-complete': [
        deliveryMessage({
          peerGlobalMetaId: 'idqmissing-after-complete',
          timestamp: 1,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    await waitFor(() =>
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith('idqmissing-after-complete'),
    )
    expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1)
  })

  it('does not repeatedly refetch a rejected profile request for the same peer', async () => {
    const peerGlobalMetaId = 'idqprovider-rejects'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockRejectedValue(new Error('profile offline'))
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
        }),
      ],
    }

    const view = renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1))
    view.rerender(
      <MemoryRouter
        initialEntries={[`/delivery?session=${peerGlobalMetaId}`]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1))
    expect(retryDecryptPeerMessages).not.toHaveBeenCalled()
  })

  it('does not let attempted duplicate visible peers starve another missing peer', async () => {
    const attemptedPeer = 'idqattempted-duplicate'
    const nextPeer = 'idqmissing-next'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockImplementation(async (peerGlobalMetaId) => {
      if (peerGlobalMetaId === attemptedPeer) {
        throw new Error('profile offline')
      }
      return {
        globalMetaId: nextPeer,
        name: 'Next Missing Provider',
        avatarUrl: 'https://cdn.example/next-missing-provider.png',
        chatPubkey: 'next-missing-key',
      }
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [attemptedPeer]: [
        deliveryMessage({
          peerGlobalMetaId: attemptedPeer,
          timestamp: 40,
        }),
      ],
    }

    const view = renderDeliveryPage('/delivery')

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(attemptedPeer))
    expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1)

    mocks.messageState.byPeer = {
      [attemptedPeer]: Array.from({ length: 12 }, (_, index) =>
        deliveryMessage({
          id: `pin-${attemptedPeer}-${index + 1}`,
          peerGlobalMetaId: attemptedPeer,
          orderCorrelationId: `order-${index + 1}`,
          timestamp: 40 - index,
        }),
      ),
      [nextPeer]: [
        deliveryMessage({
          peerGlobalMetaId: nextPeer,
          timestamp: 1,
        }),
      ],
    }
    view.rerender(
      <MemoryRouter
        initialEntries={['/delivery']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(nextPeer))
    expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(2)
    const orderList = screen.getByRole('list', { name: '我的请求' })
    expect(await within(orderList).findByText('Next Missing Provider')).toBeInTheDocument()
  })

  it('does not repeatedly refetch an empty profile in the same mounted page session', async () => {
    const peerGlobalMetaId = 'idqprovider-empty'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({})
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
        }),
      ],
    }

    const view = renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1))
    view.rerender(
      <MemoryRouter
        initialEntries={[`/delivery?session=${peerGlobalMetaId}`]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <DeliveryPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1))
    expect(retryDecryptPeerMessages).not.toHaveBeenCalled()
  })

  it('shows session-only historical messages with buyer-safe service copy', () => {
    const peerGlobalMetaId = 'idqhistorical-provider'
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'Older delivery note',
          rawContent: 'Older delivery note',
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    const orderList = screen.getByRole('list', { name: '我的请求' })
    expect(within(orderList).getAllByText('历史交付').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Unknown service/i)).not.toBeInTheDocument()
  })

  it('keeps locally cached assets visible when provider profile lookup fails', async () => {
    const peerGlobalMetaId = 'idqasset-provider'
    const sessionId = `${connectedWallet.globalMetaId}:${peerGlobalMetaId}:uncorrelated`
    vi.mocked(fetchUserProfileByGlobalMetaId).mockRejectedValue(new Error('profile offline'))
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'Cached delivery asset is available locally',
          rawContent: 'Cached delivery asset is available locally',
        }),
      ],
    }
    mocks.messageState.assetsBySession = {
      [sessionId]: [
        deliveryAsset({
          id: `${sessionId}:metafile://cached.png`,
          sessionId,
          messageId: `pin-${peerGlobalMetaId}`,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    expect(await screen.findByText('cached.png')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://file.example/cached',
    )
  })

  it('allows a manual provider key retry after an empty profile response', async () => {
    const peerGlobalMetaId = 'idqprovider-manual'
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({})
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          content: 'U2FsdGVkX19ciphertext',
          rawContent: 'U2FsdGVkX19ciphertext',
          encryption: 'ecdh',
          decryptError: 'missing peer key',
        }),
      ],
    }

    renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '同步资料技术详情' }))
    fireEvent.click(screen.getByRole('button', { name: '重试同步资料' }))

    await waitFor(() => expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(2))
  })

  it('uses buyer-facing delivery copy instead of implementation copy', () => {
    renderDeliveryPage()

    expect(screen.getByRole('heading', { name: '我的交付' })).toBeInTheDocument()
    expect(
      screen.queryByText(/simplemsg|Socket\.IO|meta-socket|chat key|ciphertext|session/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Wallet not connected|Connect wallet to reply|Message provider/i),
    ).not.toBeInTheDocument()
  })
})
