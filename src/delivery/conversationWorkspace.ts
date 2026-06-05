import type { UserProfile } from '@/api/userProfile'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'
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
  deliveryAssetsFromMessages,
  deliveryAssetsFromRecords,
} from '@/delivery/sessionDisplay'
import { buildSessionKey, parseSessionKey } from '@/delivery/sessionGrouping'
import {
  buildDeliveryWorkspace,
  orderCorrelationCandidates,
  orderCorrelationIdFor,
  type DeliveryWorkspace,
  type WorkspaceOrder,
  type WorkspaceOrderStatus,
} from '@/delivery/workspace'
import { isGlobalMetaId } from '@/delivery/sessionId'

export type DeliveryConversationTab =
  | { kind: 'all'; id: 'all' }
  | { kind: 'order'; id: string; orderCorrelationId: string; orderId: string }

export interface DeliveryOrderThread {
  id: string
  tabId: string
  orderId: string
  orderCorrelationId: string
  serviceLabel: string
  requestSummary: string
  status: WorkspaceOrderStatus
  lastActivityAt: number
  assetCount: number
  messageCount: number
  order: WorkspaceOrder
  messages: DeliveryMessage[]
  assets: ParsedDeliveryAsset[]
  routeAliases: string[]
}

export interface DeliveryConversation {
  id: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  latestActivityAt: number
  lastMessage: DeliveryMessage | null
  messageCount: number
  activeOrderCount: number
  deliveredOrderCount: number
  assetCount: number
  messages: DeliveryMessage[]
  assets: ParsedDeliveryAsset[]
  orderThreads: DeliveryOrderThread[]
}

export interface DeliveryConversationWorkspace {
  walletGlobalMetaId: string
  conversations: DeliveryConversation[]
  orderWorkspace: DeliveryWorkspace
  totalCount: number
  activeOrderCount: number
  deliveredOrderCount: number
  assetCount: number
  latestActivityAt: number | null
}

export interface DeliveryConversationBuildInput {
  walletGlobalMetaId: string
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  byPeer: Record<string, DeliveryMessage[]>
  assetsBySession: Record<string, DeliveryAssetRecord[]>
  providerProfiles?: Record<string, Pick<UserProfile, 'globalMetaId' | 'address' | 'metaid'>>
  requestedConversations?: Array<{
    providerGlobalMetaId: string
    providerChatPubkey?: string
    providerName?: string
    providerAvatarUrl?: string
    latestActivityAt?: number
  }>
}

const ACTIVE_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000

interface PeerSource {
  peerId: string
  chatPubkey?: string
  name?: string
  avatarUrl?: string
  fromOrder: boolean
  latestMessageAt: number
}

interface PeerGroup {
  peerIds: Set<string>
  chatPubkey?: string
  name?: string
  avatarUrl?: string
  hasOrderProvider: boolean
  latestMessagePeerId?: string
  latestMessageAt: number
}

interface OrderContext {
  order: WorkspaceOrder
  aliases: Set<string>
}

function uniqueById<T>(items: T[], idFor: (item: T) => string): T[] {
  const output = new Map<string, T>()
  for (const item of items) {
    const id = idFor(item)
    if (!output.has(id)) output.set(id, item)
  }
  return Array.from(output.values())
}

function sortMessagesAsc(messages: DeliveryMessage[]): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.id.localeCompare(b.id)
  })
}

function tabIdForOrderCorrelation(orderCorrelationId: string): string {
  return `order:${orderCorrelationId.trim()}`
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)),
  )
}

function routeCandidatesForThread(thread: DeliveryOrderThread): string[] {
  return uniqueStrings([
    thread.tabId,
    thread.orderCorrelationId,
    thread.orderId,
    thread.order.id,
    thread.order.sessionId,
    thread.order.sessionKey,
    thread.order.paymentReference,
    ...thread.routeAliases,
  ])
}

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = normalize(value)
  return trimmed || undefined
}

function timestampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 10_000_000_000 ? value * 1000 : value
}

function isActiveStatus(status: WorkspaceOrderStatus): boolean {
  return !['completed', 'failed', 'failed_to_send'].includes(status)
}

