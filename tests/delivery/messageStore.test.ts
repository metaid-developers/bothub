import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { clearTestSessionStorage } from '../setup'
import {
  DELIVERY_DB_NAME,
  getMessagesForSession,
  getSessionsForWallet,
  putMessage,
  putSession,
} from '@/delivery/db'
import { useMessageStore, type DeliveryMessage } from '@/delivery/messageStore'
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

    useMessageStore.setState({ byPeer: {}, selectedSessionKey: null })
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
