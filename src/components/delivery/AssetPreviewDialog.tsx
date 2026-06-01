import { useEffect, useState } from 'react'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

interface AssetPreviewDialogProps {
  asset: ParsedDeliveryAsset
  open: boolean
  onClose: () => void
}

const PREVIEW_UNAVAILABLE_LABEL = '预览暂不可用，可打开文件'

function canInlinePreview(kind: ParsedDeliveryAsset['kind']): boolean {
  return kind === 'image' || kind === 'video' || kind === 'audio'
}

export function AssetPreviewDialog({ asset, open, onClose }: AssetPreviewDialogProps) {
  const previewUrl = asset.previewUrl || asset.downloadUrl
  const fallbackUrl = asset.fallbackUrl || asset.downloadUrl
  const supportsInlinePreview = canInlinePreview(asset.kind)
  const [mediaSrc, setMediaSrc] = useState(() => previewUrl)
  const [previewFailed, setPreviewFailed] = useState(() => !supportsInlinePreview)

  useEffect(() => {
    setMediaSrc(previewUrl)
    setPreviewFailed(!supportsInlinePreview)
  }, [asset.uri, previewUrl, supportsInlinePreview])

  const handlePreviewError = () => {
    if (mediaSrc !== fallbackUrl) {
      setMediaSrc(fallbackUrl)
      return
    }
    setPreviewFailed(true)
  }

  if (!open) return null

  return (
    <dialog
      open
      aria-label={asset.filename}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-card border border-hub-border bg-hub-surface">
        <div className="flex items-center justify-between border-b border-hub-border px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{asset.filename}</p>
            <p className="text-xs text-hub-muted">{asset.extension || asset.kind}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-card border border-hub-border px-3 py-1 text-xs font-medium text-hub-muted hover:bg-hub-surface2"
            >
              打开
            </a>
            <a
              href={asset.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-card border border-hub-accent/50 px-3 py-1 text-xs font-medium text-hub-accent hover:bg-hub-accent/10"
            >
              下载
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭预览"
              className="rounded-card border border-hub-border px-3 py-1 text-xs text-hub-muted hover:bg-hub-surface2"
            >
              关闭
            </button>
          </div>
        </div>
        <div className="flex min-h-[16rem] items-center justify-center bg-black/30 p-4">
          {asset.kind === 'image' && !previewFailed && (
            <img
              src={mediaSrc}
              alt={asset.filename}
              onError={handlePreviewError}
              className="max-h-[70vh] max-w-full object-contain"
            />
          )}
          {asset.kind === 'video' && !previewFailed && (
            <video
              key={mediaSrc}
              controls
              playsInline
              onError={handlePreviewError}
              className="max-h-[70vh] max-w-full"
            >
              <source src={mediaSrc} type={asset.mimeType} onError={handlePreviewError} />
            </video>
          )}
          {asset.kind === 'audio' && !previewFailed && (
            <div className="py-8">
              <audio
                key={mediaSrc}
                controls
                onError={handlePreviewError}
              >
                <source src={mediaSrc} type={asset.mimeType} onError={handlePreviewError} />
              </audio>
            </div>
          )}
          {previewFailed && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="text-4xl font-bold text-hub-muted/50">
                {asset.extension?.toUpperCase() || 'FILE'}
              </span>
              <p className="text-sm text-hub-muted">
                {PREVIEW_UNAVAILABLE_LABEL}
              </p>
              <p className="max-w-sm text-xs text-hub-muted">{asset.filename}</p>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}
