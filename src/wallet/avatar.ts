import { normalizeAvatarUrl } from '@/api/userProfile'
import type { WalletIdentity } from '@/wallet/types'

type WalletAvatarIdentity = Pick<
  WalletIdentity,
  'avatar' | 'avatarImage' | 'avatarUrl' | 'avatarId' | 'avatarPinId'
>

export function resolveWalletAvatarUrl(
  identity: WalletAvatarIdentity | null | undefined,
): string | undefined {
  if (!identity) return undefined

  const avatarId = identity.avatarId ?? identity.avatarPinId
  return (
    normalizeAvatarUrl(identity.avatarUrl, avatarId) ??
    normalizeAvatarUrl(identity.avatarImage, avatarId) ??
    normalizeAvatarUrl(identity.avatar, avatarId)
  )
}
