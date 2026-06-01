import { useId, useState } from 'react'
import { sendDeliveryFollowUp } from '@/delivery/sendMessage'
import { useMessageStore } from '@/delivery/messageStore'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { t } from '@/i18n'
import * as metalet from '@/wallet/metalet'
import type { WalletIdentity } from '@/wallet/types'

export interface ComposerSessionInput {
  sessionKey: string
  peerGlobalMetaId: string
  providerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  orderCorrelationId: string | null
  serviceLabel: string | null
  lastMessage?: DeliveryMessage
}

export function DeliveryComposer(props: {
  wallet: WalletIdentity | null
  session: ComposerSessionInput | null
  providerChatPubkey?: string | null
  disabledReason?: string | null
  providerKeyLoading?: boolean
  onFetchProviderKey?: () => void
  onSent?: () => void
}) {
  const { wallet, session, onSent } = props
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const appendOutgoingFollowUp = useMessageStore((s) => s.appendOutgoingFollowUp)

  const providerChatPubkey =
    props.providerChatPubkey?.trim() || session?.providerChatPubkey?.trim() || ''
  const disabledReason =
    props.disabledReason ??
    (!wallet
      ? t('delivery.composerWalletRequired')
      : !session
        ? t('delivery.composerNoSession')
        : !providerChatPubkey
          ? t('delivery.composerNoProviderKey')
          : null)
  const disabled = Boolean(disabledReason) || sending || Boolean(props.providerKeyLoading)
  const canSend = !disabled && Boolean(draft.trim())
  const canFetchProviderKey =
    Boolean(wallet && session && !providerChatPubkey && props.onFetchProviderKey) &&
    !props.providerKeyLoading

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!wallet || !session || disabled || !draft.trim()) return

    const content = draft.trim()
    setSending(true)
    setError(null)
    try {
      const result = await sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: session.peerGlobalMetaId,
        providerChatPubkey,
        content,
        replyPin: session.lastMessage?.pinId,
        metalet,
      })
      await appendOutgoingFollowUp({
        wallet,
        session: { ...session, providerChatPubkey },
        content,
        rawContent: result.encryptedContent,
        pinId: result.pinId,
      })
      setDraft('')
      onSent?.()
    } catch {
      setError(t('delivery.composerSendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      aria-label={t('delivery.composerLabel')}
      onSubmit={handleSubmit}
      className="border-t border-hub-border p-3 md:col-start-2 md:row-start-2"
    >
      <div className="flex items-end gap-2 rounded-card border border-hub-border bg-hub-surface2/70 px-3 py-2">
        <textarea
          aria-label={t('delivery.composerInputLabel')}
          disabled={disabled}
          rows={2}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (error) setError(null)
          }}
          placeholder={disabledReason ?? t('delivery.composerPlaceholder')}
          className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent text-sm text-hub-text outline-none placeholder:text-hub-muted disabled:text-hub-muted"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="shrink-0 rounded-card border border-hub-accent/50 bg-hub-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-hub-accent/90 disabled:cursor-not-allowed disabled:border-hub-border disabled:bg-transparent disabled:text-hub-muted"
        >
          {sending ? t('delivery.sending') : t('delivery.send')}
        </button>
      </div>
      {(disabledReason || error) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-hub-muted">
          <p role={error ? 'alert' : undefined}>{error ?? disabledReason}</p>
          {canFetchProviderKey ? (
            <>
              <p>{t('delivery.providerKeyRetryHint')}</p>
              <button
                type="button"
                aria-controls={detailsId}
                aria-expanded={detailsOpen}
                aria-label={t('delivery.providerKeyDetailsLabel')}
                onClick={() => setDetailsOpen((open) => !open)}
                className="rounded-full border border-hub-border px-2 py-1 text-hub-accent hover:border-hub-muted"
              >
                {t('delivery.technicalDetails')}
              </button>
              {detailsOpen ? (
                <div id={detailsId} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={props.onFetchProviderKey}
                    className="rounded-full border border-hub-border px-2 py-1 text-hub-accent hover:border-hub-muted"
                  >
                    {t('delivery.providerKeyRetry')}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </form>
  )
}