function isInProgressStatus(status: WorkspaceOrderStatus): boolean {
  return !['delivered', 'completed', 'failed', 'failed_to_send'].includes(status)
}

function isDeliveredStatus(status: WorkspaceOrderStatus): boolean {
  return status === 'delivered' || status === 'completed'
}

function protocolKindForMessage(message: DeliveryMessage): string {
  const protocolTag = normalize(message.protocolTag)
  if (protocolTag) return protocolTag
  return parseDeliveryProtocol(message.content).kind
}

function isProtocolLikeMessage(message: DeliveryMessage): boolean {
  if (parseOrderMessage(message.content)) return true
  return protocolKindForMessage(message) !== 'plain'
}

function assetKey(asset: ParsedDeliveryAsset): string {
  return asset.uri || asset.pinId || asset.filename
}

function uniqueAssets(assets: ParsedDeliveryAsset[]): ParsedDeliveryAsset[] {
  return uniqueById(assets, assetKey)
}

function mergeField(
  current: string | undefined,
  incoming: string | undefined,
): string | undefined {
  return current || incoming
}

function conflicts(current: string | undefined, incoming: string | undefined): boolean {
  return Boolean(current && incoming && current !== incoming)
}

function canMergeSource(group: PeerGroup, source: PeerSource): boolean {
  if (!group.chatPubkey || !source.chatPubkey || group.chatPubkey !== source.chatPubkey) {
    return false
  }
  return !conflicts(group.name, source.name) && !conflicts(group.avatarUrl, source.avatarUrl)
}

function addSourceToGroup(group: PeerGroup, source: PeerSource): void {
  group.peerIds.add(source.peerId)
  group.chatPubkey = mergeField(group.chatPubkey, source.chatPubkey)
  group.name = mergeField(group.name, source.name)
  group.avatarUrl = mergeField(group.avatarUrl, source.avatarUrl)
  group.hasOrderProvider = group.hasOrderProvider || source.fromOrder
  if (source.latestMessageAt >= group.latestMessageAt) {
    group.latestMessageAt = source.latestMessageAt
    if (!source.fromOrder) group.latestMessagePeerId = source.peerId
  }
}

function createGroup(source: PeerSource): PeerGroup {
  return {
    peerIds: new Set([source.peerId]),
    chatPubkey: source.chatPubkey,
    name: source.name,
    avatarUrl: source.avatarUrl,
    hasOrderProvider: source.fromOrder,
    latestMessagePeerId: source.fromOrder ? undefined : source.peerId,
    latestMessageAt: source.latestMessageAt,
  }
}

function buildProfileAliasMap(
  providerProfiles: DeliveryConversationBuildInput['providerProfiles'] | undefined,
): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const [key, profile] of Object.entries(providerProfiles ?? {})) {
    const canonical = normalize(profile.globalMetaId)
    if (!isGlobalMetaId(canonical)) continue

    for (const alias of uniqueStrings([key, profile.address, profile.metaid, canonical])) {
      aliases.set(alias, canonical)
    }
  }
  return aliases
}

function canonicalPeerForProfileAlias(
  peerId: string,
  profileAliases: Map<string, string>,
): string {
  return profileAliases.get(normalize(peerId)) ?? normalize(peerId)
}

function addSourceToAliasGroup(
  group: PeerGroup,
  source: PeerSource,
  canonicalPeerId: string,
): void {
  addSourceToGroup(group, source)
  if (canonicalPeerId) group.peerIds.add(canonicalPeerId)
}

function createAliasGroup(source: PeerSource, canonicalPeerId: string): PeerGroup {
  const group = createGroup(source)
  if (canonicalPeerId) group.peerIds.add(canonicalPeerId)
  return group
}

function latestMessageProfile(messages: DeliveryMessage[]): PeerSource | null {
  const sorted = [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp
    return b.id.localeCompare(a.id)
  })
  const latest = sorted[0]
  if (!latest) return null
  const peerId = normalize(latest.peerGlobalMetaId)
  if (!peerId) return null
  return {
    peerId,
    chatPubkey: nonEmpty(latest.peerChatPubkey),
    name: nonEmpty(latest.peerName),
    avatarUrl: nonEmpty(latest.peerAvatarUrl),
    fromOrder: false,
    latestMessageAt: latest.timestamp,
  }
}

