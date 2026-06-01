import type { DeliveryMessage, DeliverySession } from '@/delivery/messageStore'
import type { UserProfile } from '@/api/userProfile'
import {
  findCorrelationInText,
  getOrderCorrelationId,
  parseOrderMessage,
} from '@/delivery/orderParser'
import { parseDeliveryProtocol } from '@/delivery/protocol'

export function buildSessionKey(
  peerGlobalMetaId: string,
  orderCorrelationId?: string | null,
): string {
  const peer = peerGlobalMetaId.trim()
  const correlation = orderCorrelationId?.trim()
  if (!peer) return ''
  if (!correlation) return peer
  return `${peer}:${correlation}`
}

export function parseSessionKey(sessionKey: string): {
  peerGlobalMetaId: string
  orderCorrelationId: string | null
} {
  const trimmed = sessionKey.trim()
  const colon = trimmed.indexOf(':')
  if (colon < 0) {
    return { peerGlobalMetaId: trimmed, orderCorrelationId: null }
  }
  return {
    peerGlobalMetaId: trimmed.slice(0, colon),
    orderCorrelationId: trimmed.slice(colon + 1) || null,
  }
}

function sameTimestampRank(message: DeliveryMessage, selfGlobalMetaId: string): number {
  const self = selfGlobalMetaId.trim()
  const isSelf = Boolean(self) && message.fromGlobalMetaId.trim() === self
  if (isSelf && parseOrderMessage(message.content)) return 0
  if (isSelf && message.orderCorrelationId?.trim()) return 1
  if (protocolKindForMessage(message) !== 'plain') return 2
  return 3
}

function protocolKindForMessage(message: DeliveryMessage): string {
  const protocolTag = message.protocolTag?.trim()
  if (protocolTag) return protocolTag
  return parseDeliveryProtocol(message.content).kind
}

function sortMessagesAsc(
  messages: DeliveryMessage[],
  selfGlobalMetaId = '',
): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    const aRank = sameTimestampRank(a, selfGlobalMetaId)
    const bRank = sameTimestampRank(b, selfGlobalMetaId)
    if (aRank !== bRank) return aRank - bRank
    return a.id.localeCompare(b.id)
  })
}

function sessionLabelFromOrder(
  order: NonNullable<ReturnType<typeof parseOrderMessage>>,
): string {
  return order.serviceName || order.skillName || order.displaySummary
}

function isMessageForSelf(message: DeliveryMessage, selfGlobalMetaId: string): boolean {
  const self = selfGlobalMetaId.trim()
  if (!self) return false
  return (
    message.fromGlobalMetaId.trim() === self ||
    message.toGlobalMetaId.trim() === self
  )
}

function providerChatPubkeyForSession(
  messages: DeliveryMessage[],
  selfGlobalMetaId: string,
): string | undefined {
  const self = selfGlobalMetaId.trim()
  const fromOutgoingOrder = messages.find(
    (message) =>
      message.fromGlobalMetaId.trim() === self && message.peerChatPubkey?.trim(),
  )
  if (fromOutgoingOrder?.peerChatPubkey?.trim()) {
    return fromOutgoingOrder.peerChatPubkey.trim()
  }

  return [...messages]
    .reverse()
    .find((message) => message.peerChatPubkey?.trim())
    ?.peerChatPubkey?.trim()
}

function peerNameForSession(messages: DeliveryMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.peerName?.trim())
    ?.peerName?.trim()
}

function peerAvatarUrlForSession(messages: DeliveryMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.peerAvatarUrl?.trim())
    ?.peerAvatarUrl?.trim()
}

export function resolveProviderChatPubkey(input: {
  session: (Pick<DeliverySession, 'peerGlobalMetaId' | 'providerChatPubkey'> & {
    orderCorrelationId?: string | null
  }) | null
  orders?: Array<{
    providerGlobalMetaId: string
    providerChatPubkey?: string
    orderCorrelationId?: string
    paymentTxid?: string
    orderReference?: string
  }>
  messages?: DeliveryMessage[]
  providerProfile?: Pick<UserProfile, 'chatPubkey'> | null
}): string {
  const sessionKey = input.session?.providerChatPubkey?.trim()
  if (sessionKey) return sessionKey

  const peer = input.session?.peerGlobalMetaId.trim() ?? ''
  const correlation = input.session?.orderCorrelationId?.trim() ?? ''
  const peerOrders = input.orders?.filter(
    (order) => order.providerGlobalMetaId.trim() === peer && order.providerChatPubkey?.trim(),
  ) ?? []
  const orderKey = (
    peerOrders.find((order) => {
      if (!correlation) return true
      return [order.orderCorrelationId, order.paymentTxid, order.orderReference].some(
        (value) => value?.trim() === correlation,
      )
    }) ?? peerOrders[0]
  )?.providerChatPubkey?.trim()
  if (orderKey) return orderKey

  const newestMessageKey = [...(input.messages ?? [])]
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp
      return b.id.localeCompare(a.id)
    })
    .find((message) => message.peerChatPubkey?.trim())
    ?.peerChatPubkey?.trim()
  if (newestMessageKey) return newestMessageKey

  return input.providerProfile?.chatPubkey?.trim() ?? ''
}

