import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  formatDeliveryMessageTime,
  formatDeliveryTxIdPreview,
  resolveDeliveryMessageTxId,
} from '@/delivery/messageMetadata'
import { getMessageVariant, protocolDisplayTextForMessage } from '@/delivery/messageDisplay'
import { parseOrderMessage } from '@/delivery/orderParser'
import { deliveryAssetsFromMessage } from '@/delivery/sessionDisplay'
import { AssetPreviewCard } from '@/components/delivery/AssetPreviewCard'
import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import { peerDisplayName } from '@/components/delivery/peerDisplay'
import { t } from '@/i18n'

export interface MessageBubbleProps {
  message: DeliveryMessage
  selfGlobalMetaId: string
  selfName?: string | null
  selfAvatarUrl?: string | null
}

interface SelfProfile {
  globalMetaId: string
  name?: string | null
  avatarUrl?: string | null
}

function copyTextToClipboard(value: string): void {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
  void navigator.clipboard.writeText(value).catch(() => undefined)
}

function MessageMeta({
  message,
  align,
}: {
  message: DeliveryMessage
  align: 'left' | 'right' | 'center'
}) {
  const time = formatDeliveryMessageTime(message.timestamp)
  const txId = resolveDeliveryMessageTxId(message)
  const txIdPreview = formatDeliveryTxIdPreview(txId)

  if (!time && !txIdPreview) return null

  return (
    <div
      className={clsx(
        'mt-1.5 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] leading-4 text-hub-muted/80',
        align === 'right' && 'justify-end text-right',
        align === 'center' && 'justify-center text-center',
        align === 'left' && 'justify-start text-left',
      )}
    >
      {time ? (
        <time dateTime={new Date(message.timestamp).toISOString()} className="shrink-0">
          {time}
        </time>
      ) : null}
      {txIdPreview ? (
        <span className="inline-flex max-w-full items-center gap-1.5">
          <span className="shrink-0 uppercase tracking-wide">TxID:</span>
          <span className="min-w-0 truncate font-mono text-[10px] text-hub-muted">
            {txIdPreview}
          </span>
          <button
            type="button"
            onClick={() => copyTextToClipboard(txId)}
            aria-label={t('delivery.message.copyTxId', { txid: txIdPreview })}
            title={t('delivery.message.copyTxId', { txid: txIdPreview })}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-hub-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
          >
            <DocumentDuplicateIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </div>
  )
}

function BubbleShell({
  message,
  isSelf,
  selfProfile,
  children,
  showPeerName = false,
  maxWidthClass = 'max-w-[min(100%,32rem)]',
}: {
  message: DeliveryMessage
  isSelf: boolean
  selfProfile: SelfProfile
  children: ReactNode
  showPeerName?: boolean
  maxWidthClass?: string
}) {
  const displayName = peerDisplayName({
    name: message.peerName,
    globalMetaId: message.peerGlobalMetaId,
  })
  const selfGlobalMetaId = selfProfile.globalMetaId || message.fromGlobalMetaId

  return (
    <div
      className={clsx(
        'flex items-end gap-3',
        isSelf ? 'justify-end pl-10' : 'justify-start pr-10',
      )}
    >
      {!isSelf ? (
        <PeerAvatar
          name={message.peerName}
          avatarUrl={message.peerAvatarUrl}
          globalMetaId={message.peerGlobalMetaId}
        />
      ) : null}
      <div
        className={clsx(
          'flex min-w-0 flex-col',
          maxWidthClass,
          isSelf ? 'items-end' : 'items-start',
        )}
      >
        {!isSelf && showPeerName ? (
          <p className="mb-1 max-w-full truncate px-1 text-xs font-medium text-hub-muted">
            {displayName}
          </p>
        ) : null}
        {children}
        <MessageMeta message={message} align={isSelf ? 'right' : 'left'} />
      </div>
      {isSelf ? (
        <PeerAvatar
          name={selfProfile.name}
          avatarUrl={selfProfile.avatarUrl}
          globalMetaId={selfGlobalMetaId}
        />
      ) : null}
    </div>
  )
}

function OrderBubble({
  message,
  isSelf,
  selfProfile,
}: {
  message: DeliveryMessage
  isSelf: boolean
  selfProfile: SelfProfile
}) {
  const [promptOpen, setPromptOpen] = useState(false)
  const order = parseOrderMessage(message.content)
  if (!order) {
    return (
      <TextBubble
        message={message}
        isSelf={isSelf}
        body={message.content}
        selfProfile={selfProfile}
      />
    )
  }

  const priceLabel = order.price || order.currency ? `${order.price} ${order.currency}`.trim() : ''

  return (
    <BubbleShell
      message={message}
      isSelf={isSelf}
      selfProfile={selfProfile}
      maxWidthClass="max-w-[min(100%,28rem)]"
    >
      <article
        className={clsx(
          'w-fit max-w-full rounded-card px-3.5 py-2.5 text-sm leading-relaxed',
          isSelf
            ? 'bg-hub-accent text-white'
            : 'border border-hub-border bg-hub-surface2 text-white',
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {t('delivery.message.order')}
        </p>
        <p className="mt-1 font-medium">{order.displaySummary}</p>
        {priceLabel ? (
          <p className="mt-1 text-xs opacity-90">
            {t('delivery.message.costLine', { price: priceLabel })}
          </p>
        ) : null}
        {order.rawRequest ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setPromptOpen((open) => !open)}
              className="text-xs underline opacity-90"
            >
              {promptOpen ? t('delivery.message.hideOriginal') : t('delivery.message.showOriginal')}
            </button>
            {promptOpen ? (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-white/20 bg-black/10 p-2 text-xs">
                {order.rawRequest}
              </pre>
            ) : null}
          </div>
        ) : null}
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">{t('delivery.message.savedRequestWarning')}</p>
        ) : null}
      </article>
    </BubbleShell>
  )
}