function buildPeerGroups(input: {
  orderWorkspace: DeliveryWorkspace
  byPeer: Record<string, DeliveryMessage[]>
  providerProfiles?: DeliveryConversationBuildInput['providerProfiles']
}): Map<string, string> {
  const sources = new Map<string, PeerSource>()
  const profileAliases = buildProfileAliasMap(input.providerProfiles)

  for (const order of input.orderWorkspace.orders) {
    const peerId = normalize(order.providerGlobalMetaId)
    if (!peerId) continue
    const existing = sources.get(peerId)
    sources.set(peerId, {
      peerId,
      chatPubkey: nonEmpty(order.providerChatPubkey) || existing?.chatPubkey,
      name: nonEmpty(order.providerName) || existing?.name,
      avatarUrl: nonEmpty(order.providerAvatarUrl) || existing?.avatarUrl,
      fromOrder: true,
      latestMessageAt: Math.max(existing?.latestMessageAt ?? 0, order.lastActivityAt),
    })
  }

  for (const [peerId, messages] of Object.entries(input.byPeer)) {
    const source = latestMessageProfile(messages)
    if (!source) continue
    const normalizedPeer = normalize(peerId) || source.peerId
    const existing = sources.get(normalizedPeer)
    sources.set(normalizedPeer, {
      peerId: normalizedPeer,
      chatPubkey: source.chatPubkey || existing?.chatPubkey,
      name: source.name || existing?.name,
      avatarUrl: source.avatarUrl || existing?.avatarUrl,
      fromOrder: existing?.fromOrder ?? false,
      latestMessageAt: Math.max(existing?.latestMessageAt ?? 0, source.latestMessageAt),
    })
  }

  const groups: PeerGroup[] = []
  const groupsByProfileAlias = new Map<string, PeerGroup>()
  for (const source of sources.values()) {
    const profileCanonical = canonicalPeerForProfileAlias(source.peerId, profileAliases)
    const target =
      groupsByProfileAlias.get(profileCanonical) ??
      groups.find((group) => canMergeSource(group, source))
    if (target) {
      addSourceToAliasGroup(target, source, profileCanonical)
      groupsByProfileAlias.set(profileCanonical, target)
    } else {
      const group = createAliasGroup(source, profileCanonical)
      groups.push(group)
      groupsByProfileAlias.set(profileCanonical, group)
    }
  }

  const peerToConversation = new Map<string, string>()
  for (const group of groups) {
    const peers = Array.from(group.peerIds)
    const canonical =
      peers.find((peer) => isGlobalMetaId(peer)) ||
      (group.hasOrderProvider
        ? peers.find((peer) =>
            input.orderWorkspace.orders.some((order) => order.providerGlobalMetaId === peer),
          )
        : undefined) ||
      group.latestMessagePeerId ||
      peers[0] ||
      ''
    for (const peer of peers) {
      peerToConversation.set(peer, canonical)
    }
  }

  for (const [alias, canonical] of profileAliases) {
    const conversation = peerToConversation.get(canonical) ?? canonical
    peerToConversation.set(alias, conversation)
    peerToConversation.set(canonical, conversation)
  }

  return peerToConversation
}

function addAlias(
  aliasesByProvider: Map<string, Map<string, string>>,
  providerGlobalMetaId: string,
  alias: string | null | undefined,
  canonical: string | null | undefined,
): void {
  const provider = normalize(providerGlobalMetaId)
  const key = normalize(alias)
  const value = normalize(canonical)
  if (!provider || !key || !value) return
  const aliases = aliasesByProvider.get(provider) ?? new Map<string, string>()
  aliases.set(key, value)
  aliasesByProvider.set(provider, aliases)
}

