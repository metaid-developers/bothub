import { useCallback } from 'react'
import { clsx } from 'clsx'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { t } from '@/i18n'
import { useSocket } from '@/ws/useSocket'
import { useWallet } from '@/wallet/useWallet'

export function WsErrorBanner({ className }: { className?: string }) {
  const lastError = useSocket((s) => s.lastError)
  const status = useSocket((s) => s.status)
  const connect = useSocket((s) => s.connect)
  const disconnect = useSocket((s) => s.disconnect)
  const identity = useWallet((s) => s.identity)
  const walletStatus = useWallet((s) => s.status)

  const handleRetry = useCallback(() => {
    const gmid = identity?.globalMetaId?.trim()
    if (!gmid || walletStatus !== 'connected') return
    disconnect()
    connect(gmid)
  }, [connect, disconnect, identity?.globalMetaId, walletStatus])

  const handleDismiss = useCallback(() => {
    useSocket.setState({ lastError: null })
  }, [])

  if (!lastError || status === 'connected') return null

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100',
        className,
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('delivery.wsError')}</p>
        <p className="mt-0.5 truncate text-xs text-amber-200/80">{lastError}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900/60"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden />
          {t('delivery.wsReconnect')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-amber-200/80 hover:bg-amber-900/40 hover:text-amber-50"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
