import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

interface AssetPreviewDialogProps {
  asset: ParsedDeliveryAsset
  open: boolean
  onClose: () => void
}

export function AssetPreviewDialog({ asset, open, onClose }: AssetPreviewDialogProps) {
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
        <div className="flex items-center justify-center bg-black/30 p-4">
          {asset.kind === 'image' && (
            <img
              src={asset.previewUrl}
              alt={asset.filename}
              onError={(e) => {
                (e.target as HTMLImageElement).src = asset.fallbackUrl
              }}
              className="max-h-[70vh] max-w-full object-contain"
            />
          )}
          {asset.kind === 'video' && (
            <video
              key={asset.previewUrl}
              controls
              playsInline
              onError={(e) => {
                const video = e.target as HTMLVideoElement
                video.poster = ''
              }}
              className="max-h-[70vh] max-w-full"
            >
              <source src={asset.previewUrl} type={asset.mimeType} />
            </video>
          )}
          {asset.kind === 'audio' && (
            <div className="py-8">
              <audio
                key={asset.previewUrl}
                controls
                onError={(e) => {
                  const audio = e.target as HTMLAudioElement
                  audio.controls = false
                }}
              >
                <source src={asset.previewUrl} type={asset.mimeType} />
              </audio>
            </div>
          )}
          {(asset.kind === 'document' || asset.kind === 'archive' || asset.kind === 'other') && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="text-4xl font-bold text-hub-muted/50">
                {asset.extension?.toUpperCase() || 'FILE'}
              </span>
              <p className="text-sm text-hub-muted">
                {asset.filename}
              </p>
              <a
                href={asset.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-card bg-hub-accent px-4 py-2 text-sm font-semibold text-white hover:bg-hub-accent/90"
              >
                下载文件
              </a>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}
