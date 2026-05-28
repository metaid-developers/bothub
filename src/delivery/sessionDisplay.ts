import { extractMetafileAssets, type ParsedDeliveryAsset } from '@/delivery/assetParser'
import type { DeliveryMessage, DeliverySession } from '@/delivery/messageStore'
import { getMessageVariant } from '@/delivery/messageDisplay'
import { parseDeliveryProtocol } from '@/delivery/protocol'
import {
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'

export type DeliverySessionStatus =
  | 'pending'
  | 'active'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'failed'

export interface EnrichedDeliverySession extends DeliverySession {
  status: DeliverySessionStatus
  assetCount: number
}

function uniqueAssets(assets: ParsedDeliveryAsset[]): ParsedDeliveryAsset[] {
  const seen = new Set<string>()
  return assets.filter((asset) => {
    if (seen.has(asset.uri)) return false
    seen.add(asset.uri)
    return true
  })
}

export function deliveryAssetsFromMessage(message: DeliveryMessage): ParsedDeliveryAsset[] {
  const protocol = parseDeliveryProtocol(message.content)
  if (protocol.kind !== 'delivery') return []
  return uniqueAssets(extractMetafileAssets(protocol.rawText))
}

export function deliveryAssetsFromMessages(messages: DeliveryMessage[]): ParsedDeliveryAsset[] {
  return uniqueAssets(messages.flatMap((message) => deliveryAssetsFromMessage(message)))
}

function statusTextIndicatesFailure(text: string): boolean {
  const normalized = text.toLowerCase()
  if (!normalized.trim() || normalized.includes('no error')) return false
  return (
    /\b(failed|failure|unable|cannot|can't|could not)\b/.test(normalized) ||
    /\berror\s*[:-]/.test(normalized)
  )
}

export function deriveSessionStatus(
  messages: DeliveryMessage[],
  selfGlobalMetaId: string,
): DeliverySessionStatus {
  let status: DeliverySessionStatus = 'pending'
  let hasOutgoingOrder = false
  const self = selfGlobalMetaId.trim()

  for (const message of messages) {
    const variant = getMessageVariant(message)
    const protocol = parseDeliveryProtocol(message.content)
    const isSelf = message.fromGlobalMetaId.trim() === self

    if (message.decryptError) {
      status = 'failed'
      continue
    }
    if (variant === 'order' && isSelf) {
      hasOutgoingOrder = true
      continue
    }
    if (variant === 'completion' || variant === 'rating_reserved') {
      status = 'completed'
      continue
    }
    if (variant === 'delivery') {
      status = 'delivered'
      continue
    }
    if (variant === 'status') {
      if (statusTextIndicatesFailure(protocol.displayText)) {
        status = 'failed'
        continue
      }
      status =
        protocol.displayText.toLowerCase().includes('upload') ||
        protocol.displayText.toLowerCase().includes('deliver') ||
        protocol.displayText.toLowerCase().includes('generating delivery')
          ? 'delivering'
          : 'active'
      continue
    }
    if (variant === 'text' && hasOutgoingOrder && !isSelf && status === 'pending') {
      status = 'active'
    }
  }

  return status
}

export function enrichDeliverySessions(
  sessions: DeliverySession[],
  byPeer: Record<string, DeliveryMessage[]>,
  selfGlobalMetaId: string,
): EnrichedDeliverySession[] {
  return sessions.map((session) => {
    const sessionMessages = resolveMessagesForSession(
      byPeer,
      session.sessionKey,
      selfGlobalMetaId,
    )
    return {
      ...session,
      status: deriveSessionStatus(sessionMessages, selfGlobalMetaId),
      assetCount: deliveryAssetsFromMessages(sessionMessages).length,
    }
  })
}
