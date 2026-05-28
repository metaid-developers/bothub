import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliveryMessageRecord,
  DeliverySessionRecord,
  DeliverySyncState,
} from '@/delivery/domain'

export const DELIVERY_DB_NAME = 'bothub-buyer-v1'
export const DELIVERY_DB_VERSION = 1

type StoreName = 'orders' | 'sessions' | 'messages' | 'assets' | 'syncState'

const STORE_NAMES: StoreName[] = [
  'orders',
  'sessions',
  'messages',
  'assets',
  'syncState',
]

function createIndexIfMissing(
  store: IDBObjectStore,
  name: string,
  keyPath: string,
): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath)
  }
}

function createStore(
  db: IDBDatabase,
  transaction: IDBTransaction,
  name: StoreName,
): IDBObjectStore {
  if (db.objectStoreNames.contains(name)) {
    return transaction.objectStore(name)
  }
  return db.createObjectStore(name, { keyPath: 'id' })
}

function createStores(db: IDBDatabase, transaction: IDBTransaction): void {
  const orders = createStore(db, transaction, 'orders')
  createIndexIfMissing(orders, 'walletGlobalMetaId', 'walletGlobalMetaId')
  createIndexIfMissing(orders, 'providerGlobalMetaId', 'providerGlobalMetaId')
  createIndexIfMissing(orders, 'orderCorrelationId', 'orderCorrelationId')
  createIndexIfMissing(orders, 'status', 'status')
  createIndexIfMissing(orders, 'updatedAt', 'updatedAt')

  const sessions = createStore(db, transaction, 'sessions')
  createIndexIfMissing(sessions, 'walletGlobalMetaId', 'walletGlobalMetaId')
  createIndexIfMissing(sessions, 'providerGlobalMetaId', 'providerGlobalMetaId')
  createIndexIfMissing(sessions, 'orderCorrelationId', 'orderCorrelationId')
  createIndexIfMissing(sessions, 'lastActivityAt', 'lastActivityAt')
  createIndexIfMissing(sessions, 'status', 'status')

  const messages = createStore(db, transaction, 'messages')
  createIndexIfMissing(messages, 'walletGlobalMetaId', 'walletGlobalMetaId')
  createIndexIfMissing(messages, 'sessionId', 'sessionId')
  createIndexIfMissing(messages, 'peerGlobalMetaId', 'peerGlobalMetaId')
  createIndexIfMissing(messages, 'pinId', 'pinId')
  createIndexIfMissing(messages, 'txId', 'txId')
  createIndexIfMissing(messages, 'timestamp', 'timestamp')

  const assets = createStore(db, transaction, 'assets')
  createIndexIfMissing(assets, 'walletGlobalMetaId', 'walletGlobalMetaId')
  createIndexIfMissing(assets, 'sessionId', 'sessionId')
  createIndexIfMissing(assets, 'messageId', 'messageId')
  createIndexIfMissing(assets, 'kind', 'kind')
  createIndexIfMissing(assets, 'createdAt', 'createdAt')

  const syncState = createStore(db, transaction, 'syncState')
  createIndexIfMissing(syncState, 'walletGlobalMetaId', 'walletGlobalMetaId')
  createIndexIfMissing(syncState, 'peerGlobalMetaId', 'peerGlobalMetaId')
}

export function openDeliveryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DELIVERY_DB_NAME, DELIVERY_DB_VERSION)

    request.onupgradeneeded = () => {
      if (!request.transaction) {
        reject(new Error('Delivery database upgrade transaction was unavailable'))
        return
      }
      createStores(request.result, request.transaction)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Delivery database upgrade was blocked'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

function abortTransaction(transaction: IDBTransaction): void {
  try {
    transaction.abort()
  } catch {
    // The transaction may already be finished or aborting.
  }
}

async function withStoreRequest<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDeliveryDb()
  const transaction = db.transaction(storeName, mode)
  const done = transactionDone(transaction)

  try {
    const request = callback(transaction.objectStore(storeName))
    const result = await requestToPromise(request)
    await done
    return result
  } catch (error) {
    abortTransaction(transaction)
    await done.catch(() => undefined)
    throw error
  } finally {
    db.close()
  }
}

async function putRecord<T extends { id: string }>(
  storeName: StoreName,
  record: T,
): Promise<void> {
  await withStoreRequest(storeName, 'readwrite', (store) => store.put(record))
}

async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: string,
): Promise<T[]> {
  return withStoreRequest(
    storeName,
    'readonly',
    (store) => store.index(indexName).getAll(value) as IDBRequest<T[]>,
  )
}

function sortByNumberDesc<T>(items: T[], key: keyof T): T[] {
  return [...items].sort((a, b) => {
    const left = Number(a[key] ?? 0)
    const right = Number(b[key] ?? 0)
    if (left !== right) return right - left
    return String((b as { id?: string }).id ?? '').localeCompare(
      String((a as { id?: string }).id ?? ''),
    )
  })
}

function sortByNumberAsc<T>(items: T[], key: keyof T): T[] {
  return [...items].sort((a, b) => {
    const left = Number(a[key] ?? 0)
    const right = Number(b[key] ?? 0)
    if (left !== right) return left - right
    return String((a as { id?: string }).id ?? '').localeCompare(
      String((b as { id?: string }).id ?? ''),
    )
  })
}

export async function putOrder(order: BuyerOrder): Promise<void> {
  await putRecord('orders', order)
}

export async function getOrdersForWallet(
  walletGlobalMetaId: string,
): Promise<BuyerOrder[]> {
  const orders = await getByIndex<BuyerOrder>(
    'orders',
    'walletGlobalMetaId',
    walletGlobalMetaId,
  )
  return sortByNumberDesc(orders, 'updatedAt')
}

