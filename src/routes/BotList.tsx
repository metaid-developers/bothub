import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { getOnlineBots, type OnlineBot } from '@/api/onlineBots'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { avatarColor, avatarInitials, getInitialsAvatar } from '@/lib/avatar'
import { t } from '@/i18n'

function compactGlobalMetaId(globalMetaId: string): string {
  if (globalMetaId.length <= 12) return globalMetaId
  return `${globalMetaId.slice(0, 8)}...${globalMetaId.slice(-4)}`
}

function BotCard({ bot }: { bot: OnlineBot }) {
  const initials = avatarInitials(bot.name)
  const bgColor = avatarColor(bot.name)
  const [failed, setFailed] = useState(false)

  const hasAvatar = Boolean(bot.avatar && !failed)
  const fallbackSrc = getInitialsAvatar(bot.name, bot.globalMetaId)

  return (
    <div className="flex flex-col rounded-card border border-hub-border bg-hub-surface p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)] transition hover:border-hub-border/80 hover:bg-hub-surface2/80">
      <div className="flex items-center gap-3">
        {hasAvatar ? (
          <span className="relative inline-flex shrink-0">
            <img
              src={bot.avatar}
              alt=""
              onError={() => setFailed(true)}
              className="h-12 w-12 rounded-full border border-hub-border object-cover"
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-hub-surface bg-hub-online"
              aria-hidden
            />
          </span>
        ) : failed && bot.avatar ? (
          <span className="relative inline-flex shrink-0">
            <img
              src={fallbackSrc}
              alt=""
              className="h-12 w-12 rounded-full border border-hub-border object-cover"
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-hub-surface bg-hub-online"
              aria-hidden
            />
          </span>
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white/90"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{bot.name}</p>
          <p className="truncate font-mono text-[11px] text-hub-muted">
            {compactGlobalMetaId(bot.globalMetaId)}
          </p>
          <p className="truncate text-[11px] text-hub-muted/80">
            {bot.llm || '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; bots: OnlineBot[]; total: number }
  | { status: 'empty' }

export function BotListPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    getOnlineBots(1, 200)
      .then((result) => {
        if (cancelled) return
        if (result.bots.length === 0) {
          setState({ status: 'empty' })
        } else {
          setState({ status: 'loaded', bots: result.bots, total: result.total })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : t('hub.botListError'),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const header = useMemo(() => {
    if (state.status === 'loaded') {
      return (
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {t('hub.allOnlineBots')} ({state.total})
        </h1>
      )
    }
    return (
      <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
        {t('hub.allOnlineBots')}
      </h1>
    )
  }, [state])

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6">{header}</div>
      {state.status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-hub-muted">{t('hub.loadingServices')}</p>
        </div>
      )}
      {state.status === 'error' && (
        <ErrorState
          title={t('common.somethingWrong')}
          message={state.message}
          onRetry={() => {
            setState({ status: 'loading' })
            getOnlineBots(1, 200)
              .then((result) => {
                if (result.bots.length === 0) {
                  setState({ status: 'empty' })
                } else {
                  setState({ status: 'loaded', bots: result.bots, total: result.total })
                }
              })
              .catch((err) => {
                setState({
                  status: 'error',
                  message: err instanceof Error ? err.message : t('hub.botListError'),
                })
              })
          }}
        />
      )}
      {state.status === 'empty' && (
        <EmptyState
          title={t('hub.allOnlineBots')}
          description={t('hub.botListEmpty')}
          className="mt-8"
        />
      )}
      {state.status === 'loaded' && (
        <div
          className={clsx(
            'grid gap-4',
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          )}
        >
          {state.bots.map((bot) => (
            <BotCard key={bot.globalMetaId} bot={bot} />
          ))}
        </div>
      )}
    </div>
  )
}