function buildAliasesByProvider(input: DeliveryConversationBuildInput): Map<string, Map<string, string>> {
  const aliasesByProvider = new Map<string, Map<string, string>>()

  for (const order of input.orders) {
    const canonical = orderCorrelationIdFor(order)
    for (const alias of orderCorrelationCandidates(order)) {
      addAlias(aliasesByProvider, order.providerGlobalMetaId, alias, canonical)
    }
  }

  for (const session of input.sessions) {
    const provider = session.providerGlobalMetaId
    const sessionCorrelation = normalize(session.orderCorrelationId) || compositeIdTail(session.id)
    const aliases = aliasesByProvider.get(provider)
    const canonical = aliases?.get(sessionCorrelation) ?? sessionCorrelation
    addAlias(aliasesByProvider, provider, session.id, canonical)
    addAlias(aliasesByProvider, provider, session.orderCorrelationId, canonical)
  }

  return aliasesByProvider
}

function compositeIdTail(id: string): string {
  const trimmed = normalize(id)
  const colon = trimmed.lastIndexOf(':')
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed
}

function canonicalCorrelation(
  aliases: Map<string, string>,
  value: string | null | undefined,
): string {
  const key = normalize(value)
  if (!key) return ''
  return aliases.get(key) ?? key
}

function explicitCorrelationForMessage(
  message: DeliveryMessage,
  aliases: Map<string, string>,
): string {
  const stored = canonicalCorrelation(aliases, message.orderCorrelationId)
  if (stored) return stored

  const protocol = parseDeliveryProtocol(message.content)
  const protocolCorrelation = canonicalCorrelation(aliases, protocol.orderCorrelationId)
  if (protocolCorrelation) return protocolCorrelation

  const parsedOrder = parseOrderMessage(message.content)
  const orderCorrelation = canonicalCorrelation(
    aliases,
    parsedOrder ? getOrderCorrelationId(parsedOrder) : '',
  )
  if (orderCorrelation) return orderCorrelation

  return canonicalCorrelation(
    aliases,
    findCorrelationInText(message.content, new Set(aliases.keys())),
  )
}

function orderTimeCandidates(order: WorkspaceOrder): number[] {
  return [order.createdAt, order.updatedAt, order.lastActivityAt]
    .map(timestampMs)
    .filter((value) => value > 0)
}

function canInferForOrder(order: WorkspaceOrder, messageTimestampMs: number): boolean {
  if (!isActiveStatus(order.status)) return false
  const orderTimes = orderTimeCandidates(order)
  if (messageTimestampMs <= 0) return orderTimes.length > 0
  return orderTimes.some((time) => Math.abs(time - messageTimestampMs) <= ACTIVE_ORDER_WINDOW_MS)
}

function inferredCorrelationForMessage(
  message: DeliveryMessage,
  orderContexts: OrderContext[],
): string {
  if (!isProtocolLikeMessage(message)) return ''
  const activeContexts = orderContexts.filter((context) => isActiveStatus(context.order.status))
  if (activeContexts.length === 0) return ''

  const messageAt = timestampMs(message.timestamp)
  const candidates =
    messageAt > 0
      ? activeContexts.filter((context) => canInferForOrder(context.order, messageAt))
      : activeContexts
  return candidates.length === 1 ? normalize(candidates[0]?.order.orderCorrelationId) : ''
}

function messageCorrelationForThread(
  message: DeliveryMessage,
  aliases: Map<string, string>,
  orderContexts: OrderContext[],
): string {
  const explicit = explicitCorrelationForMessage(message, aliases)
  if (explicit) return explicit
  return inferredCorrelationForMessage(message, orderContexts)
}

function isStoredAssetForOrder(
  record: DeliveryAssetRecord,
  context: OrderContext,
  walletGlobalMetaId: string,
): boolean {
  const explicit = normalize(record.orderCorrelationId)
  if (explicit && context.aliases.has(explicit)) return true

  const sessionId = normalize(record.sessionId)
  if (!sessionId) return false
  if ([context.order.id, context.order.sessionId].some((value) => normalize(value) === sessionId)) {
    return true
  }

  for (const alias of context.aliases) {
    const sessionForAlias = buildSessionId({
      walletGlobalMetaId,
      providerGlobalMetaId: context.order.providerGlobalMetaId,
      orderCorrelationId: alias,
    })
    if (sessionForAlias === sessionId) return true
  }

  return false
}

