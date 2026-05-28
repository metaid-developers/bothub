import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import {
  clearWalletData,
  DELIVERY_DB_NAME,
  getAssetsForSession,
  getMessagesForSession,
  getOrdersForWallet,
  getSessionsForWallet,
  getSyncState,
  openDeliveryDb,
  persistOutgoingFollowUp,
  putAsset,
  putMessage,
  putOrder,
  putSession,
  putSyncState,
} from '@/delivery/db'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliveryMessageRecord,
  DeliverySessionRecord,
  DeliverySyncState,
} from '@/delivery/domain'

const now = 1_700_000_000_000

function order(overrides: Partial<BuyerOrder> = {}): BuyerOrder {
  return {
    id: 'wallet-a:provider-a:order-a',
    walletGlobalMetaId: 'wallet-a',
    providerGlobalMetaId: 'provider-a',
    serviceId: 'service-a',
    serviceName: 'Service A',
    skillName: 'skill-a',
    outputType: 'text',
    rawRequest: 'make a thing',
    displaySummary: 'make a thing',
    price: '0',
    currency: 'SPACE',
    settlementKind: 'native',
    paymentChain: 'mvc',
    orderReference: 'order-a',
    status: 'pending_provider',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function session(overrides: Partial<DeliverySessionRecord> = {}): DeliverySessionRecord {
  return {
    id: 'wallet-a:provider-a:order-a',
    walletGlobalMetaId: 'wallet-a',
    providerGlobalMetaId: 'provider-a',
    orderCorrelationId: 'order-a',
    serviceId: 'service-a',
    serviceLabel: 'Service A',
    status: 'pending',
    lastActivityAt: now,
    assetCount: 0,
    unreadCount: 0,
    ...overrides,
  }
}

function message(overrides: Partial<DeliveryMessageRecord> = {}): DeliveryMessageRecord {
  return {
    id: 'message-a',
    walletGlobalMetaId: 'wallet-a',
    sessionId: 'wallet-a:provider-a:order-a',
    peerGlobalMetaId: 'provider-a',
    direction: 'incoming',
    content: 'hello',
    rawContent: 'hello',
    contentType: 'text/plain',
    encryption: 'plain',
    timestamp: now,
    decryptStatus: 'plain',
    ...overrides,
  }
}

function asset(overrides: Partial<DeliveryAssetRecord> = {}): DeliveryAssetRecord {
  return {
    id: 'wallet-a:provider-a:order-a:metafile://pin.png',
    walletGlobalMetaId: 'wallet-a',
    sessionId: 'wallet-a:provider-a:order-a',
    messageId: 'message-a',
    uri: 'metafile://pin.png',
    pinId: 'pin',
    filename: 'pin.png',
    extension: 'png',
    kind: 'image',
    downloadUrl: 'https://example.test/pin.png',
    createdAt: now,
    ...overrides,
  }
}

function syncState(overrides: Partial<DeliverySyncState> = {}): DeliverySyncState {
  return {
    id: 'wallet-a:provider-a',
    walletGlobalMetaId: 'wallet-a',
    peerGlobalMetaId: 'provider-a',
    updatedAt: now,
    ...overrides,
  }
}

async function syncStateIdsForWallet(walletGlobalMetaId: string): Promise<string[]> {
  const db = await openDeliveryDb()
  try {
    const transaction = db.transaction('syncState', 'readonly')
    const store = transaction.objectStore('syncState')
    const request = store.index('walletGlobalMetaId').getAll(walletGlobalMetaId)
    const rows = await new Promise<DeliverySyncState[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return rows.map((row) => row.id)
  } finally {
    db.close()
  }
}

describe('delivery IndexedDB facade', () => {
  beforeEach(() => {
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
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('opens the database with the expected object stores', async () => {
    const db = await openDeliveryDb()

    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      'assets',
      'messages',
      'orders',
      'sessions',
      'syncState',
    ])

    db.close()
  })

  it('puts and gets orders scoped to a wallet with newest updates first', async () => {
    await putOrder(order({ id: 'older', updatedAt: now }))
    await putOrder(order({ id: 'newer', updatedAt: now + 1 }))
    await putOrder(order({ id: 'other-wallet', walletGlobalMetaId: 'wallet-b' }))

    const orders = await getOrdersForWallet('wallet-a')

    expect(orders.map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('puts and gets sessions scoped to a wallet with newest activity first', async () => {
    await putSession(session({ id: 'older', lastActivityAt: now }))
    await putSession(session({ id: 'newer', lastActivityAt: now + 1 }))
    await putSession(session({ id: 'other-wallet', walletGlobalMetaId: 'wallet-b' }))

    const sessions = await getSessionsForWallet('wallet-a')

    expect(sessions.map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('de-dupes messages by id', async () => {
    await putMessage(message({ content: 'first', timestamp: now }))
    await putMessage(message({ content: 'second', timestamp: now + 1 }))

    const messages = await getMessagesForSession('wallet-a:provider-a:order-a')

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ id: 'message-a', content: 'second' })
  })

  it('de-dupes assets by id', async () => {
    await putAsset(asset({ filename: 'first.png', createdAt: now }))
    await putAsset(asset({ filename: 'second.png', createdAt: now + 1 }))

    const assets = await getAssetsForSession('wallet-a:provider-a:order-a')

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ id: asset().id, filename: 'second.png' })
  })

  it('rejects failed writes and keeps the database usable afterward', async () => {
    const invalidOrder = { ...order() }
    delete (invalidOrder as Partial<BuyerOrder>).id

    await expect(putOrder(invalidOrder as BuyerOrder)).rejects.toBeTruthy()

    await putOrder(order({ id: 'valid-after-failure' }))

    expect((await getOrdersForWallet('wallet-a')).map((item) => item.id)).toEqual([
      'valid-after-failure',
    ])
  })

  it('atomically writes outgoing follow-ups without dropping existing session fields', async () => {
    await putSession(
      session({
        status: 'delivered',
        serviceId: 'existing-service',
        serviceLabel: 'Existing Service',
        providerChatPubkey: 'existing-provider-key',
        lastMessageId: 'delivered-message',
        lastActivityAt: now - 1,
        assetCount: 2,
        unreadCount: 3,
      }),
    )

    await persistOutgoingFollowUp({
      session: session({
        status: 'active',
        serviceLabel: 'Replacement Label',
        providerChatPubkey: 'new-provider-key',
        lastMessageId: 'follow-up-message',
        lastActivityAt: now + 1,
        assetCount: 0,
        unreadCount: 0,
      }),
      message: message({
        id: 'follow-up-message',
        direction: 'outgoing',
        content: 'Please revise this delivery.',
        rawContent: 'encrypted-follow-up',
        peerChatPubkey: 'new-provider-key',
        timestamp: now + 1,
      }),
    })

    expect(await getSessionsForWallet('wallet-a')).toEqual([
      expect.objectContaining({
        id: 'wallet-a:provider-a:order-a',
        providerChatPubkey: 'new-provider-key',
        serviceId: 'existing-service',
        serviceLabel: 'Existing Service',
        status: 'delivered',
        lastMessageId: 'follow-up-message',
        lastActivityAt: now + 1,
        assetCount: 2,
        unreadCount: 3,
      }),
    ])
    expect(await getMessagesForSession('wallet-a:provider-a:order-a')).toEqual([
      expect.objectContaining({
        id: 'follow-up-message',
        direction: 'outgoing',
        content: 'Please revise this delivery.',
      }),
    ])
  })

  it('clears only rows owned by the requested wallet', async () => {
    const otherSessionId = 'wallet-b:provider-a:order-b'

    await putOrder(order())
    await putOrder(order({ id: 'wallet-b:provider-a:order-b', walletGlobalMetaId: 'wallet-b' }))
    await putSession(session())
    await putSession(
      session({
        id: otherSessionId,
        walletGlobalMetaId: 'wallet-b',
        orderCorrelationId: 'order-b',
      }),
    )
    await putMessage(message())
    await putMessage(
      message({
        id: 'message-b',
        walletGlobalMetaId: 'wallet-b',
        sessionId: otherSessionId,
      }),
    )
    await putAsset(asset())
    await putAsset(
      asset({
        id: `${otherSessionId}:metafile://pin-b.png`,
        walletGlobalMetaId: 'wallet-b',
        sessionId: otherSessionId,
        messageId: 'message-b',
        uri: 'metafile://pin-b.png',
      }),
    )
    await putSyncState(syncState())
    await putSyncState(
      syncState({
        id: 'wallet-b:provider-a',
        walletGlobalMetaId: 'wallet-b',
      }),
    )

    await clearWalletData('wallet-a')

    expect(await getOrdersForWallet('wallet-a')).toEqual([])
    expect(await getSessionsForWallet('wallet-a')).toEqual([])
    expect(await getMessagesForSession('wallet-a:provider-a:order-a')).toEqual([])
    expect(await getAssetsForSession('wallet-a:provider-a:order-a')).toEqual([])
    expect(await syncStateIdsForWallet('wallet-a')).toEqual([])

    expect((await getOrdersForWallet('wallet-b')).map((item) => item.id)).toEqual([
      'wallet-b:provider-a:order-b',
    ])
    expect((await getSessionsForWallet('wallet-b')).map((item) => item.id)).toEqual([
      otherSessionId,
    ])
    expect((await getMessagesForSession(otherSessionId)).map((item) => item.id)).toEqual([
      'message-b',
    ])
    expect((await getAssetsForSession(otherSessionId)).map((item) => item.id)).toEqual([
      `${otherSessionId}:metafile://pin-b.png`,
    ])
    expect(await syncStateIdsForWallet('wallet-b')).toEqual(['wallet-b:provider-a'])
  })

  it('gets one sync state by id', async () => {
    await putSyncState(syncState({ cursor: 'cursor-a', lastTimestamp: now }))

    expect(await getSyncState('wallet-a:provider-a')).toEqual(
      expect.objectContaining({
        id: 'wallet-a:provider-a',
        cursor: 'cursor-a',
        lastTimestamp: now,
      }),
    )
    expect(await getSyncState('missing')).toBeUndefined()
  })
})
