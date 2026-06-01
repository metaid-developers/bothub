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

  it('merges a provider reply carrying orderCorrelationId into the cached order', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'status-1',
            content: '[ORDER_STATUS:order-1] Working on it',
            rawContent: '[ORDER_STATUS:order-1] Working on it',
            orderCorrelationId: 'order-1',
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      source: 'order',
      status: 'active',
      messageCount: 1,
    })
    expect(workspace.orders[0]?.messages.map((row) => row.id)).toEqual(['status-1'])
  })

  it('matches a DELIVERY tag to a cached order when the raw message has no stored correlation id', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'delivery-with-tag',
            content: '[DELIVERY:order-1] Done metafile://image.png',
            rawContent: '[DELIVERY:order-1] Done metafile://image.png',
            orderCorrelationId: undefined,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      status: 'delivered',
      messageCount: 1,
      assetCount: 1,
    })
    expect(workspace.orders[0]?.messages[0]?.id).toBe('delivery-with-tag')
    expect(workspace.orders[0]?.assets[0]?.filename).toBe('image.png')
  })

  it('derives merged cached-order status from delivery messages when a stored session is stale', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order({ status: 'waiting' })],
      sessions: [session({ status: 'waiting' })],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'delivery-after-stale-session',
            content: '[DELIVERY:order-1] Done metafile://image.png',
            rawContent: '[DELIVERY:order-1] Done metafile://image.png',
            orderCorrelationId: undefined,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      status: 'delivered',
      messageCount: 1,
      assetCount: 1,
    })
  })

  it('matches a paid provider reply by payment txid without collapsing same-provider orders', () => {
    const txid = 'paid-txid-123'
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:free-order`,
          orderReference: 'free-order',
          displaySummary: 'Free order',
          rawRequest: 'Free order',
          updatedAt: 30,
        }),
        order({
          id: `${SELF}:${PROVIDER}:${txid}`,
          orderReference: undefined,
          paymentTxid: txid,
          price: '25',
          displaySummary: 'Paid order',
          rawRequest: 'Paid order',
          updatedAt: 20,
        }),
      ],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'paid-delivery',
            content: `Payment ${txid} received. Here is metafile://paid.png`,
            rawContent: `Payment ${txid} received. Here is metafile://paid.png`,
            orderCorrelationId: undefined,
            timestamp: 55,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(2)
    const freeOrder = workspace.orders.find((row) => row.orderCorrelationId === 'free-order')
    const paidOrder = workspace.orders.find((row) => row.orderCorrelationId === txid)

    expect(freeOrder).toMatchObject({ messageCount: 0, assetCount: 0 })
    expect(paidOrder).toMatchObject({
      id: `${SELF}:${PROVIDER}:${txid}`,
      messageCount: 1,
      assetCount: 1,
      paymentReference: txid,
    })
    expect(paidOrder?.messages.map((row) => row.id)).toEqual(['paid-delivery'])
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

  it('shows unassociated historical provider messages alongside cached orders', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'historical-delivery',
            content: 'Older delivery note metafile://history.png',
            rawContent: 'Older delivery note metafile://history.png',
            orderCorrelationId: undefined,
            timestamp: 5,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.orders.map((row) => row.id)).toEqual([
      `${SELF}:${PROVIDER}:order-1`,
      `${SELF}:${PROVIDER}:uncorrelated`,
    ])
    expect(workspace.orders[1]).toMatchObject({
      source: 'session',
      serviceLabel: '历史交付',
      requestSummary: '历史交付',
      messageCount: 1,
      assetCount: 1,
    })
  })

  it('keeps cached assets visible when provider profile fields are missing', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          providerChatPubkey: undefined,
          providerName: undefined,
          providerAvatarUrl: undefined,
        }),
      ],
      sessions: [
        session({
          providerChatPubkey: undefined,
          providerName: undefined,
          providerAvatarUrl: undefined,
        }),
      ],
      byPeer: {},
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    expect(workspace.orders[0]).toMatchObject({
      providerName: undefined,
      assetCount: 1,
    })
    expect(workspace.orders[0]?.assets[0]?.downloadUrl).toBe('https://file.example/image')
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
