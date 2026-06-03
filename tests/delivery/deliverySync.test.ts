import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { clearTestSessionStorage } from '../setup'
import {
  DELIVERY_DB_NAME,
  getAssetsForSession,
  getMessagesForSession,
  getSessionsForWallet,
  getSyncState,
  putMessage,
  putOrder,
  putSession,
  putSyncState,
} from '@/delivery/db'
import {
  hydrateDeliveryForWallet,
  mergePrivateChatItem,
  syncKnownPrivateChatHistory,
} from '@/delivery/deliverySync'
import { persistPendingOrder } from '@/delivery/orderStore'
import { persistDeliveryMessage, useMessageStore } from '@/delivery/messageStore'
import type { WalletIdentity } from '@/wallet/types'
import { WS_SERVER_NOTIFY_PRIVATE_CHAT, type SocketEnvelope } from '@/ws/envelope'
import type { PrivateChatItem } from '@/ws/privateChat'
import { useSocket } from '@/ws/useSocket'
import { listPrivateChatHistory, listPrivateChatHomes } from '@/api/privateChat'
import { decryptIncoming } from '@/delivery/decrypt'
import { fetchUserProfileByGlobalMetaId } from '@/api/userProfile'

vi.mock('@/delivery/decrypt', () => ({
  decryptIncoming: vi.fn(async ({ content }: { content: string }) => ({
    plaintext: content,
  })),
}))

vi.mock('@/api/privateChat', async () => {
  const actual = await vi.importActual<typeof import('@/api/privateChat')>(
    '@/api/privateChat',
  )
  return {
    ...actual,
    listPrivateChatHomes: vi.fn(),
    listPrivateChatHistory: vi.fn(),
  }
})

vi.mock('@/api/userProfile', async () => {
  const actual = await vi.importActual<typeof import('@/api/userProfile')>(
    '@/api/userProfile',
  )
  return {
    ...actual,
    fetchUserProfileByGlobalMetaId: vi.fn(),
  }
})

const SELF = 'idqself'
const MVC_SELF = '1SelfMvcAddress'
const PEER = 'idqprovider'
const wallet: WalletIdentity = {
  globalMetaId: SELF,
  mvcAddress: MVC_SELF,
  btcAddress: 'bc1self',
  dogeAddress: 'Dself',
}

function privateChatItem(overrides: Partial<PrivateChatItem> = {}): PrivateChatItem {
  return {
    fromGlobalMetaId: PEER,
    toGlobalMetaId: SELF,
    fromUserInfo: { chatPublicKey: 'provider-chat-key' },
    content:
      '[DELIVERY:order-sync] {"result":"Ready","assets":["metafile://sync.png"]}',
    contentType: 'text/plain',
    encryption: 'plain',
    timestamp: 1_700_000_000_000,
    pinId: 'pin-sync-delivery',
    txId: 'tx-sync-delivery',
    index: 0,
    ...overrides,
  }
}

function socketEnvelope(item: PrivateChatItem): SocketEnvelope<PrivateChatItem> {
  return {
    M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
    C: 0,
    D: item,
  }
}

const mockedHomes = vi.mocked(listPrivateChatHomes)
const mockedHistory = vi.mocked(listPrivateChatHistory)
const mockedDecryptIncoming = vi.mocked(decryptIncoming)
const mockedFetchUserProfileByGlobalMetaId = vi.mocked(fetchUserProfileByGlobalMetaId)

