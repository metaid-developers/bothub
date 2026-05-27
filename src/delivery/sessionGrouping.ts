import type { DeliveryMessage, DeliverySession } from '@/delivery/messageStore'
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

export function groupPeerMessagesBySession(
  messages: DeliveryMessage[],
  selfGlobalMetaId: string,
): Map<string, DeliveryMessage[]> {
  const sorted = sortMessagesAsc(messages)
  const buckets = new Map<string, DeliveryMessage[]>()
  const knownCorrelations = new Set<string>()
  const self = selfGlobalMetaId.trim()

  const peerDefaultKey = (peer: string) => buildSessionKey(peer, null)

  const assignSessionKey = (message: DeliveryMessage): string => {
    const peer = message.peerGlobalMetaId.trim()
    const parsed = parseOrderMessage(message.content)
    const isSelf = message.fromGlobalMetaId.trim() === self
    const correlation = parsed ? getOrderCorrelationId(parsed) : ''

    if (parsed && isSelf && correlation) {
      knownCorrelations.add(correlation)
      return buildSessionKey(peer, correlation)
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
