import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { DELIVERY_DB_NAME } from '@/delivery/db'
import {
  putOrder,
  putSession,
  putAsset,
  getOrdersForWallet,
  getSessionsForWallet,
} from '@/delivery/db'
import { loadDeliveryWorkspaceRecords } from '@/delivery/workspaceRecovery'
import { buildDeliveryWorkspace, selectWorkspaceOrder } from '@/delivery/workspace'
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

  it('shows order-only request in workspace after login', async () => {
    await putOrder(order())
    const records = await loadDeliveryWorkspaceRecords(SELF)

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: records.orders,
      sessions: records.sessions,
      byPeer: {},
      assetsBySession: records.assetsBySession,
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      providerName: 'Render Bot',
      serviceLabel: 'Image Render',
      requestSummary: 'Make a product image',
      source: 'order',
    })
  })

  it('delivered asset in IndexedDB is visible when no live socket message arrives', async () => {
    const sessionId = `${SELF}:${PROVIDER}:order-1`
    await putSession(session({ serviceLabel: 'Image Render' }))
    await putAsset(asset({ filename: 'image.png' }))
    const records = await loadDeliveryWorkspaceRecords(SELF)

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: records.orders,
      sessions: records.sessions,
      byPeer: {},
      assetsBySession: records.assetsBySession,
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]?.assetCount).toBe(1)
    expect(workspace.orders[0]?.assets[0]?.filename).toBe('image.png')
  })

  it('selected order id is recoverable after page reload', async () => {
    const order1 = order({ orderReference: 'order-1' })
    const order2 = order({
      id: `${SELF}:${PROVIDER}:order-2`,
      orderReference: 'order-2',
      serviceName: 'Video Render',
      displaySummary: 'Make a video',
    })
    await putOrder(order1)
    await putOrder(order2)
    const records = await loadDeliveryWorkspaceRecords(SELF)

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: records.orders,
      sessions: records.sessions,
      byPeer: {},
      assetsBySession: records.assetsBySession,
    })

    const selected = selectWorkspaceOrder(workspace, `${SELF}:${PROVIDER}:order-2`)
    expect(selected).not.toBeNull()
    expect(selected?.serviceLabel).toBe('Video Render')
    expect(selected?.orderCorrelationId).toBe('order-2')
  })

  it('cached orders are visible when history sync fails', async () => {
    await putOrder(order({ serviceName: 'Cached Service' }))
    const records = await loadDeliveryWorkspaceRecords(SELF)

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: records.orders,
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]?.serviceLabel).toBe('Cached Service')
  })
})
