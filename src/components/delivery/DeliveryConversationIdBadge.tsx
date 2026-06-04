import { useEffect, useState } from 'react'
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { t } from '@/i18n'

type CopyState = 'idle' | 'copied' | 'error'

interface DeliveryConversationIdBadgeProps {
  sessionId: string
  className?: string
}

export function DeliveryConversationIdBadge({
  sessionId,
  className,
}: DeliveryConversationIdBadgeProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  useEffect(() => {
    setCopyState('idle')
  }, [sessionId])

  async function copySessionId() {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(sessionId)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className={clsx('flex min-w-0 flex-col items-end gap-1', className)}>
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-hub-border bg-hub-surface2/70 px-2 py-1 text-[11px]">
        <span className="shrink-0 text-hub-muted">{t('delivery.conversationId.label')}</span>
        <span
          className="min-w-0 truncate font-mono text-[10px] text-white/80"
          title={sessionId}
        >
          {sessionId}
        </span>
        <button
          type="button"
          onClick={() => void copySessionId()}
          aria-label={t('delivery.conversationId.copy')}
          title={t('delivery.conversationId.copy')}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-hub-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
        >
          <DocumentDuplicateIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {copyState !== 'idle' && (
        <span
          role="status"
          className={clsx(
            'text-[11px]',
            copyState === 'copied' ? 'text-hub-accent' : 'text-red-400',
          )}
        >
          {copyState === 'copied'
            ? t('delivery.conversationId.copied')
            : t('delivery.conversationId.copyFailed')}
        </span>
      )}
    </div>
  )
}
