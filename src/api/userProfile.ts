import { getNormalizedMetaSocketBaseUrl } from '@/api/config'

export interface UserProfile {
  metaid?: string
  globalMetaId?: string
  address?: string
  name?: string
  avatar?: string
  avatarImage?: string
  avatarUrl?: string
  avatarId?: string
  avatarPinId?: string
  chatPubkey?: string
}

class UserProfileApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserProfileApiError'
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function extractAvatarPinId(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  const match = raw.match(/([a-fA-F0-9]{64}i\d+)/)
  if (match?.[1]) return match[1]
  return undefined
}

function pinIdFromMetafileAvatar(avatar: string): string | undefined {
  const pathPart = avatar.slice('metafile://'.length).split(/[?#]/)[0]?.trim() ?? ''
  const lastDotIndex = pathPart.lastIndexOf('.')
  const candidate =
    lastDotIndex > 0 && lastDotIndex < pathPart.length - 1
      ? pathPart.slice(0, lastDotIndex)
      : pathPart
  return extractAvatarPinId(candidate) ?? (candidate.trim() || undefined)
}

function avatarThumbnailUrl(pinId: string): string {
  return `${getNormalizedMetaSocketBaseUrl()}/api/v1/users/avatar/accelerate/${encodeURIComponent(pinId)}?process=thumbnail`
}

function isMetaSocketRelativeAvatarPath(avatar: string): boolean {
  return /^\/(?:api\/v1\/|users\/avatar\/accelerate\/|metafile-indexer\/|files\/content\/)/i.test(
    avatar,
  )
}

export function normalizeAvatarUrl(
  value: string | undefined,
  avatarIdValue?: string | undefined,
): string | undefined {
  const avatar = value?.trim()
  const avatarId = avatarIdValue?.trim()
  const pinId =
    (avatar?.toLowerCase().startsWith('metafile://')
      ? pinIdFromMetafileAvatar(avatar)
      : extractAvatarPinId(avatar)) ??
    extractAvatarPinId(avatarId) ??
    avatarId

  if (pinId) return avatarThumbnailUrl(pinId)
  if (!avatar || /^\/(?:files\/)?content\/?$/i.test(avatar)) return undefined
  if (/^https?:\/\//i.test(avatar)) {
    if (/\/content\/?$/i.test(avatar)) return undefined
    return avatar
  }
  if (avatar.startsWith('/content/')) {
    return `${getNormalizedMetaSocketBaseUrl()}${avatar}`
  }
  if (isMetaSocketRelativeAvatarPath(avatar)) {
    return `${getNormalizedMetaSocketBaseUrl()}${avatar}`
  }
  return avatar
}

function normalizeUserProfile(raw: unknown): UserProfile {
  const record = asRecord(raw)
  if (!record) return {}

  const avatar = readString(record, ['avatar'])
  const avatarImage = readString(record, ['avatarImage', 'avatarImg'])
  const avatarId = readString(record, ['avatarId'])
  const avatarPinId = readString(record, ['avatarPinId'])
  const avatarUrl = normalizeAvatarUrl(
    readString(record, ['avatarUrl', 'avatarURL']) ?? avatarImage ?? avatar,
    avatarId ?? avatarPinId,
  )

  return {
    metaid: readString(record, ['metaid', 'metaId']),
    globalMetaId: readString(record, ['globalMetaId', 'globalmetaid']),
    address: readString(record, ['address']),
    name: readString(record, ['name', 'nameId']),
    avatar,
    avatarImage,
    avatarUrl,
    avatarId,
    avatarPinId,
    chatPubkey: readString(record, [
      'chatpubkey',
      'chatPubkey',
      'chatPublicKey',
      'chat_pubkey',
      'chat_public_key',
      'pubkey',
    ]),
  }
}

function unwrapLegacyInfoEnvelope(raw: unknown): unknown {
  const envelope = asRecord(raw)
  if (!envelope || !('code' in envelope)) return raw
  if (envelope.code !== 1) {
    const message = typeof envelope.message === 'string' ? envelope.message : 'user profile request failed'
    throw new UserProfileApiError(message)
  }
  return envelope.data
}

function avatarNeedsAddressFallback(profile: UserProfile): boolean {
  if (!profile.address?.trim()) return false
  const avatarUrl = profile.avatarUrl?.trim().toLowerCase()
  if (!avatarUrl) return true
  if (/\/content\/?$/.test(avatarUrl)) return true
  if (avatarUrl.includes('/users/avatar/accelerate/')) return true
  if (avatarUrl.includes('file.metaid.io/metafile-indexer/content/')) return true
  if (avatarUrl.includes('file.metaid.io/metafile-indexer/api/v1/files/content/')) return true
  return false
}

async function fetchUserProfileByAddress(address: string): Promise<UserProfile> {
  const trimmed = address.trim()
  if (!trimmed) return {}

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const response = await fetch(`${baseUrl}/api/info/address/${encodeURIComponent(trimmed)}`)
  if (!response.ok) return {}
  try {
    const payload: unknown = await response.json()
    return normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
  } catch {
    return {}
  }
}

export async function fetchUserProfileByGlobalMetaId(globalMetaId: string): Promise<UserProfile> {
  const trimmed = globalMetaId.trim()
  if (!trimmed) return {}

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const response = await fetch(`${baseUrl}/api/info/globalmetaid/${encodeURIComponent(trimmed)}`)
  const payload: unknown = await response.json()
  const profile = normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
  if (!avatarNeedsAddressFallback(profile)) return profile

  const addressProfile = await fetchUserProfileByAddress(profile.address ?? '')
  return {
    ...profile,
    metaid: addressProfile.metaid ?? profile.metaid,
    globalMetaId: addressProfile.globalMetaId ?? profile.globalMetaId,
    address: addressProfile.address ?? profile.address,
    name: addressProfile.name ?? profile.name,
    avatar: addressProfile.avatar ?? profile.avatar,
    avatarImage: addressProfile.avatarImage ?? profile.avatarImage,
    avatarUrl: addressProfile.avatarUrl ?? profile.avatarUrl,
    avatarId: addressProfile.avatarId ?? profile.avatarId,
    avatarPinId: addressProfile.avatarPinId ?? profile.avatarPinId,
    chatPubkey: addressProfile.chatPubkey ?? profile.chatPubkey,
  }
}
