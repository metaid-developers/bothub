import { useId, useRef, useState } from 'react'
import { FaceSmileIcon } from '@heroicons/react/24/outline'
import { sendDeliveryFollowUp } from '@/delivery/sendMessage'
import { useMessageStore } from '@/delivery/messageStore'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { t } from '@/i18n'
import * as metalet from '@/wallet/metalet'
import type { WalletIdentity } from '@/wallet/types'

const EMOJI_OPTIONS = [
  '😃',
  '😁',
  '😂',
  '😄',
  '😊',
  '😍',
  '😎',
  '😌',
  '😉',
  '😢',
  '😭',
  '😡',
  '👍',
  '🙏',
  '🎉',
  '🔥',
  '💡',
  '✅',
  '❤️',
  '🚀',
]

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
  const [emojiOpen, setEmojiOpen] = useState(false)
  const detailsId = useId()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
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

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    let nextCursor = 0
    setDraft((current) => {
      const start = textarea?.selectionStart ?? current.length
      const end = textarea?.selectionEnd ?? current.length
      nextCursor = start + emoji.length
      return `${current.slice(0, start)}${emoji}${current.slice(end)}`
    })
    if (error) setError(null)
    setEmojiOpen(false)
    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(nextCursor, nextCursor)
    })
  }

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
      className="shrink-0 border-t border-hub-border p-3 md:col-start-2 md:row-start-2"
    >
      <div className="relative flex items-end gap-2 rounded-card border border-hub-border bg-hub-surface2/70 px-3 py-2">
        <textarea
          ref={textareaRef}
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
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={disabled}
            aria-label={t('delivery.emojiPicker')}
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-card border border-hub-border text-hub-muted transition hover:border-hub-accent/50 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaceSmileIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          {emojiOpen && !disabled ? (
            <div
              role="menu"
              aria-label={t('delivery.emojiPickerLabel')}
              className="absolute bottom-11 right-0 z-20 grid w-60 grid-cols-5 gap-1 rounded-card border border-hub-border bg-hub-surface2 p-2 shadow-xl shadow-black/30"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  aria-label={t('delivery.insertEmoji', { emoji })}
                  onClick={() => insertEmoji(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-hub-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