export async function putSession(session: DeliverySessionRecord): Promise<void> {
  await putRecord('sessions', session)
}

export async function getSessionsForWallet(
  walletGlobalMetaId: string,
): Promise<DeliverySessionRecord[]> {
  const sessions = await getByIndex<DeliverySessionRecord>(
    'sessions',
    'walletGlobalMetaId',
    walletGlobalMetaId,
  )
  return sortByNumberDesc(sessions, 'lastActivityAt')
}

export async function putMessage(message: DeliveryMessageRecord): Promise<void> {
  await putRecord('messages', message)
}

export async function getMessagesForSession(
  sessionId: string,
): Promise<DeliveryMessageRecord[]> {
  const messages = await getByIndex<DeliveryMessageRecord>(
    'messages',
    'sessionId',
    sessionId,
  )
  return sortByNumberAsc(messages, 'timestamp')
}

export async function persistOutgoingFollowUp(input: {
  session: DeliverySessionRecord
  message: DeliveryMessageRecord
}): Promise<{ session: DeliverySessionRecord; message: DeliveryMessageRecord }> {
  const db = await openDeliveryDb()
  const transaction = db.transaction(['sessions', 'messages'], 'readwrite')
  const done = transactionDone(transaction)

  try {
    const sessionStore = transaction.objectStore('sessions')
    const messageStore = transaction.objectStore('messages')
    const existing = await requestToPromise(
      sessionStore.get(input.session.id) as IDBRequest<DeliverySessionRecord | undefined>,
    )
    const mergedSession: DeliverySessionRecord = {
      ...input.session,
      ...existing,
      providerChatPubkey:
        input.session.providerChatPubkey?.trim() ||
        existing?.providerChatPubkey?.trim() ||
        undefined,
      lastMessageId: input.message.id,
      lastActivityAt: input.session.lastActivityAt,
    }

    sessionStore.put(mergedSession)
    messageStore.put(input.message)
    await done
    return { session: mergedSession, message: input.message }
  } catch (error) {
    abortTransaction(transaction)
    await done.catch(() => undefined)
    throw error
  } finally {
    db.close()
  }
}

export async function persistDeliveryMessageRows(input: {
  sessionId: string
  message: DeliveryMessageRecord
  assets: DeliveryAssetRecord[]
  buildSession: (state: {
    existingSession?: DeliverySessionRecord
    messages: DeliveryMessageRecord[]
    assets: DeliveryAssetRecord[]
  }) => DeliverySessionRecord
}): Promise<{
  session: DeliverySessionRecord
  message: DeliveryMessageRecord
  assets: DeliveryAssetRecord[]
}> {
  const db = await openDeliveryDb()
  const transaction = db.transaction(['sessions', 'messages', 'assets'], 'readwrite')
  const done = transactionDone(transaction)

  try {
    const sessionStore = transaction.objectStore('sessions')
    const messageStore = transaction.objectStore('messages')
    const assetStore = transaction.objectStore('assets')
    const existingSession = await requestToPromise(
      sessionStore.get(input.sessionId) as IDBRequest<DeliverySessionRecord | undefined>,
    )
    const existingMessages = await requestToPromise(
      messageStore.index('sessionId').getAll(input.sessionId) as IDBRequest<
        DeliveryMessageRecord[]
      >,
    )
    const existingAssets = await requestToPromise(
      assetStore.index('sessionId').getAll(input.sessionId) as IDBRequest<
        DeliveryAssetRecord[]
      >,
    )
    const messages = sortByNumberAsc(
      [
        ...existingMessages.filter((message) => message.id !== input.message.id),
        input.message,
      ],
      'timestamp',
    )
    const assetsById = new Map(existingAssets.map((asset) => [asset.id, asset]))
    for (const asset of input.assets) {
      assetsById.set(asset.id, asset)
    }
    const assets = sortByNumberAsc(Array.from(assetsById.values()), 'createdAt')
    const session = input.buildSession({ existingSession, messages, assets })

    messageStore.put(input.message)
    for (const asset of input.assets) {
      assetStore.put(asset)
    }
    sessionStore.put(session)
    await done
    return { session, message: input.message, assets: input.assets }
  } catch (error) {
    abortTransaction(transaction)
    await done.catch(() => undefined)
    throw error
  } finally {
    db.close()
  }
}

export async function putAsset(asset: DeliveryAssetRecord): Promise<void> {
  await putRecord('assets', asset)
}

export async function getAssetsForSession(
  sessionId: string,
): Promise<DeliveryAssetRecord[]> {
  const assets = await getByIndex<DeliveryAssetRecord>('assets', 'sessionId', sessionId)
  return sortByNumberAsc(assets, 'createdAt')
}

export async function putSyncState(state: DeliverySyncState): Promise<void> {
  await putRecord('syncState', state)
}

async function deleteWalletRows(store: IDBObjectStore, walletGlobalMetaId: string) {
  const index = store.index('walletGlobalMetaId')
  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(walletGlobalMetaId)
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      cursor.delete()
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

export async function clearWalletData(walletGlobalMetaId: string): Promise<void> {
  const db = await openDeliveryDb()
  const transaction = db.transaction(STORE_NAMES, 'readwrite')
  const done = transactionDone(transaction)

  try {
    await Promise.all(
      STORE_NAMES.map((storeName) =>
        deleteWalletRows(transaction.objectStore(storeName), walletGlobalMetaId),
      ),
    )
    await done
  } catch (error) {
    abortTransaction(transaction)
    await done.catch(() => undefined)
    throw error
  } finally {
    db.close()
  }
}
