import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import { buildSessionId } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  findCorrelationInText,
  getOrderCorrelationId,
  parseOrderMessage,
} from '@/delivery/orderParser'
import { parseDeliveryProtocol } from '@/delivery/protocol'
import {
  deliveryAssetsForSession,
  deriveSessionStatus,
} from '@/delivery/sessionDisplay'
import {
  buildGroupedSessionList,
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

const HISTORICAL_DELIVERY_LABEL = '历史交付'
const FALLBACK_CORRELATION_WINDOW_MS = 24 * 60 * 60 * 1000

interface FallbackCorrelationCandidate {
  providerGlobalMetaId: string
  correlationId: string
  timestamp: number
}

interface DerivedMessageCorrelation {
  providerGlobalMetaId?: string
  orderCorrelationId: string
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

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)),
  )
}

function compositeIdTail(id: string): string {
  const trimmed = id.trim()
  const colon = trimmed.lastIndexOf(':')
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed
}

function orderCorrelationIdFor(order: BuyerOrder): string {
  return (
    order.paymentTxid?.trim() ||
    order.orderReference?.trim() ||
    compositeIdTail(order.id) ||
    order.id.trim()
  )
}

function orderCorrelationCandidates(order: BuyerOrder): string[] {
  const canonical = orderCorrelationIdFor(order)
  return uniqueValues([
    canonical,
    order.paymentTxid,
    order.paymentCommitTxid,
    order.orderReference,
    order.orderPinId,
    order.id,
  ])
}

function sessionCorrelationIdFor(session: DeliverySessionRecord): string {
  const direct = session.orderCorrelationId?.trim()
  if (direct) return direct
  const tail = compositeIdTail(session.id)
  return tail === 'uncorrelated' ? '' : tail
}

function orderJoinKey(providerGlobalMetaId: string, correlationId: string): string {
  return `${providerGlobalMetaId.trim()}:${correlationId.trim()}`
}

function addKnownCorrelation(
  known: Map<string, Map<string, string>>,
  providerGlobalMetaId: string,
  value: string | null | undefined,
  canonical: string | null | undefined,
): void {
  const peer = providerGlobalMetaId.trim()
  const rawValue = value?.trim()
  const rawCanonical = canonical?.trim()
  if (!peer || !rawValue || !rawCanonical) return
  const peerKnown = known.get(peer) ?? new Map<string, string>()
  peerKnown.set(rawValue, rawCanonical)
  known.set(peer, peerKnown)
}

function buildKnownCorrelations(input: {
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
}): Map<string, Map<string, string>> {
  const known = new Map<string, Map<string, string>>()

  for (const order of input.orders) {
    const canonical = orderCorrelationIdFor(order)
    for (const candidate of orderCorrelationCandidates(order)) {
      addKnownCorrelation(known, order.providerGlobalMetaId, candidate, canonical)
    }
  }

  for (const session of input.sessions) {
    const canonical = sessionCorrelationIdFor(session)
    addKnownCorrelation(known, session.providerGlobalMetaId, session.id, canonical)
    addKnownCorrelation(known, session.providerGlobalMetaId, session.orderCorrelationId, canonical)
  }

  return known
}

function timestampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 10_000_000_000 ? value * 1000 : value
}

function isRecoverableOrderStatus(status: string): boolean {
  return !['completed', 'failed'].includes(normalizeOrderStatus(status))
}

function isRecoverableSessionStatus(status: string): boolean {
  return !['completed', 'failed'].includes(normalizeSessionStatus(status))
}

function addFallbackCorrelation(
  candidates: Map<string, Map<string, FallbackCorrelationCandidate>>,
  providerGlobalMetaId: string,
  correlationId: string | null | undefined,
  timestamp: number,
): FallbackCorrelationCandidate | null {
  const peer = providerGlobalMetaId.trim()
  const canonical = correlationId?.trim()
  if (!peer || !canonical) return null

  const peerCandidates = candidates.get(peer) ?? new Map<string, FallbackCorrelationCandidate>()
  const candidateKey = `${peer}:${canonical}`
  const existing = peerCandidates.get(candidateKey)
  const normalizedTimestamp = timestampMs(timestamp)
  const candidate = {
    providerGlobalMetaId: peer,
    correlationId: canonical,
    timestamp: Math.max(existing?.timestamp ?? 0, normalizedTimestamp),
  }
  peerCandidates.set(candidateKey, candidate)
  candidates.set(peer, peerCandidates)
  return candidate
}