function TextBubble({
  message,
  isSelf,
  body,
  selfProfile,
}: {
  message: DeliveryMessage
  isSelf: boolean
  body: string
  selfProfile: SelfProfile
}) {
  return (
    <BubbleShell
      message={message}
      isSelf={isSelf}
      selfProfile={selfProfile}
      showPeerName
      maxWidthClass="max-w-[min(100%,30rem)]"
    >
      <div
        className={clsx(
          'w-fit max-w-full rounded-card px-3.5 py-2.5 text-sm leading-relaxed shadow-sm shadow-black/10',
          isSelf
            ? 'bg-hub-accent text-white'
            : 'border border-hub-border bg-hub-surface2 text-white',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">{t('delivery.decryptFailedDefault')}</p>
        ) : null}
      </div>
    </BubbleShell>
  )
}

function SystemBubble({ message }: { message: DeliveryMessage }) {
  return (
    <div className="flex flex-col items-center">
      <p className="max-w-[min(100%,32rem)] rounded-full border border-hub-border bg-hub-surface2/80 px-3 py-1 text-center text-xs text-hub-muted">
        {message.decryptError
          ? t('delivery.decryptFailedDefault')
          : message.content || t('delivery.message.system')}
      </p>
      <MessageMeta message={message} align="center" />
    </div>
  )
}

