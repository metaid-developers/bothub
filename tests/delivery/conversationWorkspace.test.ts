import { describe, expect, it } from 'vitest'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  assetsForConversation,
  buildDeliveryConversations,
  messagesForConversation,
  resolveDeliveryRouteSelection,
  selectDeliveryConversation,
  selectDeliveryTab,
  selectOrderThread,
  type DeliveryConversationTab,
} from '@/delivery/conversationWorkspace'

const SELF = 'idqbuyer'
const PROVIDER = 'idqprovider'

function order(overrides: Partial<BuyerOrder> = {}): BuyerOrder {
  return {
    id: `${SELF}:${PROVIDER}:order-pin-1`,
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
    orderReference: 'legacy-ref-1',
    orderPinId: 'order-pin-1',
    status: 'waiting',
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  }
}

function session(overrides: Partial<DeliverySessionRecord> = {}): DeliverySessionRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-pin-1`,
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-key',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    orderCorrelationId: 'order-pin-1',
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
    content: '[DELIVERY:order-pin-1] Done metafile://one.png',
    rawContent: '[DELIVERY:order-pin-1] Done metafile://one.png',
    encryption: 'plain',
    contentType: 'text/plain',
    timestamp: 50,
    ...overrides,
  }
}

function asset(overrides: Partial<DeliveryAssetRecord> = {}): DeliveryAssetRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-pin-1:metafile://one.png`,
    walletGlobalMetaId: SELF,
    sessionId: `${SELF}:${PROVIDER}:order-pin-1`,
    messageId: 'delivery-1',
    orderCorrelationId: 'order-pin-1',
    uri: 'metafile://one.png',
    pinId: 'one',
    filename: 'one.png',
    extension: 'png',
    kind: 'image',
    mimeType: 'image/png',
    previewUrl: 'https://file.example/one-preview',
    downloadUrl: 'https://file.example/one',
    fallbackUrl: 'https://file.example/one-fallback',
    createdAt: 50,
    ...overrides,
  }
}

function orderTab(orderCorrelationId: string, orderId = `${SELF}:${PROVIDER}:${orderCorrelationId}`): DeliveryConversationTab {
  return {
    kind: 'order',
    id: `order:${orderCorrelationId}`,
    orderCorrelationId,
    orderId,
  }
}

