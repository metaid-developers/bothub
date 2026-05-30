export interface PrivateChatUserInfo {
  globalMetaId?: string
  metaid?: string
  address?: string
  name?: string
  avatar?: string
  chatPublicKey?: string
  chatPubkey?: string
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
  path?: string
  content: string
  contentType?: string
  encrypt?: string
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

function numberFromTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeUserInfo(value: unknown): PrivateChatUserInfo | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const info: PrivateChatUserInfo = {
    globalMetaId: nonEmptyString(row.globalMetaId) ?? undefined,
    metaid: nonEmptyString(row.metaid) ?? undefined,
    address: nonEmptyString(row.address) ?? undefined,
    name: nonEmptyString(row.name) ?? undefined,
    avatar: nonEmptyString(row.avatar) ?? undefined,
    chatPublicKey:
      nonEmptyString(row.chatPublicKey) ??
      nonEmptyString(row.chatpubkey) ??
      nonEmptyString(row.chatPubkey) ??
      undefined,
    chatpubkey:
      nonEmptyString(row.chatpubkey) ??
      nonEmptyString(row.chatPubkey) ??
      nonEmptyString(row.chatPublicKey) ??
      undefined,
    chatPubkey:
      nonEmptyString(row.chatPubkey) ??
      nonEmptyString(row.chatPublicKey) ??
      nonEmptyString(row.chatpubkey) ??
      undefined,
    chatPublicKeyId: nonEmptyString(row.chatPublicKeyId) ?? undefined,
    chatpubkeyId: nonEmptyString(row.chatpubkeyId) ?? undefined,
  }
  return info
}

export function normalizePrivateChatItem(value: unknown): PrivateChatItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const fromGlobalMetaId =
    nonEmptyString(row.fromGlobalMetaId) ??
    nonEmptyString(row.from) ??
    nonEmptyString(row.createGlobalMetaId) ??
    nonEmptyString(row.globalMetaId)
  const toGlobalMetaId =
    nonEmptyString(row.toGlobalMetaId) ??
    nonEmptyString(row.to) ??
    nonEmptyString(row.receiveGlobalMetaId) ??
    nonEmptyString(row.targetGlobalMetaId)
  const content = typeof row.content === 'string' ? row.content : null
  const timestamp = numberFromTimestamp(row.timestamp)
  if (!fromGlobalMetaId || !toGlobalMetaId || content === null || timestamp === null) {
    return null
  }

  const protocol = nonEmptyString(row.protocol) ?? nonEmptyString(row.path) ?? undefined
  const encryption =
    nonEmptyString(row.encryption) ?? nonEmptyString(row.encrypt) ?? undefined

  return {
    fromGlobalMetaId,
    from: nonEmptyString(row.from) ?? undefined,
    fromUserInfo: normalizeUserInfo(row.fromUserInfo),
    toGlobalMetaId,
    to: nonEmptyString(row.to) ?? undefined,
    toUserInfo: normalizeUserInfo(row.toUserInfo),
    txId: nonEmptyString(row.txId) ?? undefined,
    pinId: nonEmptyString(row.pinId) ?? undefined,
    globalMetaId: nonEmptyString(row.globalMetaId) ?? undefined,
    metaId: nonEmptyString(row.metaId) ?? undefined,
    protocol,
    path: nonEmptyString(row.path) ?? undefined,
    content,
    contentType: nonEmptyString(row.contentType) ?? undefined,
    encrypt: nonEmptyString(row.encrypt) ?? undefined,
    encryption,
    chatType: nonEmptyString(row.chatType) ?? undefined,
    timestamp,
    chain: nonEmptyString(row.chain) ?? undefined,
    blockHeight:
      typeof row.blockHeight === 'number' && Number.isFinite(row.blockHeight)
        ? row.blockHeight
        : undefined,
    index:
      typeof row.index === 'number' && Number.isFinite(row.index)
        ? row.index
        : undefined,
  }
}

export function isPrivateChatItem(value: unknown): value is PrivateChatItem {
  return normalizePrivateChatItem(value) !== null
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
    peerInfo?.chatPubkey?.trim() ||
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