function addFallbackAlias(
  candidates: Map<string, Map<string, FallbackCorrelationCandidate>>,
  providerGlobalMetaId: string,
  candidate: FallbackCorrelationCandidate,
): void {
  const peer = providerGlobalMetaId.trim()
  if (!peer) return
  const peerCandidates = candidates.get(peer) ?? new Map<string, FallbackCorrelationCandidate>()
  const candidateKey = `${candidate.providerGlobalMetaId}:${candidate.correlationId}`
  const existing = peerCandidates.get(candidateKey)
  peerCandidates.set(candidateKey, {
    ...candidate,
    timestamp: Math.max(existing?.timestamp ?? 0, candidate.timestamp),
  })
  candidates.set(peer, peerCandidates)
}

function addFallbackByChatPubkey(
  byChatPubkey: Map<string, FallbackCorrelationCandidate[]>,
  chatPubkey: string | null | undefined,
  candidate: FallbackCorrelationCandidate | null,
): void {
  const key = chatPubkey?.trim()
  if (!key || !candidate) return
  byChatPubkey.set(key, [...(byChatPubkey.get(key) ?? []), candidate])
}

function buildFallbackCorrelations(input: {
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  byPeer: Record<string, DeliveryMessage[]>
}): Map<string, FallbackCorrelationCandidate[]> {
  const byPeer = new Map<string, Map<string, FallbackCorrelationCandidate>>()
  const byChatPubkey = new Map<string, FallbackCorrelationCandidate[]>()

  for (const order of input.orders) {
    if (!isRecoverableOrderStatus(order.status)) continue
    const candidate = addFallbackCorrelation(
      byPeer,
      order.providerGlobalMetaId,
      orderCorrelationIdFor(order),
      order.updatedAt || order.createdAt,
    )
    addFallbackByChatPubkey(byChatPubkey, order.providerChatPubkey, candidate)
  }

  for (const session of input.sessions) {
    if (!isRecoverableSessionStatus(session.status)) continue
    const candidate = addFallbackCorrelation(
      byPeer,
      session.providerGlobalMetaId,
      sessionCorrelationIdFor(session),
      session.lastActivityAt,
    )
    addFallbackByChatPubkey(byChatPubkey, session.providerChatPubkey, candidate)
  }

  for (const [peerGlobalMetaId, messages] of Object.entries(input.byPeer)) {
    const chatPubkey = messages.find((message) => message.peerChatPubkey?.trim())
      ?.peerChatPubkey
      ?.trim()
    const aliasCandidates = chatPubkey ? byChatPubkey.get(chatPubkey) : undefined
    if (!aliasCandidates?.length) continue
    for (const candidate of aliasCandidates) {
      addFallbackAlias(byPeer, peerGlobalMetaId, candidate)
    }
  }

  return new Map(
    Array.from(byPeer.entries()).map(([peer, peerCandidates]) => [
      peer,
      Array.from(peerCandidates.values()),
    ]),
  )
}

function canUseFallbackCorrelation(message: DeliveryMessage): boolean {
  if (parseOrderMessage(message.content)) return true
  const protocolTag = message.protocolTag?.trim()
  if (protocolTag) return protocolTag !== 'plain'
  return parseDeliveryProtocol(message.content).kind !== 'plain'
}

function fallbackCorrelationForMessage(
  message: DeliveryMessage,
  candidates: FallbackCorrelationCandidate[] | undefined,
): FallbackCorrelationCandidate | null {
  if (!candidates?.length || !canUseFallbackCorrelation(message)) return null

  const messageAt = timestampMs(message.timestamp)
  const timedCandidates = candidates.filter((candidate) => candidate.timestamp > 0)
  if (messageAt > 0 && timedCandidates.length > 0) {
    const ranked = timedCandidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.abs(candidate.timestamp - messageAt),
      }))
      .sort((a, b) => a.distance - b.distance || a.correlationId.localeCompare(b.correlationId))
    const best = ranked[0]
    if (!best || best.distance > FALLBACK_CORRELATION_WINDOW_MS) return null
    const tied = ranked.find(
      (candidate) =>
        (candidate.providerGlobalMetaId !== best.providerGlobalMetaId ||
          candidate.correlationId !== best.correlationId) &&
        candidate.distance === best.distance,
    )
    return tied ? null : best
  }

  return candidates.length === 1 ? candidates[0] : null
}

function canonicalCorrelation(
  peerKnown: Map<string, string> | undefined,
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  return peerKnown?.get(trimmed) ?? trimmed
}

