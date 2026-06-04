export type BuyerOrderStatus =
  | 'draft'
  | 'sending'
  | 'paying'
  | 'broadcasting'
  | 'waiting'
  | 'pending_provider'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'failed_to_send'
  | 'needs_rating_reserved'
  | 'refund_reserved'

export interface BuyerOrder {
  id: string
  walletGlobalMetaId: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  serviceId: string
  serviceName: string
  skillName: string
  outputType: 'text' | 'image' | 'video' | 'audio' | 'other'
  rawRequest: string
  displaySummary: string
  price: string
  currency: string
  settlementKind: 'native' | 'mrc20'
  paymentChain: 'mvc' | 'btc' | 'doge'
  paymentTxid?: string
  paymentCommitTxid?: string
  orderReference?: string
  orderPinId?: string
  status: BuyerOrderStatus
  createdAt: number
  updatedAt: number
}

export type DeliverySessionStatus =
  | 'pending'
  | 'sending'
  | 'waiting'
  | 'active'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'failed_to_send'

export interface DeliverySessionRecord {
  id: string
  shortSessionId?: string
  walletGlobalMetaId: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  orderCorrelationId?: string
  serviceId?: string
  serviceLabel?: string
  status: DeliverySessionStatus
  lastMessageId?: string
  lastActivityAt: number
  assetCount: number
  unreadCount: number
}

export interface DeliveryMessageRecord {
  id: string
  walletGlobalMetaId: string
  sessionId: string
  peerGlobalMetaId: string
  peerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  direction: 'incoming' | 'outgoing'
  content: string
  rawContent: string
  contentType: string
  encryption: string
  protocolTag?: string
  orderCorrelationId?: string
  pinId?: string
  txId?: string
  chain?: string
  timestamp: number
  decryptStatus: 'plain' | 'decrypted' | 'failed'
  decryptError?: string
}

export interface DeliveryAssetRecord {
  id: string
  walletGlobalMetaId: string
  sessionId: string
  messageId: string
  orderCorrelationId?: string
  uri: string
  pinId: string
  filename: string
  extension?: string
  kind: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
  mimeType?: string
  sizeBytes?: number
  previewUrl?: string
  downloadUrl: string
  fallbackUrl?: string
  createdAt: number
}

export interface DeliverySyncState {
  id: string
  walletGlobalMetaId: string
  peerGlobalMetaId: string
  cursor?: string
  startIndex?: number
  lastTimestamp?: number
  updatedAt: number
}

export function normalizeOrderCorrelationId(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized || 'uncorrelated'
}

export function buildOrderId(
  walletGlobalMetaId: string,
  providerGlobalMetaId: string,
  orderCorrelationId: string | null | undefined,
): string {
  return [
    walletGlobalMetaId.trim(),
    providerGlobalMetaId.trim(),
    normalizeOrderCorrelationId(orderCorrelationId),
  ].join(':')
}

export function buildSessionId({
  walletGlobalMetaId,
  providerGlobalMetaId,
  orderCorrelationId,
}: {
  walletGlobalMetaId: string
  providerGlobalMetaId: string
  orderCorrelationId?: string | null
}): string {
  return buildOrderId(walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId)
}

export function buildAssetId(sessionId: string, uri: string): string {
  return `${sessionId.trim()}:${uri.trim()}`
}
