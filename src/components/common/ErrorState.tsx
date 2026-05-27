import { clsx } from 'clsx'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { t } from '@/i18n'

export interface ErrorStateProps {
  title: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-3 rounded-card border border-red-500/30 bg-red-950/20 px-4 py-8 text-center',
        className,
      )}
      role="alert"
    >
      <ExclamationTriangleIcon className="h-8 w-8 text-red-300/90" aria-hidden />
      <p className="text-sm font-medium text-red-100">{title}</p>
      {message ? <p className="max-w-md text-xs text-red-300/80">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-900/40 px-3 py-1.5 text-sm font-medium text-red-50 transition hover:bg-red-900/70"
        >
          <ArrowPathIcon className="h-4 w-4" aria-hidden />
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  )
}