function deriveMessageCorrelation(
  message: DeliveryMessage,
  peerKnown: Map<string, string> | undefined,
  fallbackCandidates: FallbackCorrelationCandidate[] | undefined,
): DerivedMessageCorrelation | null {
  const stored = canonicalCorrelation(peerKnown, message.orderCorrelationId)
  if (stored) return { orderCorrelationId: stored }

  const protocol = parseDeliveryProtocol(message.content).orderCorrelationId.trim()
  const protocolCorrelation = canonicalCorrelation(peerKnown, protocol)
  if (protocolCorrelation) return { orderCorrelationId: protocolCorrelation }

  const order = parseOrderMessage(message.content)
  const orderCorrelation = canonicalCorrelation(
    peerKnown,
    order ? getOrderCorrelationId(order) : '',
  )
  if (orderCorrelation) return { orderCorrelationId: orderCorrelation }

  if (peerKnown?.size) {
    const textCorrelation = canonicalCorrelation(
      peerKnown,
      findCorrelationInText(message.content, new Set(peerKnown.keys())),
    )
    if (textCorrelation) return { orderCorrelationId: textCorrelation }
  }

  const fallback = fallbackCorrelationForMessage(message, fallbackCandidates)
  return fallback
    ? {
        providerGlobalMetaId: fallback.providerGlobalMetaId,
        orderCorrelationId: fallback.correlationId,
      }
    : null
}

function appendNormalizedMessage(
  output: Map<string, Map<string, DeliveryMessage>>,
  peerGlobalMetaId: string,
  message: DeliveryMessage,
): void {
  const peer = peerGlobalMetaId.trim()
  if (!peer) return
  const messages = output.get(peer) ?? new Map<string, DeliveryMessage>()
  messages.set(message.id, message)
  output.set(peer, messages)
}

function normalizeMessagesByKnownCorrelations(
  byPeer: Record<string, DeliveryMessage[]>,
  known: Map<string, Map<string, string>>,
  fallbackCorrelations: Map<string, FallbackCorrelationCandidate[]>,
): Record<string, DeliveryMessage[]> {
  const output = new Map<string, Map<string, DeliveryMessage>>()
  for (const [peerGlobalMetaId, messages] of Object.entries(byPeer)) {
    const peer = peerGlobalMetaId.trim()
    const peerKnown = known.get(peer)
    const fallbackCandidates = fallbackCorrelations.get(peer)
    for (const message of messages) {
      const correlation = deriveMessageCorrelation(
        message,
        peerKnown,
        fallbackCandidates,
      )
      const targetPeer = correlation?.providerGlobalMetaId?.trim() || peer
      appendNormalizedMessage(
        output,
        targetPeer,
        correlation
          ? {
              ...message,
              peerGlobalMetaId: targetPeer,
              orderCorrelationId: correlation.orderCorrelationId,
            }
          : message,
      )
    }
  }

  return Object.fromEntries(
    Array.from(output.entries()).map(([peerGlobalMetaId, messages]) => [
      peerGlobalMetaId,
      Array.from(messages.values()),
    ]),
  )
}

function uniqueAssets(
  assets: DeliveryAssetRecord[],
): DeliveryAssetRecord[] {
  return Array.from(new Map(assets.map((asset) => [asset.id, asset])).values())
}

