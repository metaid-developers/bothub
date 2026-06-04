import { getNormalizedMetaSocketBaseUrl } from '@/api/config'

const FILE_INDEXER_INFO_BASE = 'https://file.metaid.io/metafile-indexer/api/v1/info'
const FILE_INDEXER_CONTENT_BASE = 'https://file.metaid.io/metafile-indexer/content'
const FILE_METAID_ORIGIN = 'https://file.metaid.io'
const AVATAR_CONTENT_PATH_PREFIXES = [
  '/content/',
  '/files/content/',
  '/api/v1/files/content/',
  '/api/v1/files/accelerate/content/',
  '/api/v1/users/avatar/content/',
  '/api/v1/users/avatar/accelerate/',
  '/users/avatar/content/',
  '/users/avatar/accelerate/',
  '/metafile-indexer/content/',
  '/metafile-indexer/thumbnail/',
  '/metafile-indexer/api/v1/files/content/',
  '/metafile-indexer/api/v1/files/accelerate/content/',
  '/metafile-indexer/api/v1/users/avatar/content/',
  '/metafile-indexer/api/v1/users/avatar/accelerate/',
]

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

function stripQueryAndFragment(value: string): string {
  return value.split(/[?#]/)[0] ?? value
}

function isLikelyAvatarPinId(value: string): boolean {
  return /^[a-fA-F0-9]{64}(?:i\d+)?$/.test(value) || /^[A-Za-z0-9_:-]{8,256}$/.test(value)
}

function pinIdFromMetafileAvatar(avatar: string): string | undefined {
  const pathPart = avatar.slice('metafile://'.length).split(/[?#]/)[0]?.trim() ?? ''
  const lastDotIndex = pathPart.lastIndexOf('.')
  const candidate =
    lastDotIndex > 0 && lastDotIndex < pathPart.length - 1
      ? pathPart.slice(0, lastDotIndex)
      : pathPart
  const pinId = extractAvatarPinId(candidate) ?? candidate.trim()
  return pinId && isLikelyAvatarPinId(pinId) ? pinId : undefined
}

function pathFromAvatarReference(avatar: string): string {
  if (/^https?:\/\//i.test(avatar)) {
    try {
      return new URL(avatar).pathname
    } catch {
      return ''
    }
  }
  return avatar
}

function pinIdFromContentAvatar(avatar: string): string | undefined {
  const path = pathFromAvatarReference(avatar)
  for (const prefix of AVATAR_CONTENT_PATH_PREFIXES) {
    if (path.toLowerCase().startsWith(prefix.toLowerCase())) {
      const pinId = decodeURIComponent(stripQueryAndFragment(path.slice(prefix.length).trim()))
      return pinId && isLikelyAvatarPinId(pinId) ? pinId : undefined
    }
  }
  return undefined
}

function avatarContentUrl(pinId: string): string {
  return `${FILE_INDEXER_CONTENT_BASE}/${encodeURIComponent(pinId)}`
}

export function normalizeAvatarUrl(
  value: string | undefined,
  avatarIdValue?: string | undefined,
): string | undefined {
  const avatar = value?.trim()
  const avatarId = avatarIdValue?.trim()

  if (!avatar && !avatarId) return undefined
  if (avatar && /^\/(?:files\/)?content\/?$/i.test(avatar)) return undefined
  if (avatar && /^(data:|blob:)/i.test(avatar)) return avatar

  if (avatar?.toLowerCase().startsWith('metafile://')) {
    const pinId = pinIdFromMetafileAvatar(avatar)
    if (pinId) return avatarContentUrl(pinId)
    return undefined
  }

  const pinIdFromValue =
    (avatar ? pinIdFromContentAvatar(avatar) : undefined) ??
    extractAvatarPinId(avatar) ??
    extractAvatarPinId(avatarId) ??
    avatarId
  if (pinIdFromValue) return avatarContentUrl(pinIdFromValue)

  if (avatar && /^https?:\/\//i.test(avatar)) {
    if (/\/content\/?$/i.test(avatar)) return undefined
    return avatar
  }

  if (avatar?.startsWith('/')) {
    return `${FILE_METAID_ORIGIN}${avatar}`
  }

  const hexOnly = avatar?.match(/^[a-fA-F0-9]{64}$/)
  if (hexOnly?.[0]) {
    return avatarContentUrl(hexOnly[0])
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
    const message =
      typeof envelope.message === 'string' ? envelope.message : 'user profile request failed'
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

async function fetchIndexedUserProfileByGlobalMetaId(globalMetaId: string): Promise<UserProfile> {
  const trimmed = globalMetaId.trim()
  if (!trimmed) return {}

  try {
    const response = await fetch(
      `${FILE_INDEXER_INFO_BASE}/globalmetaid/${encodeURIComponent(trimmed)}`,
    )
    if (!response.ok) return {}
    const payload: unknown = await response.json()
    return normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
  } catch {
    return {}
  }
}

function mergeAddressFallbackProfile(
  profile: UserProfile,
  addressProfile: UserProfile,
): UserProfile {
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

function mergeIndexedAvatarProfile(profile: UserProfile, indexedProfile: UserProfile): UserProfile {
  if (!indexedProfile.avatarUrl) {
    return {
      ...profile,
      metaid: profile.metaid ?? indexedProfile.metaid,
      globalMetaId: profile.globalMetaId ?? indexedProfile.globalMetaId,
      address: profile.address ?? indexedProfile.address,
      name: profile.name ?? indexedProfile.name,
      bio: profile.bio ?? indexedProfile.bio,
      chatPubkey: profile.chatPubkey ?? indexedProfile.chatPubkey,
    }
  }

  return {
    ...profile,
    metaid: profile.metaid ?? indexedProfile.metaid,
    globalMetaId: profile.globalMetaId ?? indexedProfile.globalMetaId,
    address: profile.address ?? indexedProfile.address,
    name: profile.name ?? indexedProfile.name,
    avatar: indexedProfile.avatar ?? profile.avatar,
    avatarImage: indexedProfile.avatarImage ?? profile.avatarImage,
    avatarUrl: indexedProfile.avatarUrl,
    avatarId: indexedProfile.avatarId ?? profile.avatarId,
    avatarPinId: indexedProfile.avatarPinId ?? profile.avatarPinId,
    bio: profile.bio ?? indexedProfile.bio,
    chatPubkey: profile.chatPubkey ?? indexedProfile.chatPubkey,
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
  let profile = normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
  if (avatarNeedsAddressFallback(profile, fallbackAddress)) {
    const addressProfile = await fetchUserProfileByAddress(
      resolveFallbackAddress(profile, fallbackAddress),
    )
    profile = mergeAddressFallbackProfile(profile, addressProfile)
  }

  const indexedProfile = await fetchIndexedUserProfileByGlobalMetaId(trimmed)
  return mergeIndexedAvatarProfile(profile, indexedProfile)
}
