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

const ACCELERATE_PREFIX =
  'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/'
const FALLBACK_PREFIX =
  'https://file.metaid.io/metafile-indexer/api/v1/files/content/'

function fallbackUrl(url: string): string | null {
  if (url.startsWith(ACCELERATE_PREFIX)) {
    return FALLBACK_PREFIX + url.slice(ACCELERATE_PREFIX.length)
  }
  return null
}

export function PeerAvatar({
  name,
  avatarUrl,
  globalMetaId,
  size = 'sm',
}: PeerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const label = `${peerDisplayName({ name, globalMetaId })} 头像`
  const initial = peerDisplayName({ name, globalMetaId }).charAt(0).toUpperCase() || '?'
  const imageUrl = avatarUrl?.trim()
  const backupUrl = imageUrl && imageFailed ? fallbackUrl(imageUrl) : null

  if (imageUrl && !fallbackFailed) {
    const src = backupUrl ?? imageUrl
    return (
      <img
        src={src}
        alt={label}
        onError={() => {
          if (backupUrl && !fallbackFailed) {
            setFallbackFailed(true)
          } else {
            setImageFailed(true)
            setFallbackFailed(true)
          }
        }}
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
