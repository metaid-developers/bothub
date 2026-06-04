import { getNormalizedMetaSocketBaseUrl } from '@/api/config'

const MAN_METAID_CONTENT_BASE = 'https://man.metaid.io/content'

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
  bio?: unknown
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
  return `${MAN_METAID_CONTENT_BASE}/${encodeURIComponent(pinId)}`
}

export function normalizeAvatarUrl(
  value: string | undefined,
  avatarIdValue?: string | undefined,
): string | undefined {
  const avatar = value?.trim()
  const avatarId = avatarIdValue?.trim()

  if (!avatar && !avatarId) return undefined
  if (avatar && /^\/(?:files\/)?content\/?$/i.test(avatar)) return undefined

  if (avatar && /^https?:\/\//i.test(avatar)) {
    if (/\/content\/?$/i.test(avatar)) return undefined
    return avatar
  }
  if (avatar?.startsWith('data:')) return avatar

  if (avatar?.toLowerCase().startsWith('metafile://')) {
    const pinId = pinIdFromMetafileAvatar(avatar)
    if (pinId) return avatarThumbnailUrl(pinId)
    return undefined
  }

  const pinIdFromValue = extractAvatarPinId(avatar) ?? extractAvatarPinId(avatarId) ?? avatarId
  if (pinIdFromValue) return avatarThumbnailUrl(pinIdFromValue)

  if (avatar?.startsWith('/')) {
    return `https://man.metaid.io${avatar}`
  }

  const hexOnly = avatar?.match(/^[a-fA-F0-9]{64}$/)
  if (hexOnly?.[0]) {
    return `${MAN_METAID_CONTENT_BASE}/${hexOnly[0]}`
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

  const bio = record['bio'] ?? record['Bio']

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
    bio,
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

/** meta-socket uses code 0 for success; legacy manapi used code 1. Accept both. */
function unwrapLegacyInfoEnvelope(raw: unknown): unknown {
  const envelope = asRecord(raw)
  if (!envelope || !('code' in envelope)) return raw
  const code = envelope.code
  if (code !== 0 && code !== 1) {
    const message = typeof envelope.message === 'string' ? envelope.message : 'user profile request failed'
    throw new UserProfileApiError(message)
  }
  return envelope.data
}

function resolveFallbackAddress(
  profile: UserProfile,
  fallbackAddress?: string | undefined,
): string {
  return profile.address?.trim() || fallbackAddress?.trim() || ''
}

function avatarNeedsAddressFallback(
  profile: UserProfile,
  fallbackAddress?: string | undefined,
): boolean {
  if (!resolveFallbackAddress(profile, fallbackAddress)) return false
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

export async function fetchUserProfileByGlobalMetaId(
  globalMetaId: string,
  fallbackAddress?: string,
): Promise<UserProfile> {
  const trimmed = globalMetaId.trim()
  if (!trimmed) return {}

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const response = await fetch(`${baseUrl}/api/info/globalmetaid/${encodeURIComponent(trimmed)}`)
  const payload: unknown = await response.json()
  const profile = normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
  if (!avatarNeedsAddressFallback(profile, fallbackAddress)) return profile

  const addressProfile = await fetchUserProfileByAddress(
    resolveFallbackAddress(profile, fallbackAddress),
  )
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