describe('deliverySync', () => {
  beforeEach(() => {
    clearTestSessionStorage()
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
    useSocket.setState({
      status: 'disconnected',
      connectedGlobalMetaId: null,
      connectedIdentity: null,
      lastError: null,
      debugLog: [],
    })
    mockedHomes.mockReset()
    mockedHistory.mockReset()
    mockedFetchUserProfileByGlobalMetaId.mockReset()
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({})
    mockedDecryptIncoming.mockReset()
    mockedDecryptIncoming.mockImplementation(async ({ content }: { content: string }) => ({
      plaintext: content,
    }))
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      value: IDBKeyRange,
      writable: true,
      configurable: true,
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('hydrates cache first, then merges duplicate history and socket messages once', async () => {
    await persistDeliveryMessage({
      walletGlobalMetaId: SELF,
      message: {
        id: 'pin-sync-delivery',
        peerGlobalMetaId: PEER,
        peerChatPubkey: 'provider-chat-key',
        fromGlobalMetaId: PEER,
        toGlobalMetaId: SELF,
        content:
          '[DELIVERY:order-sync] {"result":"Ready","assets":["metafile://sync.png"]}',
        rawContent:
          '[DELIVERY:order-sync] {"result":"Ready","assets":["metafile://sync.png"]}',
        encryption: 'plain',
        contentType: 'text/plain',
        timestamp: 1_700_000_000_000,
        pinId: 'pin-sync-delivery',
      },
    })
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
    mockedHomes.mockResolvedValue([{ metaId: PEER, globalMetaId: PEER }])
    mockedHistory.mockResolvedValue({
      list: [privateChatItem()],
      nextCursor: 'cursor-2',
      nextTimestamp: 1_700_000_000_000,
    })

    await hydrateDeliveryForWallet(wallet)

    expect(mockedHomes).not.toHaveBeenCalled()
    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-sync`, SELF)).toEqual([
      expect.objectContaining({ id: 'pin-sync-delivery' }),
    ])
    expect(useMessageStore.getState().assetsBySession[`${SELF}:${PEER}:order-sync`]).toHaveLength(1)

    await syncKnownPrivateChatHistory(wallet)
    await useSocket.getState().handleEnvelope(socketEnvelope(privateChatItem()), wallet)

    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-sync`, SELF)).toHaveLength(1)
    expect(await getMessagesForSession(`${SELF}:${PEER}:order-sync`)).toHaveLength(1)
    expect(await getAssetsForSession(`${SELF}:${PEER}:order-sync`)).toHaveLength(1)
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:${PEER}:order-sync`,
        assetCount: 1,
      }),
    ])
    expect(await getSyncState(`${SELF}:${PEER}`)).toEqual(
      expect.objectContaining({
        id: `${SELF}:${PEER}`,
        walletGlobalMetaId: SELF,
        peerGlobalMetaId: PEER,
        cursor: 'cursor-2',
        lastTimestamp: 1_700_000_000_000,
      }),
    )
  })

  it('normalizes MVC self aliases before persisting history direction', async () => {
    await mergePrivateChatItem({
      item: privateChatItem({
        fromGlobalMetaId: MVC_SELF,
        toGlobalMetaId: PEER,
        toUserInfo: { chatPublicKey: 'provider-chat-key' },
        pinId: 'pin-outgoing-mvc',
        content: '[ORDER_STATUS:order-sync] Working',
        timestamp: 1_700_000_000_100,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-sync`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-outgoing-mvc',
        fromGlobalMetaId: SELF,
        toGlobalMetaId: PEER,
      }),
    ])
    expect(await getMessagesForSession(`${SELF}:${PEER}:order-sync`)).toEqual([
      expect.objectContaining({
        id: 'pin-outgoing-mvc',
        direction: 'outgoing',
      }),
    ])
  })

  it('groups replyPin follow-ups into the original order session', async () => {
    const orderCorrelationId = 'order-ref-123'
    const orderPinId = 'pin-original-order'
    await putSession({
      id: `${SELF}:${PEER}:${orderCorrelationId}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      orderCorrelationId,
      status: 'waiting',
      lastMessageId: orderPinId,
      lastActivityAt: 1_700_000_000_000,
      assetCount: 0,
      unreadCount: 0,
    })
    await putMessage({
      id: orderPinId,
      walletGlobalMetaId: SELF,
      sessionId: `${SELF}:${PEER}:${orderCorrelationId}`,
      peerGlobalMetaId: PEER,
      peerChatPubkey: 'provider-chat-key',
      direction: 'outgoing',
      content: 'Original order body',
      rawContent: 'Original order body',
      contentType: 'text/plain',
      encryption: 'plain',
      protocolTag: 'order',
      orderCorrelationId,
      pinId: orderPinId,
      timestamp: 1_700_000_000_000,
      decryptStatus: 'plain',
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        content: 'One follow-up without an embedded order marker.',
        pinId: 'pin-follow-up',
        replyPin: orderPinId,
        timestamp: 1_700_000_000_100,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:${orderCorrelationId}`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-follow-up',
        orderCorrelationId,
      }),
    ])
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([])
    expect(await getMessagesForSession(`${SELF}:${PEER}:${orderCorrelationId}`)).toEqual([
      expect.objectContaining({ id: orderPinId }),
      expect.objectContaining({
        id: 'pin-follow-up',
        orderCorrelationId,
      }),
    ])
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:${PEER}:${orderCorrelationId}`,
        orderCorrelationId,
      }),
    ])
  })

  it('recovers provider replies to the actual simplemsg pin while keeping the order pin canonical', async () => {
    const serviceOrderPinId = 'service-order-pin-i0'
    const simplemsgPinId = 'simplemsg-pin-i0'
    await persistPendingOrder({
      wallet,
      provider: {
        metaid: 'provider-metaid',
        globalMetaId: PEER,
        address: '1Provider',
        name: 'Provider Bot',
        avatar: null,
        chatPubkey: 'provider-chat-key',
      },
      service: {
        id: 'svc-paid',
        currentPinId: 'svc-current',
        sourceServicePinId: 'svc-source',
        serviceName: 'Paid Delivery',
        displayName: 'Paid Delivery',
        description: 'desc',
        serviceIcon: '',
        providerSkill: 'paid-delivery',
        outputType: 'text',
        price: '1',
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
      },
      prompt: 'Paid request',
      result: {
        paymentTxid: 'paid-txid-i0',
        paymentCommitTxid: '',
        orderReference: '',
        orderPinId: serviceOrderPinId,
        simplemsgPinId,
        sessionKey: `${PEER}:${serviceOrderPinId}`,
        orderPayload: `[ORDER] Paid request\norder pin id: ${serviceOrderPinId}\ntxid: paid-txid-i0`,
        displaySummary: 'Paid request',
      },
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        pinId: 'pin-reply-to-simplemsg',
        replyPin: simplemsgPinId,
        content: 'Reply without embedded order metadata.',
        timestamp: 1_700_000_000_100,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:${serviceOrderPinId}`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-reply-to-simplemsg',
        orderCorrelationId: serviceOrderPinId,
      }),
    ])
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([])
    const persistedMessages = await getMessagesForSession(`${SELF}:${PEER}:${serviceOrderPinId}`)
    expect(persistedMessages).toHaveLength(2)
    expect(persistedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: simplemsgPinId,
        pinId: simplemsgPinId,
        orderCorrelationId: serviceOrderPinId,
      }),
      expect.objectContaining({
        id: 'pin-reply-to-simplemsg',
        orderCorrelationId: serviceOrderPinId,
      }),
    ]))
  })

  it('matches paid history replies that mention the payment txid to the paid order session', async () => {
    const paymentTxid = 'paid-history-txid'
    await putOrder({
      id: `${SELF}:${PEER}:${paymentTxid}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      providerName: 'Paid Provider',
      providerAvatarUrl: 'https://cdn.example/paid-provider.png',
      serviceId: 'svc-paid',
      serviceName: 'Paid Delivery',
      skillName: 'paid-delivery',
      outputType: 'image',
      rawRequest: 'Paid request',
      displaySummary: 'Paid request',
      price: '9',
      currency: 'SPACE',
      settlementKind: 'native',
      paymentChain: 'mvc',
      paymentTxid,
      status: 'waiting',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    await putSession({
      id: `${SELF}:${PEER}:${paymentTxid}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      providerName: 'Paid Provider',
      providerAvatarUrl: 'https://cdn.example/paid-provider.png',
      orderCorrelationId: paymentTxid,
      serviceId: 'svc-paid',
      serviceLabel: 'Paid Delivery',
      status: 'waiting',
      lastMessageId: 'pin-paid-order',
      lastActivityAt: 1_700_000_000_000,
      assetCount: 0,
      unreadCount: 0,
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        pinId: 'pin-paid-history-reply',
        content: `Payment ${paymentTxid} received. Ready metafile://paid-history.png`,
        timestamp: 1_700_000_000_200,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:${paymentTxid}`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-paid-history-reply',
        orderCorrelationId: paymentTxid,
      }),
    ])
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([])
    expect(await getMessagesForSession(`${SELF}:${PEER}:${paymentTxid}`)).toEqual([
      expect.objectContaining({
        id: 'pin-paid-history-reply',
        orderCorrelationId: paymentTxid,
      }),
    ])
  })

  it('normalizes synced provider messages with order pin metadata to the order pin id', async () => {
    const paymentTxid = 'paid-history-txid'
    const orderPinId = 'order-pin-i0'
    await putOrder({
      id: `${SELF}:${PEER}:${orderPinId}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      providerName: 'Paid Provider',
      providerAvatarUrl: 'https://cdn.example/paid-provider.png',
      serviceId: 'svc-paid',
      serviceName: 'Paid Delivery',
      skillName: 'paid-delivery',
      outputType: 'image',
      rawRequest: 'Paid request',
      displaySummary: 'Paid request',
      price: '9',
      currency: 'SPACE',
      settlementKind: 'native',
      paymentChain: 'mvc',
      paymentTxid,
      orderReference: 'legacy-order-ref',
      orderPinId,
      status: 'waiting',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    await putSession({
      id: `${SELF}:${PEER}:${orderPinId}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      providerName: 'Paid Provider',
      providerAvatarUrl: 'https://cdn.example/paid-provider.png',
      orderCorrelationId: orderPinId,
      serviceId: 'svc-paid',
      serviceLabel: 'Paid Delivery',
      status: 'waiting',
      lastMessageId: orderPinId,
      lastActivityAt: 1_700_000_000_000,
      assetCount: 0,
      unreadCount: 0,
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        pinId: 'pin-paid-order-pin-reply',
        content: `[ORDER_STATUS:${paymentTxid}] Working\norder pin id: ${orderPinId}`,
        timestamp: 1_700_000_000_200,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:${orderPinId}`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-paid-order-pin-reply',
        orderCorrelationId: orderPinId,
      }),
    ])
    expect(useMessageStore.getState().messagesForSession(`${PEER}:${paymentTxid}`, SELF)).toEqual([])
    expect(await getMessagesForSession(`${SELF}:${PEER}:${orderPinId}`)).toEqual([
      expect.objectContaining({
        id: 'pin-paid-order-pin-reply',
        orderCorrelationId: orderPinId,
      }),
    ])
  })

  it.each([
    [
      'orderPinId',
      '[DELIVERY:paid-history-txid] {"orderPinId":"order-pin-i0","result":"Ready"}',
    ],
    [
      'serviceOrderPinId',
      '[DELIVERY:paid-history-txid] {"serviceOrderPinId":"order-pin-i0","result":"Ready"}',
    ],
  ] as const)(
    'normalizes synced provider messages with %s metadata to the order pin id',
    async (_label, content) => {
      const paymentTxid = 'paid-history-txid'
      const orderPinId = 'order-pin-i0'
      await putOrder({
        id: `${SELF}:${PEER}:${orderPinId}`,
        walletGlobalMetaId: SELF,
        providerGlobalMetaId: PEER,
        providerChatPubkey: 'provider-chat-key',
        serviceId: 'svc-paid',
        serviceName: 'Paid Delivery',
        skillName: 'paid-delivery',
        outputType: 'image',
        rawRequest: 'Paid request',
        displaySummary: 'Paid request',
        price: '9',
        currency: 'SPACE',
        settlementKind: 'native',
        paymentChain: 'mvc',
        paymentTxid,
        orderPinId,
        status: 'waiting',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      })

      await mergePrivateChatItem({
        item: privateChatItem({
          pinId: `pin-paid-${_label}-reply`,
          content,
          timestamp: 1_700_000_000_200,
        }),
        selfGlobalMetaId: SELF,
        walletIdentity: wallet,
      })

      expect(useMessageStore.getState().messagesForSession(`${PEER}:${orderPinId}`, SELF)).toEqual([
        expect.objectContaining({
          id: `pin-paid-${_label}-reply`,
          orderCorrelationId: orderPinId,
        }),
      ])
      expect(await getMessagesForSession(`${SELF}:${PEER}:${orderPinId}`)).toEqual([
        expect.objectContaining({
          id: `pin-paid-${_label}-reply`,
          orderCorrelationId: orderPinId,
        }),
      ])
    },
  )

  it('keeps legacy orderReference records routable when orderPinId is absent', async () => {
    const orderReference = 'legacy-order-ref'
    await putOrder({
      id: `${SELF}:${PEER}:${orderReference}`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'provider-chat-key',
      serviceId: 'svc-free',
      serviceName: 'Free Delivery',
      skillName: 'free-delivery',
      outputType: 'text',
      rawRequest: 'Free request',
      displaySummary: 'Free request',
      price: '0',
      currency: 'SPACE',
      settlementKind: 'native',
      paymentChain: 'mvc',
      orderReference,
      status: 'waiting',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        pinId: 'pin-legacy-order-ref-reply',
        content: `[ORDER_STATUS:${orderReference}] Working`,
        timestamp: 1_700_000_000_200,
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:${orderReference}`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-legacy-order-ref-reply',
        orderCorrelationId: orderReference,
      }),
    ])
    expect(await getMessagesForSession(`${SELF}:${PEER}:${orderReference}`)).toEqual([
      expect.objectContaining({
        id: 'pin-legacy-order-ref-reply',
        orderCorrelationId: orderReference,
      }),
    ])
  })

  it('fetches the latest history page even when old sync state exists', async () => {
    await putSyncState({
      id: `${SELF}:${PEER}`,
      walletGlobalMetaId: SELF,
      peerGlobalMetaId: PEER,
      cursor: 'old-cursor',
      lastTimestamp: 1_600_000_000_000,
      updatedAt: 1_600_000_000_000,
    })
    mockedHomes.mockResolvedValue([{ metaId: PEER, globalMetaId: PEER }])
    mockedHistory.mockResolvedValue({
      list: [
        privateChatItem({
          pinId: 'pin-newer',
          timestamp: 1_800_000_000_000,
          content: '[ORDER_STATUS:order-sync] Newer offline message',
        }),
      ],
      nextCursor: 'latest-cursor',
      nextTimestamp: 1_800_000_000_000,
    })

    await syncKnownPrivateChatHistory(wallet)

    expect(mockedHistory).toHaveBeenCalledWith({
      metaId: MVC_SELF,
      otherMetaId: PEER,
      cursor: '',
      size: 50,
    })
    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-sync`, SELF)).toEqual([
      expect.objectContaining({ id: 'pin-newer' }),
    ])
  })

  it('continues syncing remaining peers when one peer history request fails', async () => {
    const failedPeer = 'idqfailed'
    const secondPeer = 'idqsecond'
    mockedHomes.mockResolvedValue([
      { metaId: failedPeer, globalMetaId: failedPeer },
      { metaId: secondPeer, globalMetaId: secondPeer },
    ])
    mockedHistory.mockImplementation(async ({ otherMetaId }) => {
      if (otherMetaId === failedPeer) {
        throw new Error('first peer history failed')
      }
      return {
        list: [
          privateChatItem({
            fromGlobalMetaId: secondPeer,
            pinId: 'pin-second-peer',
            content: '[ORDER_STATUS:order-second] Second peer synced',
          }),
        ],
        nextCursor: 'second-cursor',
        nextTimestamp: 1_700_000_000_000,
      }
    })

    const result = await syncKnownPrivateChatHistory(wallet)

    expect(useMessageStore.getState().messagesForSession(`${secondPeer}:order-second`, SELF)).toEqual([
      expect.objectContaining({ id: 'pin-second-peer' }),
    ])
    expect(result.syncedPeers).toEqual([secondPeer])
    expect(result.failedPeers).toHaveLength(1)
    expect(result.failedPeers[0]).toEqual({
      peerGlobalMetaId: failedPeer,
      error: expect.any(Error),
    })
    expect(await getSyncState(`${SELF}:${failedPeer}`)).toBeUndefined()
    expect(await getSyncState(`${SELF}:${secondPeer}`)).toEqual(
      expect.objectContaining({ cursor: 'second-cursor' }),
    )
  })

  it('does not advance sync state when history merge cannot persist', async () => {
    mockedHomes.mockResolvedValue([{ metaId: PEER, globalMetaId: PEER }])
    mockedHistory.mockResolvedValue({
      list: [
        privateChatItem({
          pinId: 'pin-unpersisted',
          content: '[ORDER_STATUS:order-sync] Not cached',
        }),
      ],
    })
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
    ) {
      if (this.name === 'messages') {
        throw new DOMException('Injected message write failure', 'DataError')
      }
      return originalPut.call(this, value)
    })

    await syncKnownPrivateChatHistory(wallet)

    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-sync`, SELF)).toEqual([
      expect.objectContaining({ id: 'pin-unpersisted' }),
    ])
    expect(await getSyncState(`${SELF}:${PEER}`)).toBeUndefined()
  })

  it('passes stable message id and simplemsg encryption markers into decryptIncoming', async () => {
    await mergePrivateChatItem({
      item: privateChatItem({
        protocol: '/protocols/simplemsg',
        encryption: undefined,
        encrypt: 'ecdh',
        pinId: 'pin-stable-decrypt-id',
        content: 'U2FsdGVkX1+encrypted',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(mockedDecryptIncoming).toHaveBeenCalledWith({
      content: 'U2FsdGVkX1+encrypted',
      protocol: '/protocols/simplemsg',
      encryption: 'ecdh',
      peerChatPubKey: 'provider-chat-key',
      messageId: 'pin-stable-decrypt-id',
    })
  })

  it('fetches the peer profile chat key when private chat userInfo omits it before decrypting', async () => {
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      chatPubkey: 'profile-provider-key',
    })

    const result = await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: undefined,
        pinId: 'pin-profile-key-decrypt',
        content: 'U2FsdGVkX1+encrypted',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(mockedFetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(PEER)
    expect(mockedDecryptIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        peerChatPubKey: 'profile-provider-key',
        messageId: 'pin-profile-key-decrypt',
      }),
    )
    expect(result.message.peerChatPubkey).toBe('profile-provider-key')
  })

  it('stores the profile-fetched chat key on delivery sessions', async () => {
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      chatPubkey: 'profile-session-key',
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: undefined,
        pinId: 'pin-profile-session-key',
        content: '[DELIVERY:order-profile] {"result":"Ready"}',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().listSessions(SELF)).toEqual([
      expect.objectContaining({
        sessionKey: `${PEER}:order-profile`,
        providerChatPubkey: 'profile-session-key',
      }),
    ])
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:${PEER}:order-profile`,
        providerChatPubkey: 'profile-session-key',
      }),
    ])
  })

  it('stores peer display profile from private chat userInfo on messages and sessions', async () => {
    await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: {
          globalMetaId: PEER,
          name: 'Provider Bot',
          avatarUrl: 'https://cdn.example/provider.png',
          chatPublicKey: 'provider-chat-key',
        },
        pinId: 'pin-userinfo-profile',
        content: '[ORDER_STATUS:order-userinfo-profile] Working',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-userinfo-profile`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-userinfo-profile',
        peerName: 'Provider Bot',
        peerAvatarUrl: 'https://cdn.example/provider.png',
        peerChatPubkey: 'provider-chat-key',
      }),
    ])
    expect(await getMessagesForSession(`${SELF}:${PEER}:order-userinfo-profile`)).toEqual([
      expect.objectContaining({
        id: 'pin-userinfo-profile',
        peerName: 'Provider Bot',
        peerAvatarUrl: 'https://cdn.example/provider.png',
        peerChatPubkey: 'provider-chat-key',
      }),
    ])
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:${PEER}:order-userinfo-profile`,
        providerName: 'Provider Bot',
        providerAvatarUrl: 'https://cdn.example/provider.png',
        providerChatPubkey: 'provider-chat-key',
      }),
    ])
  })

  it('uses profile display fields as fallback when private chat userInfo omits them', async () => {
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      name: 'Profile Bot',
      avatarUrl: 'https://cdn.example/profile-bot.png',
      chatPubkey: 'profile-display-key',
    })

    await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: undefined,
        pinId: 'pin-profile-display',
        content: '[ORDER_STATUS:order-profile-display] Working',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-profile-display`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-profile-display',
        peerName: 'Profile Bot',
        peerAvatarUrl: 'https://cdn.example/profile-bot.png',
        peerChatPubkey: 'profile-display-key',
      }),
    ])
  })

  it('fills missing fetched profile fields without overwriting private chat userInfo', async () => {
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      name: 'Profile Bot',
      avatarUrl: 'https://cdn.example/profile-avatar.png',
      chatPubkey: 'profile-provider-key',
    })

    const result = await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: {
          globalMetaId: PEER,
          name: 'Provider Bot',
          chatPublicKey: 'provider-chat-key',
        },
        pinId: 'pin-partial-userinfo-profile',
        content: '[ORDER_STATUS:order-partial-userinfo-profile] Working',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(mockedFetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(PEER)
    expect(result.message).toEqual(expect.objectContaining({
      id: 'pin-partial-userinfo-profile',
      peerChatPubkey: 'provider-chat-key',
      peerName: 'Provider Bot',
      peerAvatarUrl: 'https://cdn.example/profile-avatar.png',
    }))
    expect(mockedDecryptIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        peerChatPubKey: 'provider-chat-key',
        messageId: 'pin-partial-userinfo-profile',
      }),
    )
  })

  it('fills missing fetched display fields without overwriting a stored local chat key', async () => {
    await putSession({
      id: `${SELF}:${PEER}:order-local-key`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
      providerChatPubkey: 'local-session-provider-key',
      orderCorrelationId: 'order-local-key',
      status: 'waiting',
      lastMessageId: 'pending-order',
      lastActivityAt: 1_700_000_000_000,
      assetCount: 0,
      unreadCount: 0,
    })
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      name: 'Profile Local Bot',
      avatarUrl: 'https://cdn.example/profile-local.png',
      chatPubkey: 'profile-should-not-overwrite-key',
    })

    const result = await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: undefined,
        pinId: 'pin-local-session-key',
        content: 'U2FsdGVkX1+encrypted',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
    })

    expect(mockedFetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(PEER)
    expect(mockedDecryptIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        peerChatPubKey: 'local-session-provider-key',
        messageId: 'pin-local-session-key',
      }),
    )
    expect(result.message).toEqual(expect.objectContaining({
      peerChatPubkey: 'local-session-provider-key',
      peerName: 'Profile Local Bot',
      peerAvatarUrl: 'https://cdn.example/profile-local.png',
    }))
    expect(await getSessionsForWallet(SELF)).toContainEqual(
      expect.objectContaining({
        providerGlobalMetaId: PEER,
        providerChatPubkey: 'local-session-provider-key',
        providerName: 'Profile Local Bot',
        providerAvatarUrl: 'https://cdn.example/profile-local.png',
      }),
    )
  })

  it('keeps merging and logs debug when the peer profile chat key request fails', async () => {
    const pushDebug = vi.fn()
    mockedFetchUserProfileByGlobalMetaId.mockRejectedValue(new Error('profile offline'))

    const result = await mergePrivateChatItem({
      item: privateChatItem({
        fromUserInfo: undefined,
        pinId: 'pin-profile-failed',
        content: '[ORDER_STATUS:order-profile-failed] Still persist this message',
      }),
      selfGlobalMetaId: SELF,
      walletIdentity: wallet,
      pushDebug,
    })

    expect(result.persisted).toBe(true)
    expect(useMessageStore.getState().messagesForSession(`${PEER}:order-profile-failed`, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-profile-failed',
        peerChatPubkey: undefined,
      }),
    ])
    expect(await getMessagesForSession(`${SELF}:${PEER}:order-profile-failed`)).toEqual([
      expect.objectContaining({ id: 'pin-profile-failed' }),
    ])
    expect(pushDebug).toHaveBeenCalledWith(
      expect.stringContaining('[profile] peer chat key was not loaded'),
    )
  })

  it('reuses one fetched peer profile chat key across a history page', async () => {
    mockedFetchUserProfileByGlobalMetaId.mockResolvedValue({
      globalMetaId: PEER,
      chatPubkey: 'profile-history-key',
    })
    mockedHomes.mockResolvedValue([{ metaId: PEER, globalMetaId: PEER }])
    mockedHistory.mockResolvedValue({
      list: [
        privateChatItem({
          fromUserInfo: undefined,
          pinId: 'pin-history-profile-1',
          content: '[ORDER_STATUS:order-history-profile] First',
          timestamp: 1_700_000_000_000,
        }),
        privateChatItem({
          fromUserInfo: undefined,
          pinId: 'pin-history-profile-2',
          content: '[ORDER_STATUS:order-history-profile] Second',
          timestamp: 1_700_000_000_100,
        }),
      ],
      nextCursor: 'profile-cursor',
      nextTimestamp: 1_700_000_000_100,
    })

    await syncKnownPrivateChatHistory(wallet)

    expect(mockedFetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1)
    expect(mockedFetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(PEER)
    expect(mockedDecryptIncoming).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ peerChatPubKey: 'profile-history-key' }),
    )
    expect(mockedDecryptIncoming).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ peerChatPubKey: 'profile-history-key' }),
    )
  })
})
