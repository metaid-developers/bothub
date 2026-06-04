import { normalizeAvatarUrl, type UserProfile } from '@/api/userProfile'
import type { PrivateChatUserInfo } from '@/ws/privateChat'

export interface PeerProfile {
  globalMetaId?: string
  chatPubkey?: string
  name?: string
  avatarUrl?: string
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function mergePeerProfiles(
  ...profiles: Array<PeerProfile | undefined>
): PeerProfile {
  const merged: PeerProfile = {}
  for (const profile of profiles) {
    if (!profile) continue
    merged.globalMetaId ||= cleanString(profile.globalMetaId)
    merged.chatPubkey ||= cleanString(profile.chatPubkey)
    merged.name ||= cleanString(profile.name)
    merged.avatarUrl ||= cleanString(profile.avatarUrl)
  }
  return merged
}

export function peerProfileNeedsHydration(profile: PeerProfile | undefined): boolean {
  const cleaned = mergePeerProfiles(profile)
  return !cleaned.chatPubkey || !cleaned.name || !cleaned.avatarUrl
}

export function peerProfileFromPrivateChatUserInfo(
  info: PrivateChatUserInfo | undefined,
): PeerProfile {
  if (!info) return {}

  const profile: PeerProfile = {}
  const globalMetaId =
    cleanString(info.globalMetaId) ??
    cleanString(info.globalmetaid)
  const chatPubkey =
    cleanString(info.chatPublicKey) ??
    cleanString(info.chatPubkey) ??
    cleanString(info.chatpubkey)
  const name = cleanString(info.name)
  const avatarUrl = normalizeAvatarUrl(
    cleanString(info.avatarUrl) ??
      cleanString(info.avatarImage) ??
      cleanString(info.avatar),
    cleanString(info.avatarId) ?? cleanString(info.avatarPinId),
  )

  if (globalMetaId) profile.globalMetaId = globalMetaId
  if (chatPubkey) profile.chatPubkey = chatPubkey
  if (name) profile.name = name
  if (avatarUrl) profile.avatarUrl = avatarUrl
  return profile
}

export function peerProfileFromUserProfile(profile: UserProfile): PeerProfile {
  const peerProfile: PeerProfile = {}
  const globalMetaId = cleanString(profile.globalMetaId)
  const chatPubkey = cleanString(profile.chatPubkey)
  const name = cleanString(profile.name)
  const avatarUrl = normalizeAvatarUrl(
    cleanString(profile.avatarUrl) ??
      cleanString(profile.avatarImage) ??
      cleanString(profile.avatar),
    cleanString(profile.avatarId) ?? cleanString(profile.avatarPinId),
  )

  if (globalMetaId) peerProfile.globalMetaId = globalMetaId
  if (chatPubkey) peerProfile.chatPubkey = chatPubkey
  if (name) peerProfile.name = name
  if (avatarUrl) peerProfile.avatarUrl = avatarUrl
  return peerProfile
}
