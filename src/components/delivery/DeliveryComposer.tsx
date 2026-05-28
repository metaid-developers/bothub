import { useState } from 'react'
import { sendDeliveryFollowUp } from '@/delivery/sendMessage'
import { useMessageStore } from '@/delivery/messageStore'
import type { EnrichedDeliverySession } from '@/delivery/sessionDisplay'
import { t } from '@/i18n'
import * as metalet from '@/wallet/metalet'
import type { WalletIdentity } from '@/wallet/types'

export function DeliveryComposer(props: {
  wallet: WalletIdentity | null
  session: EnrichedDeliverySession | null
  disabledReason?: string | null
  onSent?: () => void
}) {
  const { wallet, session, onSent } = props
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const appendOutgoingFollowUp = useMessageStore((s) => s.appendOutgoingFollowUp)

  const providerChatPubkey = session?.providerChatPubkey?.trim() ?? ''
  const disabledReason =
    props.disabledReason ??
    (!wallet
      ? t('delivery.composerWalletRequired')
      : !session
        ? t('delivery.composerNoSession')
        : !providerChatPubkey
          ? t('delivery.composerNoProviderKey')
          : null)
  const disabled = Boolean(disabledReason) || sending
  const canSend = !disabled && Boolean(draft.trim())

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
        replyPin: session.lastMessage.pinId,
        metalet,
      })
      await appendOutgoingFollowUp({
        wallet,
        session,
        content,
        rawContent: result.encryptedContent,
        pinId: result.pinId,
      })
      setDraft('')
      onSent?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('delivery.composerSendFailed'))
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
        <p className="mt-2 text-xs text-hub-muted" role={error ? 'alert' : undefined}>
          {error ?? disabledReason}
        </p>
      )}
    </form>
  )
}