export function groupPeerMessagesBySession(
  messages: DeliveryMessage[],
  selfGlobalMetaId: string,
): Map<string, DeliveryMessage[]> {
  const sorted = sortMessagesAsc(
    messages.filter((message) => isMessageForSelf(message, selfGlobalMetaId)),
    selfGlobalMetaId,
  )
  const buckets = new Map<string, DeliveryMessage[]>()
  const knownCorrelations = new Set<string>()
  const self = selfGlobalMetaId.trim()
  let lastCorrelatedSessionKey: string | null = null

  const peerDefaultKey = (peer: string) => buildSessionKey(peer, null)
  const rememberCorrelatedKey = (key: string): string => {
    lastCorrelatedSessionKey = key
    return key
  }

  const assignSessionKey = (message: DeliveryMessage): string => {
    const peer = message.peerGlobalMetaId.trim()
    const parsed = parseOrderMessage(message.content)
    const protocol = parseDeliveryProtocol(message.content)
    const protocolKind = protocolKindForMessage(message)
    const protocolCorrelation = protocol.orderCorrelationId.trim()
    const isSelf = message.fromGlobalMetaId.trim() === self
    const correlation = parsed ? getOrderCorrelationId(parsed) : protocolCorrelation
    const storedCorrelation = message.orderCorrelationId?.trim() ?? ''

    if (parsed && isSelf && correlation) {
      knownCorrelations.add(correlation)
      return rememberCorrelatedKey(buildSessionKey(peer, correlation))
    }

    if (storedCorrelation) {
      knownCorrelations.add(storedCorrelation)
      return rememberCorrelatedKey(buildSessionKey(peer, storedCorrelation))
    }

    if (protocolCorrelation) {
      knownCorrelations.add(protocolCorrelation)
      return rememberCorrelatedKey(buildSessionKey(peer, protocolCorrelation))
    }

    if (correlation && knownCorrelations.has(correlation)) {
      return rememberCorrelatedKey(buildSessionKey(peer, correlation))
    }

    const textMatch = findCorrelationInText(message.content, knownCorrelations)
    if (textMatch) {
      return rememberCorrelatedKey(buildSessionKey(peer, textMatch))
    }

    if (!isSelf && protocolKind !== 'plain' && lastCorrelatedSessionKey) {
      return lastCorrelatedSessionKey
    }

    return peerDefaultKey(peer)
  }

  for (const message of sorted) {
    const key = assignSessionKey(message)
    const existing = buckets.get(key) ?? []
    buckets.set(key, [...existing, message])
  }

  return buckets
}

export function messagesForSession(
  byPeer: Record<string, DeliveryMessage[]>,
  sessionKey: string,
  selfGlobalMetaId: string,
): DeliveryMessage[] {
  const { peerGlobalMetaId } = parseSessionKey(sessionKey)
  const peerMessages = byPeer[peerGlobalMetaId.trim()] ?? []
  const grouped = groupPeerMessagesBySession(peerMessages, selfGlobalMetaId)
  return grouped.get(sessionKey.trim()) ?? []
}

export function buildGroupedSessionList(
  byPeer: Record<string, DeliveryMessage[]>,
  selfGlobalMetaId: string,
): DeliverySession[] {
  const sessions: DeliverySession[] = []

  for (const [peerGlobalMetaId, messages] of Object.entries(byPeer)) {
    const grouped = groupPeerMessagesBySession(messages, selfGlobalMetaId)
    for (const [sessionKey, bucket] of grouped) {
      const sorted = sortMessagesAsc(bucket, selfGlobalMetaId)
      const lastMessage = sorted[sorted.length - 1]
      if (!lastMessage) continue

      const { orderCorrelationId } = parseSessionKey(sessionKey)
      let serviceLabel: string | null = null
      if (orderCorrelationId) {
        for (const row of sorted) {
          const order = parseOrderMessage(row.content)
          if (order) {
            serviceLabel = sessionLabelFromOrder(order)
            break
          }
        }
      }

      sessions.push({
        sessionKey,
        peerGlobalMetaId: peerGlobalMetaId.trim(),
        providerChatPubkey: providerChatPubkeyForSession(sorted, selfGlobalMetaId),
        peerName: peerNameForSession(sorted),
        peerAvatarUrl: peerAvatarUrlForSession(sorted),
        orderCorrelationId,
        serviceLabel,
        lastMessage,
        messageCount: sorted.length,
      })
    }
  }

  return sessions.sort(
    (a, b) =>
      b.lastMessage.timestamp - a.lastMessage.timestamp ||
      b.lastMessage.id.localeCompare(a.lastMessage.id),
  )
}

/** @deprecated Use buildGroupedSessionList with selfGlobalMetaId for order-aware grouping. */
export function buildSessionList(
  byPeer: Record<string, DeliveryMessage[]>,
): DeliverySession[] {
  const sessions: DeliverySession[] = []
  for (const [peerGlobalMetaId, messages] of Object.entries(byPeer)) {
    const sorted = sortMessagesAsc(messages)
    const lastMessage = sorted[sorted.length - 1]
    if (!lastMessage) continue
    sessions.push({
      sessionKey: peerGlobalMetaId,
      peerGlobalMetaId,
      providerChatPubkey: providerChatPubkeyForSession(sorted, ''),
      peerName: peerNameForSession(sorted),
      peerAvatarUrl: peerAvatarUrlForSession(sorted),
      orderCorrelationId: null,
      serviceLabel: null,
      lastMessage,
      messageCount: sorted.length,
    })
  }
  return sessions.sort(
    (a, b) =>
      b.lastMessage.timestamp - a.lastMessage.timestamp ||
      b.lastMessage.id.localeCompare(a.lastMessage.id),
  )
}
