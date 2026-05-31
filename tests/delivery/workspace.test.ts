import { describe, expect, it } from 'vitest'
import {
  buildDeliveryWorkspace,
  selectWorkspaceOrder,
  type WorkspaceOrder,
} from '@/delivery/workspace'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'

const SELF = 'idqbuyer'
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

function message(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'delivery-1',
    peerGlobalMetaId: PROVIDER,
    peerChatPubkey: 'provider-key',
    peerName: 'Render Bot',
    peerAvatarUrl: 'https://cdn.example/render.png',
    fromGlobalMetaId: PROVIDER,
    toGlobalMetaId: SELF,
    content: '[DELIVERY:order-1] Done metafile://image.png',
    rawContent: '[DELIVERY:order-1] Done metafile://image.png',
    encryption: 'plain',
    contentType: 'text/plain',
    orderCorrelationId: 'order-1',
    timestamp: 50,
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

describe('delivery workspace', () => {
  it('keeps an order visible before provider replies arrive', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      providerName: 'Render Bot',
      serviceLabel: 'Image Render',
      requestSummary: 'Make a product image',
      status: 'waiting',
      assetCount: 0,
    })
  })

  it('keeps stored assets visible even when the live message list is empty after reload', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [session()],
      byPeer: {},
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      assetCount: 1,
      status: 'delivered',
    })
    expect(workspace.orders[0]?.assets[0]?.filename).toBe('image.png')
  })

  it('resolves selected order id after a URL reload', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [
        order({ orderReference: 'order-1', id: `${SELF}:${PROVIDER}:order-1`, updatedAt: 10 }),
        order({ orderReference: 'order-2', id: `${SELF}:${PROVIDER}:order-2`, updatedAt: 20 }),
      ],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(selectWorkspaceOrder(workspace, `${SELF}:${PROVIDER}:order-1`)?.orderCorrelationId).toBe(
      'order-1',
    )
  })

  it('merges session, messages, and stored assets into one selected order', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [session()],
      byPeer: { [PROVIDER]: [message()] },
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    const selected = selectWorkspaceOrder(workspace, `${SELF}:${PROVIDER}:order-1`)

    expect(selected).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      status: 'delivered',
      assetCount: 1,
      messageCount: 1,
      providerName: 'Render Bot',
    })
    expect(selected?.assets[0]?.filename).toBe('image.png')
  })

  it('keeps session-only deliveries visible when order cache is missing', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [],
      sessions: [session()],
      byPeer: { [PROVIDER]: [message()] },
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    expect(workspace.orders[0]).toEqual(
      expect.objectContaining({
        serviceLabel: 'Image Render',
        status: 'delivered',
        requestSummary: expect.any(String),
        assetCount: 1,
      }),
    )
  })

  it('sorts active and recent work above old completed work', () => {
    const waiting = order({
      orderReference: 'order-2',
      id: `${SELF}:${PROVIDER}:order-2`,
      updatedAt: 100,
    })
    const delivered = order({
      orderReference: 'order-1',
      status: 'delivered',
      updatedAt: 80,
    })

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [delivered, waiting],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders.map((item: WorkspaceOrder) => item.orderCorrelationId)).toEqual([
      'order-2',
      'order-1',
    ])
  })

  it('shows price label only for non-free orders', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order({ price: '10', currency: 'SPACE' })],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders[0]?.priceLabel).toBe('10 SPACE')
  })

  it('leaves price label undefined for free orders', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order({ price: '0' })],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders[0]?.priceLabel).toBeUndefined()
  })

  it('builds paymentReference preferring paymentTxid', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          paymentTxid: 'txid-1',
          paymentCommitTxid: 'commit-1',
          orderReference: 'order-1',
          orderPinId: 'pin-1',
        }),
      ],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders[0]?.paymentReference).toBe('txid-1')
  })
})
