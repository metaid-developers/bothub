import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'
import type { DeliveryAssetRecord } from '@/delivery/domain'
import { t } from '@/i18n'

type Asset = DeliveryAssetRecord | ParsedDeliveryAsset

const PREVIEW_UNAVAILABLE_LABEL = '预览暂不可用，可打开文件'

function assetKindLabel(kind: Asset['kind']): string {
  switch (kind) {
    case 'image':
      return t('delivery.assetKinds.image')
    case 'video':
      return t('delivery.assetKinds.video')
    case 'audio':
      return t('delivery.assetKinds.audio')
    case 'document':
      return t('delivery.assetKinds.document')
    case 'archive':
      return t('delivery.assetKinds.archive')
    case 'other':
      return t('delivery.assetKinds.other')
  }
}

function previewSource(asset: Asset): string {
  return asset.previewUrl || asset.downloadUrl
}

function fallbackSource(asset: Asset): string {
  return asset.fallbackUrl || asset.downloadUrl
}

function canInlinePreview(kind: Asset['kind']): boolean {
  return kind === 'image' || kind === 'video' || kind === 'audio'
}

function AssetMetadata({ asset }: { asset: Asset }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-white">{asset.filename}</p>
      <p className="mt-0.5 text-[11px] text-hub-muted">{assetKindLabel(asset.kind)}</p>
    </div>
  )
}

function OpenLink({ asset }: { asset: Asset }) {
  return (
    <a
      href={fallbackSource(asset)}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 text-xs font-medium text-hub-accent hover:underline"
    >
      打开
    </a>
  )
}

function DownloadLink({ asset }: { asset: Asset }) {
  return (
    <a
      href={asset.downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 text-xs font-medium text-hub-accent hover:underline"
    >
      {t('delivery.downloadAsset')}
    </a>
  )
}

interface AssetPreviewCardProps {
  asset: Asset
  mode?: 'compact' | 'full'
  onPreview?: (asset: Asset) => void
  onCopyLink?: (asset: Asset) => void | Promise<void>
}

export function AssetPreviewCard({
  asset,
  mode = 'full',
  onPreview,
  onCopyLink,
}: AssetPreviewCardProps) {
  const previewUrl = previewSource(asset)
  const fallbackUrl = fallbackSource(asset)
  const [mediaSrc, setMediaSrc] = useState(() => previewUrl)
  const [previewFailed, setPreviewFailed] = useState(false)
  const supportsInlinePreview = canInlinePreview(asset.kind)

  useEffect(() => {
    setMediaSrc(previewUrl)
    setPreviewFailed(false)
  }, [asset.kind, asset.uri, previewUrl, fallbackUrl])

  const handlePreviewError = () => {
    if (mediaSrc !== fallbackUrl) {
      setMediaSrc(fallbackUrl)
      return
    }
    setPreviewFailed(true)
  }

  return (
    <article aria-label={asset.filename} className={clsx(
      'overflow-hidden rounded-card border border-hub-border bg-hub-surface2/80',
      mode === 'compact' && 'max-w-full',
    )}>
      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-black/25">
        {asset.kind === 'image' && !previewFailed ? (
          <img
            src={mediaSrc}
            alt={asset.filename}
            onError={handlePreviewError}
            className="h-full w-full object-contain"
          />
        ) : null}
        {asset.kind === 'video' && !previewFailed ? (
          <video
            key={mediaSrc}
            controls
            playsInline
            onError={handlePreviewError}
            className="h-full w-full"
          >
            <source src={mediaSrc} type={asset.mimeType} onError={handlePreviewError} />
          </video>
        ) : null}
        {asset.kind === 'audio' && !previewFailed ? (
          <div className="flex w-full px-2">
            <audio
              key={mediaSrc}
              controls
              onError={handlePreviewError}
              className="w-full"
            >
              <source src={mediaSrc} type={asset.mimeType} onError={handlePreviewError} />
            </audio>
          </div>
        ) : null}
        {(!supportsInlinePreview || previewFailed) ? (
          <div
            className={clsx(
              'flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center',
              previewFailed ? 'text-hub-muted' : 'text-white',
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide">
              {assetKindLabel(asset.kind)}
            </span>
            <span className="max-w-full truncate text-[11px] text-hub-muted">
              {previewFailed || !supportsInlinePreview
                ? PREVIEW_UNAVAILABLE_LABEL
                : asset.extension || asset.kind}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <AssetMetadata asset={asset} />
        <div className="flex items-center gap-1">
          {onPreview && supportsInlinePreview && (
            <button
              type="button"
              aria-label={`预览 ${asset.filename}`}
              onClick={() => onPreview(asset)}
              className="shrink-0 text-xs text-hub-accent hover:underline"
            >
              预览
            </button>
          )}
          {onCopyLink && (
            <button
              type="button"
              aria-label="复制链接"
              onClick={() => onCopyLink(asset)}
              className="shrink-0 text-xs text-hub-accent hover:underline"
            >
              复制链接
            </button>
          )}
          <OpenLink asset={asset} />
          <DownloadLink asset={asset} />
        </div>
      </div>
    </article>
  )
}
