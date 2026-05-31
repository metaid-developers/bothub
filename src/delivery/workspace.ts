import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import { buildSessionId } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  deliveryAssetsForSession,
  deriveSessionStatus,
} from '@/delivery/sessionDisplay'
import {
  buildSessionKey,
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'

export interface WorkspaceOrder {
  id: string
  sessionId: string
  sessionKey: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  serviceId?: string
  serviceLabel: string
  requestSummary: string
  rawRequest?: string
  outputType?: BuyerOrder['outputType']
  priceLabel?: string
  paymentReference?: string
  orderCorrelationId: string | null
  status: WorkspaceOrderStatus
  assetCount: number
  messageCount: number
  unreadCount: number
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  messages: DeliveryMessage[]
  assets: ReturnType<typeof deliveryAssetsForSession>
  source: 'order' | 'session' | 'merged'
}

export type WorkspaceOrderStatus =
  | 'sending'
  | 'waiting'
  | 'active'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'failed_to_send'

export interface DeliveryWorkspace {
  walletGlobalMetaId: string
  orders: WorkspaceOrder[]
  totalCount: number
  activeCount: number
  deliveredCount: number
  assetCount: number
  latestActivityAt: number | null
}

export const STATUS_LABELS: Record<WorkspaceOrderStatus, string> = {
  sending: 'delivery.workspace.status.sending',
  waiting: 'delivery.workspace.status.waiting',
  active: 'delivery.workspace.status.active',
  delivering: 'delivery.workspace.status.delivering',
  delivered: 'delivery.workspace.status.delivered',
  completed: 'delivery.workspace.status.completed',
  failed: 'delivery.workspace.status.failed',
  failed_to_send: 'delivery.workspace.status.failed_to_send',
}

function normalizeOrderStatus(status: string): WorkspaceOrderStatus {
  switch (status) {
    case 'draft':
    case 'sending':
    case 'paying':
    case 'broadcasting':
      return 'sending'
    case 'waiting':
    case 'pending_provider':
      return 'waiting'
    case 'in_progress':
      return 'active'
    case 'delivering':
      return 'delivering'
    case 'delivered':
      return 'delivered'
    case 'completed':
    case 'needs_rating_reserved':
      return 'completed'
    case 'failed':
    case 'refund_reserved':
      return 'failed'
    case 'failed_to_send':
      return 'failed_to_send'
    case 'active':
      return 'active'
    default:
      return 'waiting'
  }
}

function normalizeSessionStatus(status: string): WorkspaceOrderStatus {
  switch (status) {
    case 'sending':
      return 'sending'
    case 'pending':
    case 'waiting':
      return 'waiting'
    case 'active':
      return 'active'
    case 'delivering':
      return 'delivering'
    case 'delivered':
      return 'delivered'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'failed_to_send':
      return 'failed_to_send'
    default:
      return 'waiting'
  }
}

function deriveWorkspaceStatus(
  messages: DeliveryMessage[],
  walletGlobalMetaId: string,
): WorkspaceOrderStatus {
  const derived = deriveSessionStatus(messages, walletGlobalMetaId)
  return normalizeSessionStatus(derived)
}

function buildPriceLabel(order: BuyerOrder): string | undefined {
  if (order.price === '0' || order.price === '') return undefined
  return `${order.price} ${order.currency}`
}

function buildPaymentReference(order: BuyerOrder): string | undefined {
  return (
    order.paymentTxid?.trim() ||
    order.paymentCommitTxid?.trim() ||
    order.orderReference?.trim() ||
    order.orderPinId?.trim() ||
    undefined
  )
}

function isActiveStatus(status: WorkspaceOrderStatus): boolean {
  return !['completed', 'failed', 'failed_to_send'].includes(status)
}

function sortWorkspaceOrders(orders: WorkspaceOrder[]): WorkspaceOrder[] {
  return [...orders].sort((a, b) => {
    const aActive = isActiveStatus(a.status) ? 0 : 1
    const bActive = isActiveStatus(b.status) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    if (a.lastActivityAt !== b.lastActivityAt) return b.lastActivityAt - a.lastActivityAt
    return a.id.localeCompare(b.id)
  })
}

export function buildDeliveryWorkspace(input: {
  walletGlobalMetaId: string
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  byPeer: Record<string, DeliveryMessage[]>
  assetsBySession: Record<string, DeliveryAssetRecord[]>
}): DeliveryWorkspace {
  const walletGlobalMetaId = input.walletGlobalMetaId.trim()

  const orderMap = new Map<string, WorkspaceOrder>()

  const orderById = new Map<string, BuyerOrder>()
  for (const order of input.orders) {
    orderById.set(order.id, order)
  }

  for (const session of input.sessions) {
    const sessionId = session.id
    const sessionKey = buildSessionKey(session.providerGlobalMetaId, session.orderCorrelationId)
    const messages = resolveMessagesForSession(input.byPeer, sessionKey, walletGlobalMetaId)
    const storedAssets = input.assetsBySession[sessionId] ?? []
    const assets = deliveryAssetsForSession(messages, storedAssets)

    const existingOrder = orderById.get(sessionId)
    const existing = orderMap.get(sessionId)

    const merged = {
      id: sessionId,
      sessionId,
      sessionKey,
      providerGlobalMetaId: session.providerGlobalMetaId.trim(),
      providerChatPubkey:
        existingOrder?.providerChatPubkey?.trim() ||
        session.providerChatPubkey?.trim() ||
        existing?.providerChatPubkey ||
        undefined,
      providerName:
        existingOrder?.providerName?.trim() ||
        session.providerName?.trim() ||
        existing?.providerName ||
        undefined,
      providerAvatarUrl:
        existingOrder?.providerAvatarUrl?.trim() ||
        session.providerAvatarUrl?.trim() ||
        existing?.providerAvatarUrl ||
        undefined,
      serviceId: existingOrder?.serviceId || session.serviceId,
      serviceLabel:
        existingOrder?.serviceName?.trim() ||
        session.serviceLabel?.trim() ||
        existing?.serviceLabel ||
        '',
      requestSummary:
        existingOrder?.displaySummary?.trim() ||
        existing?.requestSummary ||
        session.serviceLabel?.trim() ||
        'Delivery request',
      rawRequest: existingOrder?.rawRequest || existing?.rawRequest,
      outputType: existingOrder?.outputType || existing?.outputType,
      priceLabel: existingOrder ? buildPriceLabel(existingOrder) : existing?.priceLabel,
      paymentReference: existingOrder
        ? buildPaymentReference(existingOrder)
        : existing?.paymentReference,
      orderCorrelationId:
        existingOrder?.orderReference?.trim() ||
        session.orderCorrelationId?.trim() ||
        existing?.orderCorrelationId ||
        null,
      status: existing
        ? (existing.status !== 'waiting' ? existing.status : normalizeSessionStatus(session.status))
        : normalizeSessionStatus(session.status),
      assetCount: assets.length,
      messageCount: messages.length,
      unreadCount: session.unreadCount,
      createdAt: existingOrder?.createdAt ?? session.lastActivityAt,
      updatedAt: existingOrder?.updatedAt ?? session.lastActivityAt,
      lastActivityAt: session.lastActivityAt,
      messages,
      assets,
      source: (existingOrder ? 'merged' : 'session') as WorkspaceOrder['source'],
    }

    if (messages.length > 0 && !existingOrder) {
      merged.status = deriveWorkspaceStatus(messages, walletGlobalMetaId)
    }

    if (existing) {
      merged.assetCount = existing.assetCount + assets.length - (input.assetsBySession[sessionId]?.length ?? 0)
      merged.messageCount = Math.max(existing.messageCount, messages.length)
      merged.unreadCount = existing.unreadCount + merged.unreadCount
    }

    orderMap.set(sessionId, merged)
  }

  for (const order of input.orders) {
    const orderId = order.id
    if (orderMap.has(orderId)) continue

    const sessionKey = buildSessionKey(order.providerGlobalMetaId, order.orderReference)
    const messages = resolveMessagesForSession(input.byPeer, sessionKey, walletGlobalMetaId)
    const storedAssets = input.assetsBySession[orderId] ?? []
    const assets = deliveryAssetsForSession(messages, storedAssets)

    let status: WorkspaceOrderStatus
    if (messages.length > 0) {
      status = deriveWorkspaceStatus(messages, walletGlobalMetaId)
    } else {
      status = normalizeOrderStatus(order.status)
    }

    orderMap.set(orderId, {
      id: orderId,
      sessionId: orderId,
      sessionKey,
      providerGlobalMetaId: order.providerGlobalMetaId.trim(),
      providerChatPubkey: order.providerChatPubkey?.trim() || undefined,
      providerName: order.providerName?.trim() || undefined,
      providerAvatarUrl: order.providerAvatarUrl?.trim() || undefined,
      serviceId: order.serviceId,
      serviceLabel: order.serviceName || order.skillName,
      requestSummary: order.displaySummary || order.rawRequest,
      rawRequest: order.rawRequest,
      outputType: order.outputType,
      priceLabel: buildPriceLabel(order),
      paymentReference: buildPaymentReference(order),
      orderCorrelationId: order.orderReference?.trim() || null,
      status,
      assetCount: assets.length,
      messageCount: messages.length,
      unreadCount: 0,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lastActivityAt: order.updatedAt,
      messages,
      assets,
      source: 'order',
    })
  }

  const workspaceOrders = sortWorkspaceOrders(Array.from(orderMap.values()))

  const activeCount = workspaceOrders.filter(
    (o) => !['completed', 'failed', 'failed_to_send'].includes(o.status),
  ).length
  const deliveredCount = workspaceOrders.filter(
    (o) => o.status === 'delivered' || o.status === 'completed',
  ).length
  const totalAssetCount = workspaceOrders.reduce((sum, o) => sum + o.assetCount, 0)

  return {
    walletGlobalMetaId,
    orders: workspaceOrders,
    totalCount: workspaceOrders.length,
    activeCount,
    deliveredCount,
    assetCount: totalAssetCount,
    latestActivityAt: workspaceOrders[0]?.lastActivityAt ?? null,
  }
}

export function selectWorkspaceOrder(
  workspace: DeliveryWorkspace,
  selectedId: string | null | undefined,
): WorkspaceOrder | null {
  const target = selectedId?.trim()
  if (target) {
    const match = workspace.orders.find((order) => order.id === target)
    if (match) return match
  }
  return workspace.orders[0] ?? null
}
