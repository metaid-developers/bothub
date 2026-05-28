import { clsx } from 'clsx'
import { AssetPreviewCard } from '@/components/delivery/AssetPreviewCard'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { deliveryAssetsFromMessages } from '@/delivery/sessionDisplay'
import { t } from '@/i18n'

export interface DeliveredAssetsPanelProps {
  messages: DeliveryMessage[]
  className?: string
}

export function DeliveredAssetsPanel({ messages, className }: DeliveredAssetsPanelProps) {
  const assets = deliveryAssetsFromMessages(messages)
  const counts = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.kind] = (acc[asset.kind] ?? 0) + 1
    return acc
  }, {})
  const kindCounts = ['image', 'video', 'audio', 'document', 'archive', 'other']
    .map((kind) => ({ kind, count: counts[kind] ?? 0 }))
    .filter(({ count }) => count > 0)

  return (
    <aside
      aria-label={t('delivery.assets')}
      className={clsx(
        'min-h-40 border-t border-hub-border bg-hub-surface/30 p-4 md:border-l md:border-t-0',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-hub-muted">
          {t('delivery.assets')}
        </h2>
        <span className="text-[11px] text-hub-muted">
          {assets.length} {assets.length === 1 ? t('delivery.asset') : t('delivery.assetsCount')}
        </span>
      </div>

      {assets.length === 0 ? (
        <p className="mt-4 text-sm text-hub-muted">{t('delivery.noAssetsYet')}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kindCounts.map(({ kind, count }) => (
              <span
                key={kind}
                className="rounded-full border border-hub-border bg-hub-surface2 px-2 py-0.5 text-[11px] text-hub-muted"
              >
                {kind} {count}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
            {assets.map((asset) => (
              <AssetPreviewCard key={asset.uri} asset={asset} />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
