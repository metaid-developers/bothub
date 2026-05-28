import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { clearTestSessionStorage } from '../setup'
import {
  DELIVERY_DB_NAME,
  getAssetsForSession,
  getMessagesForSession,
  getSessionsForWallet,
  putMessage,
  putSession,
} from '@/delivery/db'
import {
  persistDeliveryMessage,
  useMessageStore,
  type DeliveryMessage,
} from '@/delivery/messageStore'
import { buildOrderPayload } from '@/order/buildOrderPayload'

const SELF = 'idqself'

function sampleMessage(
  overrides: Partial<DeliveryMessage> & Pick<DeliveryMessage, 'id' | 'peerGlobalMetaId'>,
): DeliveryMessage {
  return {
    fromGlobalMetaId: 'idqpeer',
    toGlobalMetaId: SELF,
    content: 'hello',
    rawContent: 'hello',
    encryption: 'ecdh',
    contentType: 'text/plain',
    timestamp: 1,
    ...overrides,
  }
}

describe('messageStore', () => {
  beforeEach(() => {
    clearTestSessionStorage()
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
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

  it('appends messages sorted by timestamp ascending within a session', () => {
    const { append, messagesForSession } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'm2',
        peerGlobalMetaId: 'idqpeer',
        timestamp: 2,
        content: 'second',
      }),
    )
    append(
      sampleMessage({
        id: 'm1',
        peerGlobalMetaId: 'idqpeer',
        timestamp: 1,
        content: 'first',
      }),
    )

    expect(messagesForSession('idqpeer', SELF).map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('deduplicates by message id', () => {
    const { append, messagesForSession } = useMessageStore.getState()
    const row = sampleMessage({ id: 'dup', peerGlobalMetaId: 'idqpeer' })
    append(row)
    append({ ...row, content: 'changed' })
    expect(messagesForSession('idqpeer', SELF)).toHaveLength(1)
    expect(messagesForSession('idqpeer', SELF)[0]?.content).toBe('hello')
  })

  it('lists sessions by latest message timestamp', () => {
    const { append, listSessions } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'a1',
        peerGlobalMetaId: 'peer-a',
        timestamp: 10,
      }),
    )
    append(
      sampleMessage({
        id: 'b1',
        peerGlobalMetaId: 'peer-b',
        timestamp: 20,
      }),
    )

    expect(listSessions(SELF).map((s) => s.peerGlobalMetaId)).toEqual(['peer-b', 'peer-a'])
  })

  it('splits order and default sessions for the same peer', () => {
    const orderRef = 'e'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Store split',
      rawRequest: 'z',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-store',
      skillName: 'store-skill',
      outputType: 'text',
    })
    const { append, listSessions, messagesForSession } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'order-1',
        peerGlobalMetaId: 'idqpeer',
        fromGlobalMetaId: SELF,
        content: orderPayload,
        timestamp: 1,
      }),
    )
    append(
      sampleMessage({
        id: 'chat-1',
        peerGlobalMetaId: 'idqpeer',
        content: 'general chat',
        timestamp: 2,
      }),
    )

    expect(listSessions(SELF)).toHaveLength(2)
    expect(messagesForSession(`idqpeer:${orderRef}`, SELF)).toHaveLength(1)
    expect(messagesForSession('idqpeer', SELF)).toHaveLength(1)
  })

  it('hydrates pending sessions from IndexedDB when no provider message exists', async () => {
    const sessionId = `${SELF}:idqpeer:pending-order`
    await putSession({
      id: sessionId,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: 'idqpeer',
      providerChatPubkey: 'stored-provider-key',
      orderCorrelationId: 'pending-order',
      serviceId: 'svc-pending',
      serviceLabel: 'Pending Skill',
      status: 'pending',
      lastMessageId: 'pin-order-pending',
      lastActivityAt: 10,
      assetCount: 0,
      unreadCount: 0,
    })
    await putMessage({
      id: 'pin-order-pending',
      walletGlobalMetaId: SELF,
      sessionId,
      peerGlobalMetaId: 'idqpeer',
      peerChatPubkey: 'stored-provider-key',
      direction: 'outgoing',
      content: buildOrderPayload({
        displayText: 'Pending Skill',
        rawRequest: 'Please start',
        price: '0',
        currency: 'SPACE',
        orderReference: 'pending-order',
        serviceId: 'svc-pending',
        skillName: 'pending-skill',
        outputType: 'text',
      }),
      rawContent: 'raw pending',
      contentType: 'text/plain',
      encryption: 'plain',
      orderCorrelationId: 'pending-order',
      pinId: 'pin-order-pending',
      timestamp: 10,
      decryptStatus: 'plain',
    })

    await useMessageStore.getState().hydrateFromDb(SELF)

    expect(useMessageStore.getState().listSessions(SELF)).toEqual([
      expect.objectContaining({
        sessionKey: 'idqpeer:pending-order',
        peerGlobalMetaId: 'idqpeer',
        providerChatPubkey: 'stored-provider-key',
        orderCorrelationId: 'pending-order',
        serviceLabel: 'pending-skill',
        messageCount: 1,
      }),
    ])
  })

  it('persists outgoing follow-ups with outgoing direction without dropping existing session fields', async () => {
    await putSession({
      id: `${SELF}:idqpeer:follow-up-order`,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: 'idqpeer',
      providerChatPubkey: 'stored-provider-key',
      orderCorrelationId: 'follow-up-order',
      serviceId: 'svc-existing',
      serviceLabel: 'Existing Skill',
      status: 'delivered',
      lastMessageId: 'pin-delivery',
      lastActivityAt: 50,
      assetCount: 2,
      unreadCount: 3,
    })

    await useMessageStore.getState().appendOutgoingFollowUp({
      wallet: {
        globalMetaId: SELF,
        mvcAddress: '1SelfMvc',
        btcAddress: 'bc1self',
        dogeAddress: 'Dself',
      },
      session: {
        sessionKey: 'idqpeer:follow-up-order',
        peerGlobalMetaId: 'idqpeer',
        providerChatPubkey: 'stored-provider-key',
        orderCorrelationId: 'follow-up-order',
        serviceLabel: 'Follow Up Skill',
        lastMessage: sampleMessage({
          id: 'pin-order',
          peerGlobalMetaId: 'idqpeer',
          fromGlobalMetaId: SELF,
          toGlobalMetaId: 'idqpeer',
        }),
        messageCount: 1,
      },
      content: 'Please revise.',
      rawContent: 'encrypted-follow-up',
      pinId: 'pin-follow-up',
    })

    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:idqpeer:follow-up-order`,
        providerChatPubkey: 'stored-provider-key',
        serviceId: 'svc-existing',
        serviceLabel: 'Existing Skill',
        status: 'delivered',
        lastMessageId: 'pin-follow-up',
        assetCount: 2,
        unreadCount: 3,
      }),
    ])
    expect(
      await getMessagesForSession(`${SELF}:idqpeer:follow-up-order`),
    ).toEqual([
      expect.objectContaining({
        id: 'pin-follow-up',
        direction: 'outgoing',
        content: 'Please revise.',
        rawContent: 'encrypted-follow-up',
        peerChatPubkey: 'stored-provider-key',
      }),
    ])

    useMessageStore.setState({ byPeer: {}, assetsBySession: {}, selectedSessionKey: null })
    await useMessageStore.getState().hydrateFromDb(SELF)

    expect(useMessageStore.getState().messagesForSession('idqpeer:follow-up-order', SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-follow-up',
        fromGlobalMetaId: SELF,
        toGlobalMetaId: 'idqpeer',
        peerChatPubkey: 'stored-provider-key',
      }),
    ])
  })

  it('persists parsed delivery assets and updates the session asset count', async () => {
    const message = sampleMessage({
      id: 'pin-delivery-1',
      peerGlobalMetaId: 'idqpeer',
      content:
        '[DELIVERY:order-assets] {"result":"Ready","assets":["metafile://image.png","metafile://brief.pdf"]}',
      rawContent:
        '[DELIVERY:order-assets] {"result":"Ready","assets":["metafile://image.png","metafile://brief.pdf"]}',
      timestamp: 20,
      pinId: 'pin-delivery-1',
    })

    await persistDeliveryMessage({ walletGlobalMetaId: SELF, message })

    const sessionId = `${SELF}:idqpeer:order-assets`
    expect(await getAssetsForSession(sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `${sessionId}:metafile://image.png`,
          messageId: 'pin-delivery-1',
          uri: 'metafile://image.png',
          kind: 'image',
        }),
        expect.objectContaining({
          id: `${sessionId}:metafile://brief.pdf`,
          messageId: 'pin-delivery-1',
          uri: 'metafile://brief.pdf',
          kind: 'document',
        }),
      ]),
    )
    expect(await getAssetsForSession(sessionId)).toHaveLength(2)
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: sessionId,
        status: 'delivered',
        assetCount: 2,
        lastMessageId: 'pin-delivery-1',
        lastActivityAt: 20,
      }),
    ])
  })

  it('marks ORDER_END sessions completed in the persisted session record', async () => {
    const message = sampleMessage({
      id: 'pin-end-1',
      peerGlobalMetaId: 'idqpeer',
      content: '[ORDER_END:order-end] Order completed',
      rawContent: '[ORDER_END:order-end] Order completed',
      timestamp: 30,
      pinId: 'pin-end-1',
    })

    await persistDeliveryMessage({ walletGlobalMetaId: SELF, message })

    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:idqpeer:order-end`,
        status: 'completed',
      }),
    ])
  })

  it('stores NeedsRating as a reserved protocol signal without creating assets', async () => {
    const message = sampleMessage({
      id: 'pin-rating-1',
      peerGlobalMetaId: 'idqpeer',
      content: '[NeedsRating:order-rating] Rating will be requested later',
      rawContent: '[NeedsRating:order-rating] Rating will be requested later',
      timestamp: 40,
      pinId: 'pin-rating-1',
    })

    await persistDeliveryMessage({ walletGlobalMetaId: SELF, message })

    const sessionId = `${SELF}:idqpeer:order-rating`
    expect(await getMessagesForSession(sessionId)).toEqual([
      expect.objectContaining({
        id: 'pin-rating-1',
        protocolTag: 'needs_rating',
      }),
    ])
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: sessionId,
        status: 'completed',
        assetCount: 0,
      }),
    ])
    expect(await getAssetsForSession(sessionId)).toEqual([])
  })

  it('hydrates persisted delivery messages so refreshed sessions show assets and completed status', async () => {
    await persistDeliveryMessage({
      walletGlobalMetaId: SELF,
      message: sampleMessage({
        id: 'pin-delivery-refresh',
        peerGlobalMetaId: 'idqpeer',
        content:
          '[DELIVERY:order-refresh] {"result":"Ready metafile://refresh.png","assets":["metafile://refresh.png"]}',
        rawContent:
          '[DELIVERY:order-refresh] {"result":"Ready metafile://refresh.png","assets":["metafile://refresh.png"]}',
        timestamp: 50,
        pinId: 'pin-delivery-refresh',
      }),
    })
    await persistDeliveryMessage({
      walletGlobalMetaId: SELF,
      message: sampleMessage({
        id: 'pin-end-refresh',
        peerGlobalMetaId: 'idqpeer',
        content: '[ORDER_END:order-refresh] Complete',
        rawContent: '[ORDER_END:order-refresh] Complete',
        timestamp: 60,
        pinId: 'pin-end-refresh',
      }),
    })

    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
    await useMessageStore.getState().hydrateFromDb(SELF)

    const session = useMessageStore.getState().listSessions(SELF)[0]
    const messages = useMessageStore
      .getState()
      .messagesForSession('idqpeer:order-refresh', SELF)

    expect(session).toMatchObject({
      sessionKey: 'idqpeer:order-refresh',
      messageCount: 2,
    })
    expect(messages.map((row) => row.id)).toEqual([
      'pin-delivery-refresh',
      'pin-end-refresh',
    ])
    expect(
      useMessageStore.getState().assetsBySession[`${SELF}:idqpeer:order-refresh`],
    ).toEqual([
      expect.objectContaining({
        uri: 'metafile://refresh.png',
        messageId: 'pin-delivery-refresh',
      }),
    ])
    expect(await getAssetsForSession(`${SELF}:idqpeer:order-refresh`)).toHaveLength(1)
  })

  it.each(['assets', 'sessions'] as const)(
    'does not leave persisted delivery rows when a later %s write fails',
    async (storeName) => {
      const originalPut = IDBObjectStore.prototype.put
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value: unknown,
      ) {
        if (this.name === storeName) {
          throw new DOMException(`Injected ${storeName} write failure`, 'DataError')
        }
        return originalPut.call(this, value)
      })

      const sessionId = `${SELF}:idqpeer:atomic-failure`
      await expect(
        persistDeliveryMessage({
          walletGlobalMetaId: SELF,
          message: sampleMessage({
            id: 'pin-atomic-failure',
            peerGlobalMetaId: 'idqpeer',
            content:
              '[DELIVERY:atomic-failure] {"result":"Ready","assets":["metafile://atomic.png"]}',
            rawContent:
              '[DELIVERY:atomic-failure] {"result":"Ready","assets":["metafile://atomic.png"]}',
            timestamp: 70,
            pinId: 'pin-atomic-failure',
          }),
        }),
      ).rejects.toBeTruthy()

      expect(await getMessagesForSession(sessionId)).toEqual([])
      expect(await getAssetsForSession(sessionId)).toEqual([])
      expect(await getSessionsForWallet(SELF)).toEqual([])
    },
  )

  it('keeps same-session delivery aggregates correct across multiple persisted messages', async () => {
    await persistDeliveryMessage({
      walletGlobalMetaId: SELF,
      message: sampleMessage({
        id: 'pin-delivery-multi',
        peerGlobalMetaId: 'idqpeer',
        content:
          '[DELIVERY:order-multi] {"result":"Ready","assets":["metafile://multi.png"]}',
        rawContent:
          '[DELIVERY:order-multi] {"result":"Ready","assets":["metafile://multi.png"]}',
        timestamp: 80,
        pinId: 'pin-delivery-multi',
      }),
    })
    await persistDeliveryMessage({
      walletGlobalMetaId: SELF,
      message: sampleMessage({
        id: 'pin-end-multi',
        peerGlobalMetaId: 'idqpeer',
        content: '[ORDER_END:order-multi] Complete',
        rawContent: '[ORDER_END:order-multi] Complete',
        timestamp: 90,
        pinId: 'pin-end-multi',
      }),
    })

    const sessionId = `${SELF}:idqpeer:order-multi`
    expect(await getMessagesForSession(sessionId)).toHaveLength(2)
    expect(await getAssetsForSession(sessionId)).toHaveLength(1)
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: sessionId,
        status: 'completed',
        assetCount: 1,
        lastMessageId: 'pin-end-multi',
        lastActivityAt: 90,
      }),
    ])
  })

  it('clears stale same-wallet hydrated assets when current DB rows have none', async () => {
    const sessionId = `${SELF}:idqpeer:no-assets`
    await putSession({
      id: sessionId,
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: 'idqpeer',
      orderCorrelationId: 'no-assets',
      status: 'active',
      lastMessageId: 'pin-no-assets',
      lastActivityAt: 100,
      assetCount: 0,
      unreadCount: 0,
    })
    await putMessage({
      id: 'pin-no-assets',
      walletGlobalMetaId: SELF,
      sessionId,
      peerGlobalMetaId: 'idqpeer',
      direction: 'incoming',
      content: '[ORDER_STATUS:no-assets] Working',
      rawContent: '[ORDER_STATUS:no-assets] Working',
      contentType: 'text/plain',
      encryption: 'plain',
      protocolTag: 'order_status',
      orderCorrelationId: 'no-assets',
      pinId: 'pin-no-assets',
      timestamp: 100,
      decryptStatus: 'plain',
    })
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {
        [sessionId]: [
          {
            id: `${sessionId}:metafile://stale.png`,
            walletGlobalMetaId: SELF,
            sessionId,
            messageId: 'pin-stale',
            uri: 'metafile://stale.png',
            pinId: 'stale',
            filename: 'stale.png',
            kind: 'image',
            downloadUrl: 'https://example.test/stale.png',
            createdAt: 99,
          },
        ],
      },
      hydratedWalletGlobalMetaId: SELF,
    })

    await useMessageStore.getState().hydrateFromDb(SELF)

    expect(useMessageStore.getState().assetsBySession).toEqual({})
  })

  it('does not append outgoing follow-ups to memory when persistence fails', async () => {
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

    await expect(
      useMessageStore.getState().appendOutgoingFollowUp({
        wallet: {
          globalMetaId: SELF,
          mvcAddress: '1SelfMvc',
          btcAddress: 'bc1self',
          dogeAddress: 'Dself',
        },
        session: {
          sessionKey: 'idqpeer:follow-up-order',
          peerGlobalMetaId: 'idqpeer',
          providerChatPubkey: 'stored-provider-key',
          orderCorrelationId: 'follow-up-order',
          serviceLabel: 'Follow Up Skill',
          lastMessage: sampleMessage({
            id: 'pin-order',
            peerGlobalMetaId: 'idqpeer',
            fromGlobalMetaId: SELF,
            toGlobalMetaId: 'idqpeer',
          }),
          messageCount: 1,
        },
        content: 'Please revise.',
        rawContent: 'encrypted-follow-up',
        pinId: 'pin-follow-up',
      }),
    ).rejects.toBeTruthy()

    expect(useMessageStore.getState().messagesForSession('idqpeer:follow-up-order', SELF)).toEqual(
      [],
    )
  })

  it('clears previously hydrated wallet messages when hydrating a different wallet', async () => {
    await putSession({
      id: 'wallet-a:peer-a:order-a',
      walletGlobalMetaId: 'wallet-a',
      providerGlobalMetaId: 'peer-a',
      orderCorrelationId: 'order-a',
      serviceId: 'svc-a',
      serviceLabel: 'Wallet A Skill',
      status: 'pending',
      lastMessageId: 'pin-a',
      lastActivityAt: 10,
      assetCount: 0,
      unreadCount: 0,
    })
    await putMessage({
      id: 'pin-a',
      walletGlobalMetaId: 'wallet-a',
      sessionId: 'wallet-a:peer-a:order-a',
      peerGlobalMetaId: 'peer-a',
      direction: 'outgoing',
      content: buildOrderPayload({
        displayText: 'Wallet A Skill',
        rawRequest: 'A request',
        price: '0',
        currency: 'SPACE',
        orderReference: 'order-a',
        serviceId: 'svc-a',
        skillName: 'skill-a',
        outputType: 'text',
      }),
      rawContent: 'raw a',
      contentType: 'text/plain',
      encryption: 'plain',
      orderCorrelationId: 'order-a',
      pinId: 'pin-a',
      timestamp: 10,
      decryptStatus: 'plain',
    })
    await putSession({
      id: 'wallet-b:peer-b:order-b',
      walletGlobalMetaId: 'wallet-b',
      providerGlobalMetaId: 'peer-b',
      orderCorrelationId: 'order-b',
      serviceId: 'svc-b',
      serviceLabel: 'Wallet B Skill',
      status: 'pending',
      lastMessageId: 'pin-b',
      lastActivityAt: 20,
      assetCount: 0,
      unreadCount: 0,
    })
    await putMessage({
      id: 'pin-b',
      walletGlobalMetaId: 'wallet-b',
      sessionId: 'wallet-b:peer-b:order-b',
      peerGlobalMetaId: 'peer-b',
      direction: 'outgoing',
      content: buildOrderPayload({
        displayText: 'Wallet B Skill',
        rawRequest: 'B request',
        price: '0',
        currency: 'SPACE',
        orderReference: 'order-b',
        serviceId: 'svc-b',
        skillName: 'skill-b',
        outputType: 'text',
      }),
      rawContent: 'raw b',
      contentType: 'text/plain',
      encryption: 'plain',
      orderCorrelationId: 'order-b',
      pinId: 'pin-b',
      timestamp: 20,
      decryptStatus: 'plain',
    })

    await useMessageStore.getState().hydrateFromDb('wallet-a')
    expect(useMessageStore.getState().listSessions('wallet-a')).toEqual([
      expect.objectContaining({ sessionKey: 'peer-a:order-a' }),
    ])

    await useMessageStore.getState().hydrateFromDb('wallet-b')

    expect(useMessageStore.getState().listSessions('wallet-b')).toEqual([
      expect.objectContaining({ sessionKey: 'peer-b:order-b' }),
    ])
    expect(useMessageStore.getState().listSessions('wallet-b')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionKey: 'peer-a:order-a' })]),
    )
  })
})