function DecryptFailedBubble({
  message,
  isSelf,
  selfProfile,
}: {
  message: DeliveryMessage
  isSelf: boolean
  selfProfile: SelfProfile
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const copyValue = (value: string | undefined) => {
    if (!value?.trim()) return
    copyTextToClipboard(value.trim())
  }

  return (
    <BubbleShell message={message} isSelf={isSelf} selfProfile={selfProfile}>
      <article className="w-fit max-w-full rounded-card border border-amber-400/30 bg-hub-surface2 px-3.5 py-2.5 text-sm leading-relaxed text-white">
        <p className="font-medium">{t('delivery.decryptFailedDefault')}</p>
        <button
          type="button"
          aria-controls={detailsId}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
          className="mt-2 text-xs text-hub-accent underline"
        >
          {t('delivery.technicalDetails')}
        </button>
        {detailsOpen ? (
          <div id={detailsId} className="mt-2 space-y-2 text-xs text-hub-muted">
            <div className="flex flex-wrap gap-2">
              {message.pinId ? (
                <button
                  type="button"
                  onClick={() => copyValue(message.pinId)}
                  className="rounded-full border border-hub-border px-2 py-1 hover:border-hub-muted"
                >
                  Pin: {message.pinId}
                </button>
              ) : null}
              {message.txId ? (
                <button
                  type="button"
                  onClick={() => copyValue(message.txId)}
                  className="rounded-full border border-hub-border px-2 py-1 hover:border-hub-muted"
                >
                  Tx: {message.txId}
                </button>
              ) : null}
            </div>
            {message.decryptError ? (
              <p className="whitespace-pre-wrap break-words">{message.decryptError}</p>
            ) : null}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-hub-border bg-black/20 p-2">
              {message.rawContent || message.content}
            </pre>
          </div>
        ) : null}
      </article>
    </BubbleShell>
  )
}

function TimelineEvent({
  message,
  label,
  body,
  tone = 'muted',
}: {
  message: DeliveryMessage
  label: string
  body: string
  tone?: 'muted' | 'success'
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        role="status"
        aria-label={label}
        className={clsx(
          'max-w-[min(100%,34rem)] rounded-full border px-3 py-1 text-center text-xs',
          tone === 'success'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
            : 'border-hub-border bg-hub-surface2/80 text-hub-muted',
        )}
      >
        {body || label}
      </div>
      <MessageMeta message={message} align="center" />
    </div>
  )
}

function DeliveryBubble({
  message,
  isSelf,
  selfProfile,
}: {
  message: DeliveryMessage
  isSelf: boolean
  selfProfile: SelfProfile
}) {
  const assets = deliveryAssetsFromMessage(message)
  const displayText = protocolDisplayTextForMessage(message)

  return (
    <BubbleShell message={message} isSelf={isSelf} selfProfile={selfProfile}>
      <article
        aria-label={t('delivery.message.deliveredAssets')}
        className="w-fit max-w-full rounded-card border border-hub-accent/40 bg-hub-surface2 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm shadow-black/10"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-hub-accent">
          {t('delivery.message.deliveredAssets')}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words">
          {displayText || t('delivery.message.receivedDelivery')}
        </p>
        <p className="mt-2 text-xs text-hub-muted">
          {assets.length} {t('delivery.workspace.assetCountSuffix')}
        </p>
        {assets.length > 0 ? (
          <div className="mt-2 grid max-w-full grid-cols-2 gap-2">
            {assets.map((asset) => (
              <AssetPreviewCard key={asset.uri} asset={asset} />
            ))}
          </div>
        ) : null}
      </article>
    </BubbleShell>
  )
}

export function MessageBubble({
  message,
  selfGlobalMetaId,
  selfName,
  selfAvatarUrl,
}: MessageBubbleProps) {
  const isSelf = message.fromGlobalMetaId.trim() === selfGlobalMetaId.trim()
  const variant = getMessageVariant(message)
  const selfProfile: SelfProfile = {
    globalMetaId: selfGlobalMetaId,
    name: selfName,
    avatarUrl: selfAvatarUrl,
  }

  if (!isSelf && variant !== 'text' && !message.decryptError) {
    return (
      <TextBubble
        message={message}
        isSelf={isSelf}
        body={message.content}
        selfProfile={selfProfile}
      />
    )
  }

  if (variant === 'order') {
    return <OrderBubble message={message} isSelf={isSelf} selfProfile={selfProfile} />
  }
  if (variant === 'status') {
    return (
      <TimelineEvent
        message={message}
        label={t('delivery.message.statusUpdate')}
        body={protocolDisplayTextForMessage(message)}
      />
    )
  }
  if (variant === 'delivery') {
    return <DeliveryBubble message={message} isSelf={isSelf} selfProfile={selfProfile} />
  }
  if (variant === 'completion') {
    return (
      <TimelineEvent
        message={message}
        label={t('delivery.message.orderCompleted')}
        body={protocolDisplayTextForMessage(message) || t('delivery.message.orderCompleted')}
        tone="success"
      />
    )
  }
  if (variant === 'rating_reserved') {
    return (
      <TimelineEvent
        message={message}
        label={t('delivery.message.ratingReserved')}
        body={protocolDisplayTextForMessage(message)}
      />
    )
  }
  if (message.decryptError) {
    return <DecryptFailedBubble message={message} isSelf={isSelf} selfProfile={selfProfile} />
  }
  if (variant === 'system') {
    return <SystemBubble message={message} />
  }
  return (
    <TextBubble
      message={message}
      isSelf={isSelf}
      body={message.content}
      selfProfile={selfProfile}
    />
  )
}
