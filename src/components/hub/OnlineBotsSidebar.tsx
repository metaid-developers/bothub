import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { EmptyState } from '@/components/common/EmptyState'
import { t } from '@/i18n'
import { avatarColor, avatarInitials, getInitialsAvatar } from '@/lib/avatar'

export interface OnlineBotGroup {
  providerGlobalMetaId: string
  providerName: string
  providerAvatar: string | null
  providerLLM: string | null
}

function compactGlobalMetaId(globalMetaId: string): string {
  if (globalMetaId.length <= 12) return globalMetaId
  return `${globalMetaId.slice(0, 8)}...${globalMetaId.slice(-4)}`
}

function groupProviders(services: SkillServiceListItem[]): OnlineBotGroup[] {
  const map = new Map<string, OnlineBotGroup>()
  for (const item of services) {
    const id = item.providerGlobalMetaId
    const existing = map.get(id)
    if (existing) {
      if (!existing.providerName && item.providerName) {
        existing.providerName = item.providerName
      }
      if (!existing.providerAvatar && item.providerAvatar) {
        existing.providerAvatar = item.providerAvatar
      }
      if (!existing.providerLLM && item.providerLLM) {
        existing.providerLLM = item.providerLLM
      }
      continue
    }
    map.set(id, {
      providerGlobalMetaId: id,
      providerName: item.providerName?.trim() || t('hub.unknownBot'),
      providerAvatar: item.providerAvatar,
      providerLLM: item.providerLLM,
    })
  }
  return Array.from(map.values()).sort((a, b) =>
    a.providerName.localeCompare(b.providerName),
  )
}

function BotAvatar({ name, avatar, gmid }: { name: string; avatar: string | null; gmid: string }) {
  const initials = avatarInitials(name)
  const bgColor = avatarColor(name)
  const [failed, setFailed] = useState(false)

  const fallbackSrc = getInitialsAvatar(name, gmid)

  if (avatar && !failed) {
    return (
      <span className="relative inline-flex shrink-0">
        <img
          src={avatar}
          alt=""
          onError={() => setFailed(true)}
          className="h-9 w-9 rounded-full border border-hub-border object-cover"
        />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-hub-surface bg-hub-online"
          aria-hidden
        />
      </span>
    )
  }
  if (failed && avatar) {
    return (
      <span className="relative inline-flex shrink-0">
        <img
          src={fallbackSrc}
          alt=""
          className="h-9 w-9 rounded-full border border-hub-border object-cover"
        />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-hub-surface bg-hub-online"
          aria-hidden
        />
      </span>
    )
  }
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white/90"
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </span>
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-hub-surface bg-hub-online"
        aria-hidden
      />
    </span>
  )
}

export interface OnlineBotsSidebarProps {
  services: SkillServiceListItem[]
  className?: string
  id?: string
}

export function OnlineBotsSidebar({ services, className, id }: OnlineBotsSidebarProps) {
  const navigate = useNavigate()
  const bots = useMemo(() => groupProviders(services), [services])

  return (
    <aside
      id={id}
      className={clsx('flex w-full shrink-0 flex-col', className)}
      aria-label={t('hub.onlineBots')}
    >
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-hub-muted">
        {t('hub.onlineBots')}
        {bots.length > 0 ? ` (${bots.length})` : ''}
      </h2>
      <ul className="mt-4 flex list-none flex-col gap-1 p-0">
        {bots.length === 0 ? (
          <li>
            <EmptyState
              title={t('hub.onlineBots')}
              description={t('hub.onlineBotsEmpty')}
              className="px-3 py-6"
            />
          </li>
        ) : (
          bots.map((bot) => (
            <li key={bot.providerGlobalMetaId}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-hub-surface2/60">
                <BotAvatar
                  name={bot.providerName}
                  avatar={bot.providerAvatar}
                  gmid={bot.providerGlobalMetaId}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {bot.providerName}
                  </p>
                  <p className="truncate font-mono text-[11px] text-hub-muted">
                    {compactGlobalMetaId(bot.providerGlobalMetaId)}
                  </p>
                  <p className="truncate text-[11px] text-hub-muted/80">
                    {bot.providerLLM || '—'}
                  </p>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
      {bots.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/bot')}
          className="mt-3 w-full rounded-xl border border-hub-border bg-hub-surface2 py-2 text-xs font-medium text-hub-muted transition hover:border-hub-border/80 hover:bg-hub-surface2/80 hover:text-white"
        >
          {t('hub.showMoreBots')}
        </button>
      )}
    </aside>
  )
}