function storedAssetsForThread(input: {
  records: DeliveryAssetRecord[]
  context: OrderContext
  walletGlobalMetaId: string
}): ParsedDeliveryAsset[] {
  return deliveryAssetsFromRecords(
    input.records.filter((record) =>
      isStoredAssetForOrder(record, input.context, input.walletGlobalMetaId),
    ),
  )
}

function sortOrderThreads(threads: DeliveryOrderThread[]): DeliveryOrderThread[] {
  return [...threads].sort((a, b) => {
    const aActive = isInProgressStatus(a.status) ? 0 : 1
    const bActive = isInProgressStatus(b.status) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    if (a.lastActivityAt !== b.lastActivityAt) return b.lastActivityAt - a.lastActivityAt
    return a.id.localeCompare(b.id)
  })
}

function latestActivityForConversation(input: {
  messages: DeliveryMessage[]
  orderThreads: DeliveryOrderThread[]
}): number {
  const messageAt = input.messages[input.messages.length - 1]?.timestamp ?? 0
  const threadAt = input.orderThreads.reduce(
    (latest, thread) => Math.max(latest, thread.lastActivityAt),
    0,
  )
  return Math.max(messageAt, threadAt)
}

function buildOrderContexts(input: {
  orderWorkspace: DeliveryWorkspace
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
}): Map<string, OrderContext> {
  const byWorkspaceId = new Map(input.orders.map((order) => [order.id, order]))
  const sessionsByProvider = new Map<string, DeliverySessionRecord[]>()
  for (const session of input.sessions) {
    const rows = sessionsByProvider.get(session.providerGlobalMetaId) ?? []
    rows.push(session)
    sessionsByProvider.set(session.providerGlobalMetaId, rows)
  }

  const contexts = new Map<string, OrderContext>()
  for (const order of input.orderWorkspace.orders.filter((row) => row.orderCorrelationId)) {
    const canonical = normalize(order.orderCorrelationId)
    if (!canonical) continue
    const aliases = new Set<string>([
      canonical,
      order.id,
      order.sessionId,
      order.sessionKey,
      buildSessionKey(order.providerGlobalMetaId, canonical),
    ])
    const sourceOrder = byWorkspaceId.get(order.id)
    if (sourceOrder) {
      for (const alias of orderCorrelationCandidates(sourceOrder)) aliases.add(alias)
    }
    for (const session of sessionsByProvider.get(order.providerGlobalMetaId) ?? []) {
      const sessionCorrelation = normalize(session.orderCorrelationId) || compositeIdTail(session.id)
      if (aliases.has(sessionCorrelation)) {
        aliases.add(session.id)
        if (session.orderCorrelationId) aliases.add(session.orderCorrelationId)
      }
    }
    contexts.set(order.id, { order, aliases })
  }
  return contexts
}

