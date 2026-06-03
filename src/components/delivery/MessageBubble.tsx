import { useId, useState } from 'react'
import { clsx } from 'clsx'
import type { DeliveryMessage } from '@/delivery/messageStore'
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
}

function OrderBubble({ message, isSelf }: { message: DeliveryMessage; isSelf: boolean }) {
  const [promptOpen, setPromptOpen] = useState(false)
  const order = parseOrderMessage(message.content)
  if (!order) {
    return <TextBubble message={message} isSelf={isSelf} body={message.content} />
  }

  const priceLabel = order.price || order.currency ? `${order.price} ${order.currency}`.trim() : ''

  return (
    <div className={clsx('flex', isSelf ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[min(100%,28rem)] rounded-card px-3 py-2 text-sm leading-relaxed',
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
      </div>
    </div>
  )
}

function TextBubble({
  message,
  isSelf,
  body,
}: {
  message: DeliveryMessage
  isSelf: boolean
  body: string
}) {
  const displayName = peerDisplayName({
    name: message.peerName,
    globalMetaId: message.peerGlobalMetaId,
  })
  return (
    <div className={clsx('flex gap-2', isSelf ? 'justify-end' : 'justify-start')}>
      {!isSelf ? (
        <PeerAvatar
          name={message.peerName}
          avatarUrl={message.peerAvatarUrl}
          globalMetaId={message.peerGlobalMetaId}
        />
      ) : null}
      <div
        className={clsx(
          'max-w-[min(100%,28rem)] rounded-card px-3 py-2 text-sm leading-relaxed',
          isSelf
            ? 'bg-hub-accent text-white'
            : 'border border-hub-border bg-hub-surface2 text-white',
        )}
      >
        {!isSelf ? (
          <p className="mb-1 truncate text-xs font-medium text-hub-muted">{displayName}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{body}</p>
        {message.decryptError ? (
          <p className="mt-1 text-xs opacity-70">{t('delivery.decryptFailedDefault')}</p>
        ) : null}
      </div>
    </div>
  )
}

function SystemBubble({ message }: { message: DeliveryMessage }) {
  return (
    <div className="flex justify-center">
      <p className="max-w-[min(100%,32rem)] rounded-full border border-hub-border bg-hub-surface2/80 px-3 py-1 text-center text-xs text-hub-muted">
        {message.decryptError
          ? t('delivery.decryptFailedDefault')
          : message.content || t('delivery.message.system')}
      </p>
    </div>
  )
}

function DecryptFailedBubble({ message }: { message: DeliveryMessage }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const copyValue = (value: string | undefined) => {
    if (!value?.trim()) return
    void navigator.clipboard?.writeText(value.trim()).catch(() => undefined)
  }

  return (
    <div className="flex justify-start">
      <article className="max-w-[min(100%,32rem)] rounded-card border border-amber-400/30 bg-hub-surface2 px-3 py-2 text-sm leading-relaxed text-white">
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
    </div>
  )
}

function TimelineEvent({
  label,
  body,
  tone = 'muted',
}: {
  label: string
  body: string
  tone?: 'muted' | 'success'
}) {
  return (
    <div className="flex justify-center">
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
    </div>
  )
}

function DeliveryBubble({ message }: { message: DeliveryMessage }) {
  const assets = deliveryAssetsFromMessage(message)
  const displayText = protocolDisplayTextForMessage(message)

  return (
    <div className="flex justify-start">
      <article
        aria-label={t('delivery.message.deliveredAssets')}
        className="max-w-[min(100%,32rem)] rounded-card border border-hub-accent/40 bg-hub-surface2 px-3 py-2 text-sm leading-relaxed text-white"
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
    </div>
  )
}

export function MessageBubble({ message, selfGlobalMetaId }: MessageBubbleProps) {
  const isSelf = message.fromGlobalMetaId.trim() === selfGlobalMetaId.trim()
  const variant = getMessageVariant(message)

  if (variant === 'order') {
    return <OrderBubble message={message} isSelf={isSelf} />
  }
  if (variant === 'status') {
    return (
      <TimelineEvent
        label={t('delivery.message.statusUpdate')}
        body={protocolDisplayTextForMessage(message)}
      />
    )
  }
  if (variant === 'delivery') {
    return <DeliveryBubble message={message} />
  }
  if (variant === 'completion') {
    return (
      <TimelineEvent
        label={t('delivery.message.orderCompleted')}
        body={protocolDisplayTextForMessage(message) || t('delivery.message.orderCompleted')}
        tone="success"
      />
    )
  }
  if (variant === 'rating_reserved') {
    return (
      <TimelineEvent
        label={t('delivery.message.ratingReserved')}
        body={protocolDisplayTextForMessage(message)}
      />
    )
  }
  if (message.decryptError) {
    return <DecryptFailedBubble message={message} />
  }
  if (variant === 'system') {
    return <SystemBubble message={message} />
  }
  return <TextBubble message={message} isSelf={isSelf} body={message.content} />
}
