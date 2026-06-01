import { extractMetafileAssets, type ParsedDeliveryAsset } from '@/delivery/assetParser'
import type { DeliveryAssetRecord } from '@/delivery/domain'
import type { DeliveryMessage, DeliverySession } from '@/delivery/messageStore'
import {
  getMessageVariant,
  protocolDisplayTextForMessage,
} from '@/delivery/messageDisplay'
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
  return uniqueAssets(extractMetafileAssets(protocol.rawText))
}

export function deliveryAssetsFromMessages(messages: DeliveryMessage[]): ParsedDeliveryAsset[] {
  return uniqueAssets(messages.flatMap((message) => deliveryAssetsFromMessage(message)))
}

export function deliveryAssetsFromRecords(
  records: DeliveryAssetRecord[] = [],
): ParsedDeliveryAsset[] {
  return uniqueAssets(
    records.map((record) => ({
      uri: record.uri,
      pinId: record.pinId,
      extension: record.extension ? `.${record.extension.replace(/^\./, '')}` : null,
      filename: record.filename,
      kind: record.kind,
      mimeType: record.mimeType,
      previewUrl: record.previewUrl || record.downloadUrl,
      downloadUrl: record.downloadUrl,
      fallbackUrl: record.fallbackUrl || record.downloadUrl,
    })),
  )
}

export function deliveryAssetsForSession(
  messages: DeliveryMessage[],
  records: DeliveryAssetRecord[] = [],
): ParsedDeliveryAsset[] {
  return uniqueAssets([
    ...deliveryAssetsFromMessages(messages),
    ...deliveryAssetsFromRecords(records),
  ])
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
    const protocolDisplayText = protocolDisplayTextForMessage(message)
    const isSelf = message.fromGlobalMetaId.trim() === self

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
      if (statusTextIndicatesFailure(protocolDisplayText)) {
        status = 'failed'
        continue
      }
      const normalizedProtocolText = protocolDisplayText.toLowerCase()
      status =
        normalizedProtocolText.includes('upload') ||
        normalizedProtocolText.includes('deliver') ||
        normalizedProtocolText.includes('generating delivery')
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
