import { useMemo } from 'react'
import { clsx } from 'clsx'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { EmptyState } from '@/components/common/EmptyState'
import { t } from '@/i18n'

export interface OnlineBotGroup {
  providerGlobalMetaId: string
  providerName: string
  providerAvatar: string | null
  providerSkill: string | null
  serviceCount: number
}

function groupProviders(services: SkillServiceListItem[]): OnlineBotGroup[] {
  const map = new Map<string, OnlineBotGroup>()
  for (const item of services) {
    const id = item.providerGlobalMetaId
    const existing = map.get(id)
    if (existing) {
      existing.serviceCount += 1
      if (!existing.providerName && item.providerName) {
        existing.providerName = item.providerName
      }
      if (!existing.providerAvatar && item.providerAvatar) {
        existing.providerAvatar = item.providerAvatar
      }
      if (!existing.providerSkill && item.providerSkill) {
        existing.providerSkill = item.providerSkill
      }
      continue
    }
    map.set(id, {
      providerGlobalMetaId: id,
      providerName: item.providerName?.trim() || t('hub.unknownBot'),
      providerAvatar: item.providerAvatar,
      providerSkill: item.providerSkill,
      serviceCount: 1,
    })
  }
  return Array.from(map.values()).sort((a, b) =>
    a.providerName.localeCompare(b.providerName),
  )
}

function BotAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  if (avatar) {
    return (
      <span className="relative inline-flex shrink-0">
        <img
          src={avatar}
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
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hub-border bg-hub-surface2 text-xs font-semibold text-hub-muted">
        {initial}
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
  const bots = useMemo(() => groupProviders(services), [services])

  return (
    <aside
      id={id}
      className={clsx('w-full shrink-0 flex-col', className)}
      aria-label={t('hub.onlineBots')}
    >
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-hub-muted">
        {t('hub.onlineBots')}
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
                <BotAvatar name={bot.providerName} avatar={bot.providerAvatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{bot.providerName}</p>
                  <p className="truncate text-xs text-hub-muted">
                    {bot.providerSkill ??
                      `${bot.serviceCount} service${bot.serviceCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
