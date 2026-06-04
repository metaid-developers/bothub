import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryPage } from '@/routes/Delivery'
import { fetchUserProfileByGlobalMetaId } from '@/api/userProfile'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
import type { BuyerOrder, DeliveryAssetRecord, DeliverySessionRecord } from '@/delivery/domain'
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
    appendOutgoingFollowUp: vi.fn().mockResolvedValue(undefined),
  },
  sendDeliveryFollowUp: vi.fn(),
  getOrdersForWallet: vi.fn(),
  loadDeliveryWorkspaceRecords: vi.fn(),
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
  normalizeAvatarUrl: (value?: string) => value?.trim() || undefined,
}))

vi.mock('@/delivery/decryptRetry', () => ({
  retryDecryptPeerMessages: vi.fn().mockResolvedValue({ attempted: 1, updated: 1 }),
}))

vi.mock('@/delivery/sendMessage', () => ({
  sendDeliveryFollowUp: (...args: unknown[]) => mocks.sendDeliveryFollowUp(...args),
}))

vi.mock('@/delivery/db', () => ({
  getOrdersForWallet: (...args: unknown[]) => mocks.getOrdersForWallet(...args),
}))

vi.mock('@/delivery/workspaceRecovery', () => ({
  loadDeliveryWorkspaceRecords: (...args: unknown[]) =>
    mocks.loadDeliveryWorkspaceRecords(...args),
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

function buyerOrder(overrides: Partial<BuyerOrder> = {}): BuyerOrder {
  return {
    id: `${connectedWallet.globalMetaId}:idqprovider:order-alpha`,
    walletGlobalMetaId: connectedWallet.globalMetaId,
    providerGlobalMetaId: 'idqprovider',
    serviceId: 'svc-delivery',
    serviceName: 'Delivery Skill',
    skillName: 'delivery-skill',
    outputType: 'text',
    rawRequest: 'Alpha request',
    displaySummary: 'Alpha request',
    price: '0',
    currency: 'SPACE',
    settlementKind: 'native',
    paymentChain: 'mvc',
    orderPinId: 'order-alpha',
    status: 'in_progress',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
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

function deliverySession(overrides: Partial<DeliverySessionRecord> = {}): DeliverySessionRecord {
  return {
    id: `${connectedWallet.globalMetaId}:idqprovider:order-alpha`,
    walletGlobalMetaId: connectedWallet.globalMetaId,
    providerGlobalMetaId: 'idqprovider',
    providerChatPubkey: 'provider-key',
    providerName: 'Provider One',
    providerAvatarUrl: 'https://cdn.example/provider-one.png',
    orderCorrelationId: 'order-alpha',
    serviceId: 'svc-delivery',
    serviceLabel: 'Delivery Skill',
    status: 'active',
    lastMessageId: 'pin-idqprovider',
    lastActivityAt: 1,
    assetCount: 0,
    unreadCount: 0,
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
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('indexedDB', undefined)
    mocks.walletState.identity = null
    mocks.walletState.status = 'disconnected'
    mocks.messageState.byPeer = {}
    mocks.messageState.assetsBySession = {}
    mocks.messageState.selectedSessionKey = null
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({})
    vi.mocked(retryDecryptPeerMessages).mockResolvedValue({ attempted: 1, updated: 1 })
    mocks.messageState.appendOutgoingFollowUp.mockResolvedValue(undefined)
    mocks.getOrdersForWallet.mockResolvedValue([])
    mocks.loadDeliveryWorkspaceRecords.mockResolvedValue({
      orders: [],
      sessions: [],
      assetsBySession: {},
    })
    mocks.sendDeliveryFollowUp.mockResolvedValue({
      pinId: 'pin-follow-up',
      encryptedContent: 'encrypted-follow-up',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides the delivery intro copy so the workspace is the first visible page area', () => {
    renderDeliveryPage()

    expect(screen.queryByRole('heading', { name: '我的交付' })).not.toBeInTheDocument()
    expect(screen.getByText('查看请求进度，预览和保存服务方交付的数字成果。')).not.toBeVisible()
    expect(screen.getByLabelText('我的交付工作区')).toBeVisible()
  })

  it('orders the mobile workspace as conversations, header, timeline, assets, then composer', () => {
    renderDeliveryPage()

    const orders = screen.getByRole('heading', { name: '服务方会话' })
    const header = screen.getByRole('status', { name: '选择一个服务方会话' })
    const timeline = screen.getAllByText('这个服务方的沟通和交付记录会显示在这里。')[0]
    const assets = screen.getByRole('heading', { name: '成果库' })
    const composer = screen.getByRole('textbox', { name: '补充需求或询问进度' })

    expectBefore(orders, header)
    expectBefore(header, timeline)
    expectBefore(timeline, assets)
    expectBefore(assets, composer)
  })

  it('keeps delivery navigation and composer fixed while panes scroll internally', () => {
    const { container } = renderDeliveryPage()

    const page = screen.getByLabelText('我的交付')
    const workspace = screen.getByLabelText('我的交付工作区')
    const conversationPane = screen.getByLabelText('服务方会话')
    const conversationScroll = container.querySelector('[data-delivery-conversation-scroll]')
    const threadScroll = container.querySelector('[data-delivery-thread-scroll]')
    const tabs = screen.getByRole('tablist', { name: '交付请求' })
    const composer = screen.getByRole('form', { name: '交付沟通输入框' })

    expect(page).toHaveClass('overflow-hidden')
    expect(workspace).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden')
    expect(conversationPane).toHaveClass('min-h-0', 'overflow-hidden')
    expect(conversationScroll).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(threadScroll).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(conversationScroll).toHaveClass('hub-scrollbar')
    expect(threadScroll).toHaveClass('hub-scrollbar')
    expect(tabs).toHaveClass('hub-scrollbar')
    expect(screen.getByLabelText('成果库')).toHaveClass('hub-scrollbar')
    expect(tabs).toHaveClass('shrink-0')
    expect(composer).toHaveClass('shrink-0')
  })

  it('opens a selected conversation scrolled to the latest message', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 1200,
    })
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      idqprovider: [
        deliveryMessage({
          id: 'pin-oldest',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: 'Oldest message',
          rawContent: 'Oldest message',
          timestamp: 1,
        }),
        deliveryMessage({
          id: 'pin-latest',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: 'Latest message',
          rawContent: 'Latest message',
          timestamp: 2,
        }),
      ],
    }

    const { container } = renderDeliveryPage('/delivery?session=idqprovider')
    const threadScroll = container.querySelector('[data-delivery-thread-scroll]') as HTMLElement

    await waitFor(() => expect(threadScroll.scrollTop).toBe(1200))
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
    const conversationList = screen.getByRole('list', { name: '服务方会话' })
    expect(await within(conversationList).findByText('Provider Alpha')).toBeInTheDocument()
    expect(await within(conversationList).findByText('Provider Beta')).toBeInTheDocument()
    expect(
      within(conversationList).getByRole('img', { name: 'Provider Alpha 头像' }),
    ).toBeInTheDocument()
    expect(
      within(conversationList).getByRole('img', { name: 'Provider Beta 头像' }),
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
    const sessionList = screen.getByRole('list', { name: '服务方会话' })
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
    const conversationList = screen.getByRole('list', { name: '服务方会话' })
    expect(await within(conversationList).findByText('Next Missing Provider')).toBeInTheDocument()
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

    const conversationList = screen.getByRole('list', { name: '服务方会话' })
    expect(within(conversationList).getByRole('button', { name: peerGlobalMetaId })).toBeInTheDocument()
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

    expect(screen.getByRole('region', { name: '我的交付' })).toBeInTheDocument()
    expect(
      screen.queryByText(/simplemsg|Socket\.IO|meta-socket|chat key|ciphertext|session/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Wallet not connected|Connect wallet to reply|Message provider/i),
    ).not.toBeInTheDocument()
  })

  it('groups multiple orders for one provider into one conversation row with All and order tabs', () => {
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      idqprovider: [
        deliveryMessage({
          id: 'pin-order-alpha',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          peerAvatarUrl: 'https://cdn.example/provider-one.png',
          content: '[ORDER] Alpha request\norder id: order-alpha',
          rawContent: '[ORDER] Alpha request\norder id: order-alpha',
          orderCorrelationId: 'order-alpha',
          timestamp: 1,
        }),
        deliveryMessage({
          id: 'pin-order-beta',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          peerAvatarUrl: 'https://cdn.example/provider-one.png',
          content: '[ORDER] Beta request\norder id: order-beta',
          rawContent: '[ORDER] Beta request\norder id: order-beta',
          orderCorrelationId: 'order-beta',
          timestamp: 2,
        }),
        deliveryMessage({
          id: 'pin-chat',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          peerAvatarUrl: 'https://cdn.example/provider-one.png',
          content: 'General provider note',
          rawContent: 'General provider note',
          timestamp: 3,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    const conversationList = screen.getByRole('list', { name: '服务方会话' })
    expect(within(conversationList).getAllByRole('button', { name: 'Provider One' })).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Alpha request/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Beta request/ })).toBeInTheDocument()
    expect(screen.getAllByText('General provider note').length).toBeGreaterThan(0)
  })

  it('shows the composer only in All and sends All follow-ups without an order correlation', async () => {
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      idqprovider: [
        deliveryMessage({
          id: 'pin-order-alpha',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[ORDER] Alpha request\norder id: order-alpha',
          rawContent: '[ORDER] Alpha request\norder id: order-alpha',
          orderCorrelationId: 'order-alpha',
          timestamp: 1,
        }),
        deliveryMessage({
          id: 'pin-general',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: 'General provider note',
          rawContent: 'General provider note',
          timestamp: 2,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    const composer = screen.getByRole('textbox', { name: '补充需求或询问进度' })
    fireEvent.change(composer, { target: { value: 'Please continue in general chat.' } })
    const sendButton = screen.getByRole('button', { name: '发送' })
    await waitFor(() => expect(sendButton).toBeEnabled())
    fireEvent.click(sendButton)

    await waitFor(() => expect(mocks.sendDeliveryFollowUp).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.messageState.appendOutgoingFollowUp).toHaveBeenCalledTimes(1))
    expect(mocks.messageState.appendOutgoingFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          peerGlobalMetaId: 'idqprovider',
          orderCorrelationId: null,
          serviceLabel: null,
        }),
      }),
    )

    fireEvent.click(screen.getByRole('tab', { name: /Alpha request/ }))

    expect(screen.queryByRole('textbox', { name: '补充需求或询问进度' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()
  })

  it('resolves a legacy session URL to the provider conversation and matching order tab', () => {
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      idqprovider: [
        deliveryMessage({
          id: 'pin-order-alpha',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[ORDER] Alpha request\norder id: order-alpha',
          rawContent: '[ORDER] Alpha request\norder id: order-alpha',
          orderCorrelationId: 'order-alpha',
          timestamp: 1,
        }),
        deliveryMessage({
          id: 'pin-order-beta',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[ORDER] Beta request\norder id: order-beta',
          rawContent: '[ORDER] Beta request\norder id: order-beta',
          orderCorrelationId: 'order-beta',
          timestamp: 2,
        }),
      ],
    }

    renderDeliveryPage('/delivery?session=idqprovider:order-beta')

    expect(screen.getByRole('tab', { name: /Beta request/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /Beta request/ })).toBeInTheDocument()
    expect(screen.getAllByText('Beta request').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alpha request').length).toBeGreaterThan(0)
  })

  it('hydrates an aliased order header from the canonical provider profile and keeps composer usable', async () => {
    const providerAddress = '1ProviderAddress'
    const providerCanonical = 'idqproviderCanonical'
    const order = buyerOrder({
      id: `${connectedWallet.globalMetaId}:${providerAddress}:order-pin-1`,
      providerGlobalMetaId: providerAddress,
      providerChatPubkey: 'same-chat-key',
      providerName: undefined,
      providerAvatarUrl: undefined,
      serviceName: 'Render Skill',
      displaySummary: 'Render a launch card',
      rawRequest: 'Render a launch card',
      orderPinId: 'order-pin-1',
    })
    vi.stubGlobal('indexedDB', {})
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.getOrdersForWallet.mockResolvedValue([order])
    vi.mocked(fetchUserProfileByGlobalMetaId).mockImplementation(async (peerGlobalMetaId) => {
      if (peerGlobalMetaId === providerCanonical) {
        return {
          globalMetaId: providerCanonical,
          name: 'Canonical Render Bot',
          avatarUrl: 'https://cdn.example/canonical-render-bot.png',
          chatPubkey: 'same-chat-key',
        }
      }
      return {}
    })
    mocks.messageState.byPeer = {
      [providerCanonical]: [
        deliveryMessage({
          id: 'alias-chat',
          peerGlobalMetaId: providerCanonical,
          peerChatPubkey: 'same-chat-key',
          content: 'Alias side message',
          rawContent: 'Alias side message',
          timestamp: 2,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    await waitFor(() =>
      expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(providerCanonical),
    )
    await waitFor(() =>
      expect(screen.getAllByText('Canonical Render Bot').length).toBeGreaterThanOrEqual(2),
    )
    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeEnabled()

    fireEvent.click(await screen.findByRole('tab', { name: /Render Skill/ }))

    await waitFor(() =>
      expect(screen.getAllByText('Canonical Render Bot').length).toBeGreaterThanOrEqual(3),
    )
    expect(screen.queryByText(providerAddress.slice(0, 12))).not.toBeInTheDocument()
  })

  it('switches asset library scope labels between All and an order tab', async () => {
    const order = buyerOrder({
      serviceName: 'Render Skill',
      displaySummary: 'Render a launch card',
      rawRequest: 'Render a launch card',
      providerName: 'Canonical Render Bot',
      orderPinId: 'order-alpha',
    })
    vi.stubGlobal('indexedDB', {})
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.getOrdersForWallet.mockResolvedValue([order])
    mocks.loadDeliveryWorkspaceRecords.mockResolvedValue({
      orders: [],
      sessions: [],
      assetsBySession: {
        [order.id]: [
          deliveryAsset({
            id: `${order.id}:metafile://render.png`,
            sessionId: order.id,
            messageId: 'order-alpha',
            orderCorrelationId: 'order-alpha',
            uri: 'metafile://render.png',
            filename: 'render.png',
          }),
        ],
      },
    })

    renderDeliveryPage('/delivery')

    expect(await screen.findByText('全部 - Canonical Render Bot')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('tab', { name: /Render Skill/ }))

    expect(screen.getByText('当前请求 - Render Skill')).toBeInTheDocument()
  })

  it('shows and copies the stored local session id as the conversation id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const conversationId = `${connectedWallet.globalMetaId}:idqprovider:order-alpha`
    vi.stubGlobal('indexedDB', {})
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.loadDeliveryWorkspaceRecords.mockResolvedValue({
      orders: [],
      sessions: [deliverySession({ id: conversationId })],
      assetsBySession: {},
    })

    renderDeliveryPage('/delivery?session=idqprovider:order-alpha')

    expect(await screen.findByText(conversationId)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '复制对话 ID' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(conversationId))
    expect(screen.getByText('已复制')).toBeInTheDocument()
  })

  it('falls back to peer and buyer Global Meta ID prefixes when no local session id exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const peerGlobalMetaId = 'idqpeerabcdefgh'
    const buyerGlobalMetaId = 'idqbuyerabcdefgh'
    const fallbackConversationId = 'idqpeera-idqbuyer'
    mocks.walletState.identity = {
      ...connectedWallet,
      globalMetaId: buyerGlobalMetaId,
    }
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      [peerGlobalMetaId]: [
        deliveryMessage({
          peerGlobalMetaId,
          peerName: 'Fallback Provider',
        }),
      ],
    }

    renderDeliveryPage(`/delivery?session=${peerGlobalMetaId}`)

    expect(screen.getByText(fallbackConversationId)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '复制对话 ID' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(fallbackConversationId))
    expect(screen.getByText('已复制')).toBeInTheDocument()
  })

  it('shows order protocol messages in All and the matching order tab', () => {
    mocks.walletState.identity = connectedWallet
    mocks.walletState.status = 'connected'
    mocks.messageState.byPeer = {
      idqprovider: [
        deliveryMessage({
          id: 'pin-order-alpha',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[ORDER] Alpha request\norder id: order-alpha',
          rawContent: '[ORDER] Alpha request\norder id: order-alpha',
          orderCorrelationId: 'order-alpha',
          timestamp: 1,
        }),
        deliveryMessage({
          id: 'pin-order-end',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[ORDER_END:order-alpha] Completed',
          rawContent: '[ORDER_END:order-alpha] Completed',
          timestamp: 2,
        }),
        deliveryMessage({
          id: 'pin-needs-rating',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: '[NeedsRating:order-alpha] Rating will be requested later',
          rawContent: '[NeedsRating:order-alpha] Rating will be requested later',
          timestamp: 3,
        }),
        deliveryMessage({
          id: 'pin-general',
          peerGlobalMetaId: 'idqprovider',
          peerChatPubkey: 'provider-key',
          peerName: 'Provider One',
          content: 'General All-only message',
          rawContent: 'General All-only message',
          timestamp: 4,
        }),
      ],
    }

    renderDeliveryPage('/delivery')

    expect(screen.getByRole('status', { name: '订单已完成' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '评价待开放' })).toBeInTheDocument()
    expect(screen.getAllByText('General All-only message').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: /Alpha request/ }))

    expect(screen.getByRole('status', { name: '订单已完成' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '评价待开放' })).toBeInTheDocument()
    const orderMessages = screen.getByText('消息记录').closest('details')
    expect(orderMessages).not.toBeNull()
    expect(within(orderMessages as HTMLElement).queryByText('General All-only message')).not.toBeInTheDocument()
  })
})