export function buildDeliveryConversations(
  input: DeliveryConversationBuildInput,
): DeliveryConversationWorkspace {
  const orderWorkspace = buildDeliveryWorkspace(input)
  const peerToConversation = buildPeerGroups({
    orderWorkspace,
    byPeer: input.byPeer,
    providerProfiles: input.providerProfiles,
  })
  const aliasesByProvider = buildAliasesByProvider(input)
  const orderContextsById = buildOrderContexts({
    orderWorkspace,
    orders: input.orders,
    sessions: input.sessions,
  })

  const rawMessagesByConversation = new Map<string, DeliveryMessage[]>()
  for (const [peerGlobalMetaId, messages] of Object.entries(input.byPeer)) {
    const peer = normalize(peerGlobalMetaId)
    const conversationId = peerToConversation.get(peer) ?? peer
    rawMessagesByConversation.set(conversationId, [
      ...(rawMessagesByConversation.get(conversationId) ?? []),
      ...messages,
    ])
  }

  const orderContextsByConversation = new Map<string, OrderContext[]>()
  for (const context of orderContextsById.values()) {
    const provider = context.order.providerGlobalMetaId
    const conversationId = peerToConversation.get(provider) ?? provider
    orderContextsByConversation.set(conversationId, [
      ...(orderContextsByConversation.get(conversationId) ?? []),
      context,
    ])
  }

  for (const order of orderWorkspace.orders) {
    const conversationId = peerToConversation.get(order.providerGlobalMetaId) ?? order.providerGlobalMetaId
    if (!order.messages.length) continue
    rawMessagesByConversation.set(conversationId, [
      ...(rawMessagesByConversation.get(conversationId) ?? []),
      ...order.messages,
    ])
  }

  const storedRecordsByConversation = new Map<string, DeliveryAssetRecord[]>()
  for (const records of Object.values(input.assetsBySession)) {
    for (const record of records) {
      const sessionId = normalize(record.sessionId)
      const candidateProvider = input.sessions.find((row) => row.id === sessionId)
        ?.providerGlobalMetaId
      const provider =
        candidateProvider ||
        orderWorkspace.orders.find((order) =>
          [order.id, order.sessionId].some((value) => normalize(value) === sessionId),
        )?.providerGlobalMetaId
      if (!provider) continue
      const conversationId = peerToConversation.get(provider) ?? provider
      storedRecordsByConversation.set(conversationId, [
        ...(storedRecordsByConversation.get(conversationId) ?? []),
        record,
      ])
    }
  }

  const requestedConversations = new Map(
    (input.requestedConversations ?? [])
      .map((conversation) => [normalize(conversation.providerGlobalMetaId), conversation] as const)
      .filter(([providerGlobalMetaId]) => Boolean(providerGlobalMetaId)),
  )

  const conversationIds = new Set<string>([
    ...Array.from(rawMessagesByConversation.keys()),
    ...Array.from(orderContextsByConversation.keys()),
    ...Array.from(storedRecordsByConversation.keys()),
    ...Array.from(requestedConversations.keys()),
  ])

  const conversations: DeliveryConversation[] = []
  for (const conversationId of conversationIds) {
    const orderContexts = orderContextsByConversation.get(conversationId) ?? []
    const orderContextByCorrelation = new Map(
      orderContexts.map((context) => [normalize(context.order.orderCorrelationId), context]),
    )
    const aliases = new Map<string, string>()
    for (const context of orderContexts) {
      for (const alias of context.aliases) {
        aliases.set(alias, normalize(context.order.orderCorrelationId))
      }
      const providerAliases = aliasesByProvider.get(context.order.providerGlobalMetaId)
      for (const [alias, canonical] of providerAliases ?? []) aliases.set(alias, canonical)
    }

    const messages = sortMessagesAsc(uniqueById(rawMessagesByConversation.get(conversationId) ?? [], (row) => row.id))
    const assignedMessages = new Map<string, DeliveryMessage[]>()
    for (const message of messages) {
      const correlation = messageCorrelationForThread(message, aliases, orderContexts)
      if (!correlation) continue
      const context = orderContextByCorrelation.get(correlation)
      if (!context) continue
      assignedMessages.set(correlation, [...(assignedMessages.get(correlation) ?? []), message])
    }

    const storedRecords = storedRecordsByConversation.get(conversationId) ?? []
    const threads = sortOrderThreads(
      orderContexts.map((context) => {
        const orderCorrelationId = normalize(context.order.orderCorrelationId)
        const threadMessages = sortMessagesAsc(
          uniqueById(assignedMessages.get(orderCorrelationId) ?? [], (row) => row.id),
        )
        const threadAssets = uniqueAssets([
          ...deliveryAssetsFromMessages(threadMessages),
          ...storedAssetsForThread({
            records: storedRecords,
            context,
            walletGlobalMetaId: input.walletGlobalMetaId,
          }),
        ])
        const lastMessageAt = threadMessages[threadMessages.length - 1]?.timestamp ?? 0
        const lastActivityAt = Math.max(context.order.lastActivityAt, lastMessageAt)
        const routeAliases = uniqueStrings([
          context.order.id,
          context.order.sessionId,
          context.order.sessionKey,
          orderCorrelationId,
          tabIdForOrderCorrelation(orderCorrelationId),
          context.order.paymentReference,
          ...Array.from(context.aliases),
        ])

        return {
          id: context.order.id,
          tabId: tabIdForOrderCorrelation(orderCorrelationId),
          orderId: context.order.id,
          orderCorrelationId,
          serviceLabel: context.order.serviceLabel,
          requestSummary: context.order.requestSummary,
          status: context.order.status,
          lastActivityAt,
          assetCount: threadAssets.length,
          messageCount: threadMessages.length,
          order: context.order,
          messages: threadMessages,
          assets: threadAssets,
          routeAliases,
        }
      }),
    )

    const allAssets = uniqueAssets([
      ...orderWorkspace.orders
        .filter(
          (order) =>
            (peerToConversation.get(order.providerGlobalMetaId) ?? order.providerGlobalMetaId) ===
            conversationId,
        )
        .flatMap((order) => order.assets),
      ...deliveryAssetsFromMessages(messages),
      ...deliveryAssetsFromRecords(storedRecords),
    ])
    const firstThread = threads[0]
    const firstMessage = [...messages].reverse().find((row) => row.peerGlobalMetaId.trim())
    const requestedConversation = requestedConversations.get(conversationId)
    const providerGlobalMetaId = conversationId
    const providerChatPubkey =
      nonEmpty(firstThread?.order.providerChatPubkey) ||
      nonEmpty(firstMessage?.peerChatPubkey) ||
      nonEmpty(requestedConversation?.providerChatPubkey)
    const providerName =
      nonEmpty(firstThread?.order.providerName) ||
      nonEmpty(firstMessage?.peerName) ||
      nonEmpty(requestedConversation?.providerName)
    const providerAvatarUrl =
      nonEmpty(firstThread?.order.providerAvatarUrl) ||
      nonEmpty(firstMessage?.peerAvatarUrl) ||
      nonEmpty(requestedConversation?.providerAvatarUrl)
    const latestActivityAt =
      latestActivityForConversation({ messages, orderThreads: threads }) ||
      requestedConversation?.latestActivityAt ||
      0

    conversations.push({
      id: conversationId,
      providerGlobalMetaId,
      providerChatPubkey,
      providerName,
      providerAvatarUrl,
      latestActivityAt,
      lastMessage: messages[messages.length - 1] ?? null,
      messageCount: messages.length,
      activeOrderCount: threads.filter((thread) => isInProgressStatus(thread.status)).length,
      deliveredOrderCount: threads.filter((thread) => isDeliveredStatus(thread.status)).length,
      assetCount: allAssets.length,
      messages,
      assets: allAssets,
      orderThreads: threads,
    })
  }

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.latestActivityAt !== b.latestActivityAt) return b.latestActivityAt - a.latestActivityAt
    return a.id.localeCompare(b.id)
  })

  return {
    walletGlobalMetaId: input.walletGlobalMetaId.trim(),
    conversations: sortedConversations,
    orderWorkspace,
    totalCount: sortedConversations.length,
    activeOrderCount: sortedConversations.reduce((sum, row) => sum + row.activeOrderCount, 0),
    deliveredOrderCount: sortedConversations.reduce(
      (sum, row) => sum + row.deliveredOrderCount,
      0,
    ),
    assetCount: sortedConversations.reduce((sum, row) => sum + row.assetCount, 0),
    latestActivityAt: sortedConversations[0]?.latestActivityAt ?? null,
  }
}

