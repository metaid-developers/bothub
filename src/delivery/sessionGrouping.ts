import type { DeliveryMessage, DeliverySession } from '@/delivery/messageStore'
import type { UserProfile } from '@/api/userProfile'
import {
  findCorrelationInText,
  getOrderCorrelationId,
  parseOrderMessage,
} from '@/delivery/orderParser'

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

function sortMessagesAsc(messages: DeliveryMessage[]): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
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
  )
  const buckets = new Map<string, DeliveryMessage[]>()
  const knownCorrelations = new Set<string>()
  const self = selfGlobalMetaId.trim()

  const peerDefaultKey = (peer: string) => buildSessionKey(peer, null)

  const assignSessionKey = (message: DeliveryMessage): string => {
    const peer = message.peerGlobalMetaId.trim()
    const parsed = parseOrderMessage(message.content)
    const isSelf = message.fromGlobalMetaId.trim() === self
    const correlation = parsed ? getOrderCorrelationId(parsed) : ''
    const storedCorrelation = message.orderCorrelationId?.trim() ?? ''

    if (parsed && isSelf && correlation) {
      knownCorrelations.add(correlation)
      return buildSessionKey(peer, correlation)
    }

    if (storedCorrelation) {
      knownCorrelations.add(storedCorrelation)
      return buildSessionKey(peer, storedCorrelation)
    }

    if (correlation && knownCorrelations.has(correlation)) {
      return buildSessionKey(peer, correlation)
    }

    const textMatch = findCorrelationInText(message.content, knownCorrelations)
    if (textMatch) {
      return buildSessionKey(peer, textMatch)
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
      const sorted = sortMessagesAsc(bucket)
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
