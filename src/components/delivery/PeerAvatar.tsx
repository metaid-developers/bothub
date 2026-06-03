import { useState } from 'react'
import { clsx } from 'clsx'
import { peerDisplayName } from '@/components/delivery/peerDisplay'
import { t } from '@/i18n'
import { avatarColor, avatarInitials } from '@/lib/avatar'

export interface PeerAvatarProps {
  name?: string | null
  avatarUrl?: string | null
  globalMetaId: string
  size?: 'sm' | 'md'
}

const sizeClass = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[13px]',
}

export function PeerAvatar({ name, avatarUrl, globalMetaId, size = 'sm' }: PeerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const displayName = peerDisplayName({ name, globalMetaId })
  const label = t('common.avatarLabel', { name: displayName })
  const initials = avatarInitials(displayName)
  const bgColor = avatarColor(displayName)
  const imageUrl = avatarUrl?.trim()

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={label}
        onError={() => setImageFailed(true)}
        className={clsx(
          'shrink-0 rounded-full border border-hub-border object-cover',
          sizeClass[size],
        )}
      />
    )
  }

  return (
    <div
      aria-label={label}
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white/90',
        sizeClass[size],
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}
