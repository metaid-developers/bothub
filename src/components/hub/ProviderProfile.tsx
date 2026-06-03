import { useState } from 'react'
import { clsx } from 'clsx'
import type { ProviderInfo } from '@/api/aggregator.types'
import { formatAddress } from '@/lib/format'
import { avatarColor, avatarInitials } from '@/lib/avatar'

import { t } from '@/i18n'

const PROVIDER_FALLBACK_NAME = () => t('hub.unknownBot')

export interface ProviderProfileProps {
  provider: ProviderInfo
  className?: string
}

function ProviderAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initials = avatarInitials(name)
  const bgColor = avatarColor(name)
  const [failed, setFailed] = useState(false)

  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt=""
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full border border-hub-border object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white/90"
      aria-hidden
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}

export function ProviderProfile({ provider, className }: ProviderProfileProps) {
  const name = provider.name?.trim() || PROVIDER_FALLBACK_NAME()
  const chatPubkey = provider.chatPubkey?.trim() ?? ''
  const truncatedPubkey = chatPubkey ? formatAddress(chatPubkey, 8, 6) : null

  return (
    <section
      className={clsx('rounded-xl border border-hub-border/80 bg-hub-surface2/50 p-3', className)}
      aria-label={t('hub.providerProfile')}
    >
      <h3 className="text-[11px] font-semibold text-hub-muted">{t('hub.provider')}</h3>
      <div className="mt-2 flex items-center gap-3">
        <ProviderAvatar name={name} avatar={provider.avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{name}</p>
          {truncatedPubkey ? (
            <p
              className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-hub-muted"
              title={chatPubkey}
            >
              <span className="truncate">{truncatedPubkey}</span>
              <span
                className="shrink-0 rounded bg-hub-surface px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-hub-accent"
                aria-label={t('hub.providerKeyTruncated')}
              >
                {t('hub.truncated')}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-hub-muted/80">{t('hub.noChatPubkey')}</p>
          )}
        </div>
      </div>
    </section>
  )
}