export function selectDeliveryConversation(
  workspace: DeliveryConversationWorkspace,
  conversationId: string | null,
): DeliveryConversation | null {
  const target = normalize(conversationId)
  if (target) {
    const match = workspace.conversations.find(
      (conversation) =>
        conversation.id === target ||
        conversation.providerGlobalMetaId === target ||
        conversation.orderThreads.some((thread) =>
          [thread.order.providerGlobalMetaId, thread.order.sessionKey, thread.order.sessionId].some(
            (value) => normalize(value) === target,
          ),
        ),
    )
    if (match) return match
  }
  return workspace.conversations[0] ?? null
}

export function selectDeliveryTab(
  conversation: DeliveryConversation | null,
  tabId: string | null,
): DeliveryConversationTab {
  const target = normalize(tabId)
  if (conversation && target) {
    const thread = conversation.orderThreads.find((row) =>
      [row.tabId, row.orderCorrelationId, row.orderId, row.order.sessionId, row.order.sessionKey].some(
        (value) => normalize(value) === target,
      ),
    )
    if (thread) {
      return {
        kind: 'order',
        id: thread.tabId,
        orderCorrelationId: thread.orderCorrelationId,
        orderId: thread.orderId,
      }
    }
  }
  return { kind: 'all', id: 'all' }
}

