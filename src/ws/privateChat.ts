export interface PrivateChatUserInfo {
  globalMetaId?: string
  metaid?: string
  address?: string
  name?: string
  avatar?: string
  chatPublicKey?: string
  chatpubkey?: string
  chatPublicKeyId?: string
  chatpubkeyId?: string
}

export interface PrivateChatItem {
  fromGlobalMetaId: string
  from?: string
  fromUserInfo?: PrivateChatUserInfo
  toGlobalMetaId: string
  to?: string
  toUserInfo?: PrivateChatUserInfo
  txId?: string
  pinId?: string
  globalMetaId?: string
  metaId?: string
  protocol?: string
  content: string
  contentType?: string
  encryption?: string
  chatType?: string
  timestamp: number
  chain?: string
  blockHeight?: number
  index?: number
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function isPrivateChatItem(value: unknown): value is PrivateChatItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  const fromGmid = nonEmptyString(row.fromGlobalMetaId)
  const toGmid = nonEmptyString(row.toGlobalMetaId)
  const content = row.content
  const timestamp = row.timestamp
  return (
    fromGmid != null &&
    toGmid != null &&
    typeof content === 'string' &&
    typeof timestamp === 'number' &&
    Number.isFinite(timestamp)
  )
}

/** Incoming private chat must be addressed to the logged-in user. */
export function isPrivateChatForRecipient(
  item: PrivateChatItem,
  recipientGlobalMetaId: string,
): boolean {
  const mine = recipientGlobalMetaId.trim()
  if (!mine) return false
  return item.toGlobalMetaId.trim() === mine
}

function privateChatSelfIds(
  selfGlobalMetaId: string,
  selfAliases: readonly string[] = [],
): Set<string> {
  return new Set(
    [selfGlobalMetaId, ...selfAliases]
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

export function peerGlobalMetaIdFromPrivateChat(
  item: PrivateChatItem,
  selfGlobalMetaId: string,
  selfAliases: readonly string[] = [],
): string {
  const selfIds = privateChatSelfIds(selfGlobalMetaId, selfAliases)
  if (selfIds.has(item.fromGlobalMetaId.trim())) {
    return item.toGlobalMetaId.trim()
  }
  return item.fromGlobalMetaId.trim()
}

export function peerChatPublicKeyFromPrivateChat(
  item: PrivateChatItem,
  selfGlobalMetaId: string,
  selfAliases: readonly string[] = [],
): string | undefined {
  const selfIds = privateChatSelfIds(selfGlobalMetaId, selfAliases)
  const peerInfo =
    selfIds.has(item.fromGlobalMetaId.trim()) ? item.toUserInfo : item.fromUserInfo
  const key =
    peerInfo?.chatPublicKey?.trim() ||
    peerInfo?.chatpubkey?.trim() ||
    ''
  return key || undefined
}

export function messageIdFromPrivateChat(item: PrivateChatItem): string {
  const pinId = item.pinId?.trim()
  if (pinId) return pinId
  const txId = item.txId?.trim()
  if (txId) {
    const index = item.index ?? 0
    return `${txId}i${index}`
  }
  return `${item.fromGlobalMetaId}:${item.timestamp}:${item.content.slice(0, 32)}`
}
