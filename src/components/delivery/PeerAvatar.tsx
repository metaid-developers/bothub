import { useState } from 'react'
import { clsx } from 'clsx'
import { peerDisplayName } from '@/components/delivery/peerDisplay'

export interface PeerAvatarProps {
  name?: string | null
  avatarUrl?: string | null
  globalMetaId: string
  size?: 'sm' | 'md'
}

const sizeClass = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
}

export function PeerAvatar({
  name,
  avatarUrl,
  globalMetaId,
  size = 'sm',
}: PeerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const label = `${peerDisplayName({ name, globalMetaId })} 头像`
  const initial = peerDisplayName({ name, globalMetaId }).charAt(0).toUpperCase() || '?'
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
        'flex shrink-0 items-center justify-center rounded-full border border-hub-border bg-hub-surface2 font-semibold text-hub-muted',
        sizeClass[size],
      )}
    >
      {initial}
    </div>
  )
}