export function selectOrderThread(
  conversation: DeliveryConversation | null,
  tab: DeliveryConversationTab,
): DeliveryOrderThread | null {
  if (!conversation || tab.kind !== 'order') return null
  return (
    conversation.orderThreads.find(
      (thread) =>
        thread.tabId === tab.id ||
        thread.orderCorrelationId === tab.orderCorrelationId ||
        thread.orderId === tab.orderId,
    ) ?? null
  )
}

export function messagesForConversation(
  conversation: DeliveryConversation | null,
  tab: DeliveryConversationTab,
): DeliveryMessage[] {
  if (!conversation) return []
  if (tab.kind === 'all') return conversation.messages
  return selectOrderThread(conversation, tab)?.messages ?? []
}

export function assetsForConversation(
  conversation: DeliveryConversation | null,
  tab: DeliveryConversationTab,
): ParsedDeliveryAsset[] {
  if (!conversation) return []
  if (tab.kind === 'all') return conversation.assets
  return selectOrderThread(conversation, tab)?.assets ?? []
}

function findThreadByRouteValue(
  workspace: DeliveryConversationWorkspace,
  value: string | null | undefined,
): { conversation: DeliveryConversation; thread: DeliveryOrderThread } | null {
  const target = normalize(value)
  if (!target) return null

  for (const conversation of workspace.conversations) {
    for (const thread of conversation.orderThreads) {
      const candidates = routeCandidatesForThread(thread)
      if (candidates.some((candidate) => normalize(candidate) === target)) {
        return { conversation, thread }
      }
    }
  }

  return null
}

function resolveSessionRouteValue(input: {
  workspace: DeliveryConversationWorkspace
  sessionParam: string | null | undefined
  walletGlobalMetaId: string
}): { conversation: DeliveryConversation; thread: DeliveryOrderThread } | null {
  const target = normalize(input.sessionParam)
  if (!target) return null

  const direct = findThreadByRouteValue(input.workspace, target)
  if (direct) return direct

  const parsed = parseSessionKey(target)
  if (!parsed.peerGlobalMetaId) return null
  const sessionId = buildSessionId({
    walletGlobalMetaId: input.walletGlobalMetaId,
    providerGlobalMetaId: parsed.peerGlobalMetaId,
    orderCorrelationId: parsed.orderCorrelationId,
  })
  return findThreadByRouteValue(input.workspace, sessionId)
}

export function resolveDeliveryRouteSelection(input: {
  workspace: DeliveryConversationWorkspace
  conversationParam?: string | null
  orderParam?: string | null
  sessionParam?: string | null
  walletGlobalMetaId: string
}): { conversationId: string | null; tabId: string } {
  const orderMatch = findThreadByRouteValue(input.workspace, input.orderParam)
  if (orderMatch) {
    return {
      conversationId: orderMatch.conversation.id,
      tabId: orderMatch.thread.tabId,
    }
  }

  const sessionMatch = resolveSessionRouteValue({
    workspace: input.workspace,
    sessionParam: input.sessionParam,
    walletGlobalMetaId: input.walletGlobalMetaId,
  })
  if (sessionMatch) {
    return {
      conversationId: sessionMatch.conversation.id,
      tabId: sessionMatch.thread.tabId,
    }
  }

  const conversation = selectDeliveryConversation(
    input.workspace,
    input.conversationParam ?? null,
  )
  return {
    conversationId: conversation?.id ?? null,
    tabId: 'all',
  }
}
