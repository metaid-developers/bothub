import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { DELIVERY_DB_NAME } from '@/delivery/db'
import {
  putOrder,
  putSession,
  putAsset,
} from '@/delivery/db'
import { loadDeliveryWorkspaceRecords } from '@/delivery/workspaceRecovery'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'

const SELF = 'idqbuyer'

async function dropDeliveryDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  await dropDeliveryDb()
})
const PROVIDER = 'idqprovider'

function order(overrides: Partial<BuyerOrder> = {}): BuyerOrder {
  return {
    id: `${SELF}:${PROVIDER}:order-1`,
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-key',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceId: 'svc-image',
    serviceName: 'Image Render',
    skillName: 'render-image',
    outputType: 'image',
    rawRequest: 'Make a product image',
    displaySummary: 'Make a product image',
    price: '0',
    currency: 'SPACE',
    settlementKind: 'native',
    paymentChain: 'mvc',
    orderReference: 'order-1',
    status: 'waiting',
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  }
}

function session(overrides: Partial<DeliverySessionRecord> = {}): DeliverySessionRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-1`,
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-key',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    orderCorrelationId: 'order-1',
    serviceId: 'svc-image',
    serviceLabel: 'Image Render',
    status: 'delivered',
    lastMessageId: 'delivery-1',
    lastActivityAt: 50,
    assetCount: 1,
    unreadCount: 0,
    ...overrides,
  }
}

function asset(overrides: Partial<DeliveryAssetRecord> = {}): DeliveryAssetRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-1:metafile://image.png`,
    walletGlobalMetaId: SELF,
    sessionId: `${SELF}:${PROVIDER}:order-1`,
    messageId: 'delivery-1',
    orderCorrelationId: 'order-1',
    uri: 'metafile://image.png',
    pinId: 'image',
    filename: 'image.png',
    extension: 'png',
    kind: 'image',
    mimeType: 'image/png',
    previewUrl: 'https://file.example/image-preview',
    downloadUrl: 'https://file.example/image',
    fallbackUrl: 'https://file.example/image-fallback',
    createdAt: 50,
    ...overrides,
  }
}

describe('delivery workspace recovery', () => {
  it('loads an order-only row from IndexedDB', async () => {
    await putOrder(order())
    const records = await loadDeliveryWorkspaceRecords(SELF)

    expect(records.orders).toHaveLength(1)
    expect(records.orders[0]?.orderReference).toBe('order-1')
    expect(records.sessions).toHaveLength(0)
    expect(Object.keys(records.assetsBySession)).toHaveLength(0)
  })

  it('loads a session-only row from IndexedDB', async () => {
    await putSession(session())
    const records = await loadDeliveryWorkspaceRecords(SELF)

    expect(records.orders).toHaveLength(0)
    expect(records.sessions).toHaveLength(1)
    expect(records.sessions[0]?.orderCorrelationId).toBe('order-1')
  })

  it('loads assets without live messages', async () => {
    const sessionId = `${SELF}:${PROVIDER}:order-1`
    await putSession(session())
    await putAsset(asset())

    const records = await loadDeliveryWorkspaceRecords(SELF)

    expect(records.assetsBySession[sessionId]).toHaveLength(1)
    expect(records.assetsBySession[sessionId]![0]?.filename).toBe('image.png')
  })

  it('loads both orders and sessions for the same wallet', async () => {
    await putOrder(order())
    await putSession(session())
    const records = await loadDeliveryWorkspaceRecords(SELF)

    expect(records.orders).toHaveLength(1)
    expect(records.sessions).toHaveLength(1)
  })

  it('returns empty records for a wallet with no data', async () => {
    const records = await loadDeliveryWorkspaceRecords('unknown-wallet')
    expect(records).toEqual({ orders: [], sessions: [], assetsBySession: {} })
  })

  it('returns empty records for empty wallet id', async () => {
    const records = await loadDeliveryWorkspaceRecords('')
    expect(records).toEqual({ orders: [], sessions: [], assetsBySession: {} })
  })
})
