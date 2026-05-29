import { getMetafileAccelerateContentBaseUrl, getNormalizedMetaSocketBaseUrl } from '@/api/config'

export interface UserProfile {
  metaid?: string
  globalMetaId?: string
  name?: string
  avatar?: string
  avatarUrl?: string
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

function normalizeMetafileAvatarUrl(avatar: string): string {
  const pathPart = avatar.slice('metafile://'.length).split(/[?#]/)[0]?.trim() ?? ''
  const lastDotIndex = pathPart.lastIndexOf('.')
  const pinId =
    lastDotIndex > 0 && lastDotIndex < pathPart.length - 1
      ? pathPart.slice(0, lastDotIndex)
      : pathPart
  return `${getMetafileAccelerateContentBaseUrl()}/${encodeURIComponent(pinId)}`
}

export function normalizeAvatarUrl(value: string | undefined): string | undefined {
  const avatar = value?.trim()
  if (!avatar || avatar === '/content/') return undefined
  if (/^https?:\/\//i.test(avatar)) return avatar
  if (avatar.toLowerCase().startsWith('metafile://')) return normalizeMetafileAvatarUrl(avatar)
  if (avatar.startsWith('/content/')) {
    return `${getNormalizedMetaSocketBaseUrl()}${avatar}`
  }
  return avatar
}

function normalizeUserProfile(raw: unknown): UserProfile {
  const record = asRecord(raw)
  if (!record) return {}

  const avatar = readString(record, ['avatar'])
  const avatarUrl = normalizeAvatarUrl(readString(record, ['avatarUrl', 'avatarURL']) ?? avatar)

  return {
    metaid: readString(record, ['metaid', 'metaId']),
    globalMetaId: readString(record, ['globalMetaId', 'globalmetaid']),
    name: readString(record, ['name', 'nameId']),
    avatar,
    avatarUrl,
    chatPubkey: readString(record, ['chatpubkey', 'chatPubkey', 'chatPublicKey', 'pubkey']),
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

export async function fetchUserProfileByGlobalMetaId(globalMetaId: string): Promise<UserProfile> {
  const trimmed = globalMetaId.trim()
  if (!trimmed) return {}

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const response = await fetch(`${baseUrl}/api/info/globalmetaid/${encodeURIComponent(trimmed)}`)
  const payload: unknown = await response.json()
  return normalizeUserProfile(unwrapLegacyInfoEnvelope(payload))
}