describe('delivery conversation workspace', () => {
  it('groups multiple orders from one provider into one conversation with order tabs', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:order-pin-1`,
          orderPinId: 'order-pin-1',
          paymentTxid: 'pay-tx-1',
          updatedAt: 10,
        }),
        order({
          id: `${SELF}:${PROVIDER}:order-pin-2`,
          orderPinId: 'order-pin-2',
          orderReference: 'legacy-ref-2',
          paymentTxid: 'pay-tx-2',
          updatedAt: 20,
        }),
      ],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'chat-1',
            content: 'Can I try this first?',
            rawContent: 'Can I try this first?',
            orderCorrelationId: undefined,
            timestamp: 5,
          }),
          message({
            id: 'status-1',
            content: '[ORDER_STATUS:order-pin-1] Working',
            rawContent: '[ORDER_STATUS:order-pin-1] Working',
            orderCorrelationId: undefined,
            timestamp: 30,
          }),
          message({
            id: 'delivery-2',
            content: '[DELIVERY:order-pin-2] Ready metafile://two.png',
            rawContent: '[DELIVERY:order-pin-2] Ready metafile://two.png',
            orderCorrelationId: undefined,
            timestamp: 40,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.conversations).toHaveLength(1)
    const conversation = workspace.conversations[0]
    expect(conversation).toMatchObject({
      providerGlobalMetaId: PROVIDER,
      messageCount: 3,
      assetCount: 1,
    })
    expect(conversation?.orderThreads.map((thread) => thread.orderCorrelationId)).toEqual([
      'order-pin-1',
      'order-pin-2',
    ])
    expect(conversation?.messages.map((row) => row.id)).toEqual([
      'chat-1',
      'status-1',
      'delivery-2',
    ])
  })

  it('counts delivered orders separately from in-progress orders', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          orderPinId: 'delivered-pin',
          id: `${SELF}:${PROVIDER}:delivered-pin`,
          status: 'delivered',
          updatedAt: 50,
        }),
      ],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.activeOrderCount).toBe(0)
    expect(workspace.deliveredOrderCount).toBe(1)
    expect(workspace.conversations[0]?.activeOrderCount).toBe(0)
    expect(workspace.conversations[0]?.deliveredOrderCount).toBe(1)
  })

  it('keeps ambiguous unscoped protocol messages only in All when multiple active orders exist', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:order-pin-1`,
          orderPinId: 'order-pin-1',
          status: 'waiting',
          updatedAt: 10,
        }),
        order({
          id: `${SELF}:${PROVIDER}:order-pin-2`,
          orderPinId: 'order-pin-2',
          orderReference: 'legacy-ref-2',
          status: 'waiting',
          updatedAt: 11,
        }),
      ],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'unscoped-delivery',
            content: '[DELIVERY] Ready metafile://ambiguous.png',
            rawContent: '[DELIVERY] Ready metafile://ambiguous.png',
            orderCorrelationId: undefined,
            timestamp: 12,
          }),
        ],
      },
      assetsBySession: {},
    })
    const conversation = workspace.conversations[0]!

    expect(messagesForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.id)).toEqual([
      'unscoped-delivery',
    ])
    expect(conversation.orderThreads.flatMap((thread) => thread.messages.map((row) => row.id))).not.toContain(
      'unscoped-delivery',
    )
    expect(assetsForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.filename)).toEqual([
      'ambiguous.png',
    ])
    expect(conversation.orderThreads.flatMap((thread) => thread.assets.map((row) => row.filename))).not.toContain(
      'ambiguous.png',
    )
  })

  it('assigns terminal and rating protocol messages to All and the explicit order tab', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1' })],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'end-1',
            content: '[ORDER_END:order-pin-1] Done',
            rawContent: '[ORDER_END:order-pin-1] Done',
            orderCorrelationId: undefined,
            timestamp: 20,
          }),
          message({
            id: 'rating-1',
            content: '[NeedsRating:order-pin-1] Please rate',
            rawContent: '[NeedsRating:order-pin-1] Please rate',
            orderCorrelationId: undefined,
            timestamp: 21,
          }),
        ],
      },
      assetsBySession: {},
    })
    const conversation = workspace.conversations[0]!

    expect(messagesForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.id)).toEqual([
      'end-1',
      'rating-1',
    ])
    expect(messagesForConversation(conversation, orderTab('order-pin-1')).map((row) => row.id)).toEqual([
      'end-1',
      'rating-1',
    ])
  })

  it('merges provider aliases only when chat pubkey matches and profile fields do not conflict', () => {
    const providerAddress = '1ProviderAddress'
    const providerCanonical = 'idqproviderCanonical'
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${providerAddress}:order-pin-1`,
          providerGlobalMetaId: providerAddress,
          providerChatPubkey: 'same-chat-key',
          providerName: 'Render Bot',
          orderPinId: 'order-pin-1',
        }),
      ],
      sessions: [],
      byPeer: {
        [providerCanonical]: [
          message({
            id: 'alias-chat',
            peerGlobalMetaId: providerCanonical,
            peerChatPubkey: 'same-chat-key',
            peerName: 'Render Bot',
            content: 'Alias side message',
            rawContent: 'Alias side message',
            orderCorrelationId: undefined,
            timestamp: 30,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.conversations).toHaveLength(1)
    expect(workspace.conversations[0]?.id).toBe(providerCanonical)
    expect(workspace.conversations[0]?.messages.map((row) => row.id)).toContain('alias-chat')
  })

  it('merges provider address conversations when the fetched profile maps them to a globalMetaId', () => {
    const providerAddress = '1GrqX7K9jdnUor8hAoAfDx99uFH2tT75Za'
    const providerCanonical = 'idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz'
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [],
      sessions: [
        session({
          id: `${SELF}:${providerCanonical}:order-pin-1`,
          providerGlobalMetaId: providerCanonical,
          providerChatPubkey: undefined,
          providerName: 'AI_Sunny',
          orderCorrelationId: 'order-pin-1',
          lastActivityAt: 30,
        }),
      ],
      byPeer: {
        [providerAddress]: [
          message({
            id: 'address-side-encrypted',
            peerGlobalMetaId: providerAddress,
            peerChatPubkey: undefined,
            peerName: undefined,
            content: 'U2FsdGVkX1encrypted-delivery',
            rawContent: 'U2FsdGVkX1encrypted-delivery',
            encryption: 'ecdh',
            timestamp: 40,
            decryptError: 'missing peer chat key',
          }),
        ],
      },
      assetsBySession: {},
      providerProfiles: {
        [providerAddress]: {
          globalMetaId: providerCanonical,
          address: providerAddress,
        },
      },
    })

    expect(workspace.conversations).toHaveLength(1)
    expect(workspace.conversations[0]).toMatchObject({
      id: providerCanonical,
      providerGlobalMetaId: providerCanonical,
      providerName: 'AI_Sunny',
      messageCount: 1,
    })
  })

  it('does not merge provider aliases when profile fields conflict', () => {
    const providerAddress = '1ProviderAddress'
    const providerCanonical = 'idqproviderCanonical'
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${providerAddress}:order-pin-1`,
          providerGlobalMetaId: providerAddress,
          providerChatPubkey: 'same-chat-key',
          providerName: 'Render Bot',
          orderPinId: 'order-pin-1',
        }),
      ],
      sessions: [],
      byPeer: {
        [providerCanonical]: [
          message({
            id: 'conflicting-alias-chat',
            peerGlobalMetaId: providerCanonical,
            peerChatPubkey: 'same-chat-key',
            peerName: 'Different Bot',
            content: 'Conflicting alias side message',
            rawContent: 'Conflicting alias side message',
            orderCorrelationId: undefined,
            timestamp: 30,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(workspace.conversations.map((conversation) => conversation.id).sort()).toEqual([
      providerAddress,
      providerCanonical,
    ].sort())
  })

  it('scopes assets to All or a selected order tab', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1' }),
        order({
          id: `${SELF}:${PROVIDER}:order-pin-2`,
          orderPinId: 'order-pin-2',
          orderReference: 'legacy-ref-2',
        }),
      ],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'delivery-1',
            content: '[DELIVERY:order-pin-1] Ready metafile://one.png',
            rawContent: '[DELIVERY:order-pin-1] Ready metafile://one.png',
            orderCorrelationId: undefined,
            timestamp: 10,
          }),
          message({
            id: 'delivery-2',
            content: '[DELIVERY:order-pin-2] Ready metafile://two.png',
            rawContent: '[DELIVERY:order-pin-2] Ready metafile://two.png',
            orderCorrelationId: undefined,
            timestamp: 11,
          }),
        ],
      },
      assetsBySession: {},
    })
    const conversation = workspace.conversations[0]!

    expect(assetsForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.filename)).toEqual([
      'one.png',
      'two.png',
    ])
    expect(assetsForConversation(conversation, orderTab('order-pin-1')).map((row) => row.filename)).toEqual([
      'one.png',
    ])
  })

  it('resolves old order and session URL params to conversation plus order tab', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:order-pin-1`,
          orderPinId: 'order-pin-1',
          paymentTxid: 'pay-tx-1',
          orderReference: 'legacy-ref-1',
        }),
      ],
      sessions: [session()],
      byPeer: {},
      assetsBySession: {},
    })

    expect(
      resolveDeliveryRouteSelection({
        workspace,
        conversationParam: null,
        orderParam: `${SELF}:${PROVIDER}:order-pin-1`,
        sessionParam: null,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })

    expect(
      resolveDeliveryRouteSelection({
        workspace,
        conversationParam: null,
        orderParam: 'pay-tx-1',
        sessionParam: null,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })

    expect(
      resolveDeliveryRouteSelection({
        workspace,
        conversationParam: null,
        orderParam: 'legacy-ref-1',
        sessionParam: null,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })

    const reconstructedWorkspace = JSON.parse(JSON.stringify(workspace)) as typeof workspace
    expect(
      resolveDeliveryRouteSelection({
        workspace: reconstructedWorkspace,
        conversationParam: null,
        orderParam: 'pay-tx-1',
        sessionParam: null,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })
    expect(
      resolveDeliveryRouteSelection({
        workspace: reconstructedWorkspace,
        conversationParam: null,
        orderParam: 'legacy-ref-1',
        sessionParam: null,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })

    expect(
      resolveDeliveryRouteSelection({
        workspace,
        conversationParam: null,
        orderParam: null,
        sessionParam: `${PROVIDER}:order-pin-1`,
        walletGlobalMetaId: SELF,
      }),
    ).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })
  })

  it('select helpers fall back safely and select a known order thread', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1' })],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'status-1',
            content: '[ORDER_STATUS:order-pin-1] Working',
            rawContent: '[ORDER_STATUS:order-pin-1] Working',
            timestamp: 20,
          }),
        ],
      },
      assetsBySession: {},
    })

    expect(selectDeliveryConversation(workspace, null)?.id).toBe(PROVIDER)
    expect(selectDeliveryConversation(workspace, 'missing')?.id).toBe(PROVIDER)
    expect(selectDeliveryConversation({ ...workspace, conversations: [] }, null)).toBeNull()

    const conversation = workspace.conversations[0]!
    expect(selectDeliveryTab(null, 'order:order-pin-1')).toEqual({ kind: 'all', id: 'all' })
    expect(selectDeliveryTab(conversation, 'missing')).toEqual({ kind: 'all', id: 'all' })
    const tab = selectDeliveryTab(conversation, 'order:order-pin-1')
    expect(tab).toEqual(orderTab('order-pin-1'))
    expect(selectOrderThread(conversation, tab)?.orderCorrelationId).toBe('order-pin-1')
    expect(selectOrderThread(conversation, { kind: 'all', id: 'all' })).toBeNull()
    expect(messagesForConversation(null, { kind: 'all', id: 'all' })).toEqual([])
    expect(assetsForConversation(null, { kind: 'all', id: 'all' })).toEqual([])
  })

  it('assigns legacy payment txid tags to the canonical order tab', () => {
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:order-pin-1`,
          orderPinId: 'order-pin-1',
          paymentTxid: 'pay-tx-1',
          orderReference: 'legacy-ref-1',
        }),
      ],
      sessions: [
        session({
          id: `${SELF}:${PROVIDER}:pay-tx-1`,
          orderCorrelationId: 'pay-tx-1',
        }),
      ],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'legacy-delivery',
            content: '[DELIVERY:pay-tx-1] Ready metafile://legacy.png',
            rawContent: '[DELIVERY:pay-tx-1] Ready metafile://legacy.png',
            orderCorrelationId: undefined,
            timestamp: 20,
          }),
        ],
      },
      assetsBySession: {
        [`${SELF}:${PROVIDER}:pay-tx-1`]: [
          asset({
            id: `${SELF}:${PROVIDER}:pay-tx-1:metafile://stored-legacy.png`,
            sessionId: `${SELF}:${PROVIDER}:pay-tx-1`,
            orderCorrelationId: 'pay-tx-1',
            uri: 'metafile://stored-legacy.png',
            pinId: 'stored-legacy',
            filename: 'stored-legacy.png',
          }),
        ],
      },
    })
    const conversation = workspace.conversations[0]!
    const thread = conversation.orderThreads[0]

    expect(thread?.orderCorrelationId).toBe('order-pin-1')
    expect(messagesForConversation(conversation, orderTab('order-pin-1')).map((row) => row.id)).toEqual([
      'legacy-delivery',
    ])
    expect(assetsForConversation(conversation, orderTab('order-pin-1')).map((row) => row.filename)).toEqual([
      'legacy.png',
      'stored-legacy.png',
    ])
  })

  it('infers unscoped protocol messages only for one active order within the 24h window', () => {
    const oneDayMs = 24 * 60 * 60 * 1000
    const workspace = buildDeliveryConversations({
      walletGlobalMetaId: SELF,
      orders: [
        order({
          id: `${SELF}:${PROVIDER}:active-pin`,
          orderPinId: 'active-pin',
          orderReference: 'active-ref',
          status: 'waiting',
          updatedAt: 1_000,
        }),
        order({
          id: `${SELF}:${PROVIDER}:completed-pin`,
          orderPinId: 'completed-pin',
          orderReference: 'completed-ref',
          status: 'completed',
          updatedAt: 1_100,
        }),
        order({
          id: `${SELF}:${PROVIDER}:stale-pin`,
          orderPinId: 'stale-pin',
          orderReference: 'stale-ref',
          status: 'waiting',
          createdAt: 1_000 - oneDayMs - 1,
          updatedAt: 1_000 - oneDayMs - 1,
        }),
      ],
      sessions: [],
      byPeer: {
        [PROVIDER]: [
          message({
            id: 'inferred-delivery',
            content: '[DELIVERY] Ready metafile://inferred.png',
            rawContent: '[DELIVERY] Ready metafile://inferred.png',
            orderCorrelationId: undefined,
            timestamp: 1_500,
          }),
        ],
      },
      assetsBySession: {},
    })
    const conversation = workspace.conversations[0]!

    expect(messagesForConversation(conversation, orderTab('active-pin', `${SELF}:${PROVIDER}:active-pin`)).map((row) => row.id)).toEqual([
      'inferred-delivery',
    ])
    expect(messagesForConversation(conversation, orderTab('completed-pin', `${SELF}:${PROVIDER}:completed-pin`))).toEqual([])
    expect(messagesForConversation(conversation, orderTab('stale-pin', `${SELF}:${PROVIDER}:stale-pin`))).toEqual([])
  })
})