function assetsForSessionIds(
  assetsBySession: Record<string, DeliveryAssetRecord[]>,
  sessionIds: Array<string | null | undefined>,
): DeliveryAssetRecord[] {
  return uniqueAssets(
    uniqueValues(sessionIds).flatMap((sessionId) => assetsBySession[sessionId] ?? []),
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
  const knownCorrelations = buildKnownCorrelations({
    orders: input.orders,
    sessions: input.sessions,
  })
  const fallbackCorrelations = buildFallbackCorrelations({
    orders: input.orders,
    sessions: input.sessions,
    byPeer: input.byPeer,
  })
  const byPeer = normalizeMessagesByKnownCorrelations(
    input.byPeer,
    knownCorrelations,
    fallbackCorrelations,
  )

  const orderMap = new Map<string, WorkspaceOrder>()

  const orderById = new Map<string, BuyerOrder>()
  const orderByJoin = new Map<string, BuyerOrder>()
  for (const order of input.orders) {
    orderById.set(order.id, order)
    for (const candidate of orderCorrelationCandidates(order)) {
      const key = orderJoinKey(order.providerGlobalMetaId, candidate)
      if (!orderByJoin.has(key)) orderByJoin.set(key, order)
    }
  }

  for (const session of input.sessions) {
    const sessionId = session.id
    const sessionCorrelationId = sessionCorrelationIdFor(session)
    const existingOrder =
      orderById.get(sessionId) ||
      (sessionCorrelationId
        ? orderByJoin.get(orderJoinKey(session.providerGlobalMetaId, sessionCorrelationId))
        : undefined)
    const workspaceId = existingOrder?.id ?? sessionId
    const orderCorrelationId = existingOrder
      ? orderCorrelationIdFor(existingOrder)
      : sessionCorrelationId
    const sessionKey = buildSessionKey(session.providerGlobalMetaId, orderCorrelationId)
    const messages = resolveMessagesForSession(byPeer, sessionKey, walletGlobalMetaId)
    const storedAssets = assetsForSessionIds(input.assetsBySession, [sessionId, workspaceId])
    if (!sessionCorrelationId && messages.length === 0 && storedAssets.length === 0) {
      continue
    }
    const assets = deliveryAssetsForSession(messages, storedAssets)

    const existing = orderMap.get(workspaceId)

    const merged = {
      id: workspaceId,
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
        HISTORICAL_DELIVERY_LABEL,
      requestSummary:
        existingOrder?.displaySummary?.trim() ||
        existing?.requestSummary ||
        session.serviceLabel?.trim() ||
        HISTORICAL_DELIVERY_LABEL,
      rawRequest: existingOrder?.rawRequest || existing?.rawRequest,
      outputType: existingOrder?.outputType || existing?.outputType,
      priceLabel: existingOrder ? buildPriceLabel(existingOrder) : existing?.priceLabel,
      paymentReference: existingOrder
        ? buildPaymentReference(existingOrder)
        : existing?.paymentReference,
      orderCorrelationId:
        orderCorrelationId ||
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

    if (messages.length > 0) {
      merged.status = deriveWorkspaceStatus(messages, walletGlobalMetaId)
    }

    if (existing) {
      merged.assetCount = existing.assetCount + assets.length - (input.assetsBySession[sessionId]?.length ?? 0)
      merged.messageCount = Math.max(existing.messageCount, messages.length)
      merged.unreadCount = existing.unreadCount + merged.unreadCount
    }

    orderMap.set(workspaceId, merged)
  }

  for (const order of input.orders) {
    const orderId = order.id
    if (orderMap.has(orderId)) continue

    const orderCorrelationId = orderCorrelationIdFor(order)
    const sessionKey = buildSessionKey(order.providerGlobalMetaId, orderCorrelationId)
    const canonicalSessionId = buildSessionId({
      walletGlobalMetaId,
      providerGlobalMetaId: order.providerGlobalMetaId,
      orderCorrelationId,
    })
    const messages = resolveMessagesForSession(byPeer, sessionKey, walletGlobalMetaId)
    const storedAssets = assetsForSessionIds(input.assetsBySession, [orderId, canonicalSessionId])
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
      orderCorrelationId: orderCorrelationId || null,
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

  for (const session of buildGroupedSessionList(byPeer, walletGlobalMetaId)) {
    const correlationId = session.orderCorrelationId?.trim() || null
    if (
      correlationId &&
      orderByJoin.has(orderJoinKey(session.peerGlobalMetaId, correlationId))
    ) {
      continue
    }

    const sessionId = buildSessionId({
      walletGlobalMetaId,
      providerGlobalMetaId: session.peerGlobalMetaId,
      orderCorrelationId: correlationId,
    })
    if (orderMap.has(sessionId)) continue

    const messages = resolveMessagesForSession(byPeer, session.sessionKey, walletGlobalMetaId)
    const storedAssets = assetsForSessionIds(input.assetsBySession, [sessionId])
    const assets = deliveryAssetsForSession(messages, storedAssets)
    const firstMessage = messages[0]
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) continue

    orderMap.set(sessionId, {
      id: sessionId,
      sessionId,
      sessionKey: session.sessionKey,
      providerGlobalMetaId: session.peerGlobalMetaId.trim(),
      providerChatPubkey: session.providerChatPubkey?.trim() || undefined,
      providerName: session.peerName?.trim() || undefined,
      providerAvatarUrl: session.peerAvatarUrl?.trim() || undefined,
      serviceId: undefined,
      serviceLabel: session.serviceLabel?.trim() || HISTORICAL_DELIVERY_LABEL,
      requestSummary: session.serviceLabel?.trim() || HISTORICAL_DELIVERY_LABEL,
      orderCorrelationId: correlationId,
      status: deriveWorkspaceStatus(messages, walletGlobalMetaId),
      assetCount: assets.length,
      messageCount: messages.length,
      unreadCount: 0,
      createdAt: firstMessage?.timestamp ?? lastMessage.timestamp,
      updatedAt: lastMessage.timestamp,
      lastActivityAt: lastMessage.timestamp,
      messages,
      assets,
      source: 'session',
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
