import { clsx } from 'clsx'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { deliveryAssetsFromMessages } from '@/delivery/sessionDisplay'
import { t } from '@/i18n'

export interface DeliveredAssetsPanelProps {
  messages: DeliveryMessage[]
  className?: string
}

export function DeliveredAssetsPanel({ messages, className }: DeliveredAssetsPanelProps) {
  const assets = deliveryAssetsFromMessages(messages)

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
        <ul className="mt-4 flex flex-col gap-2">
          {assets.map((asset) => (
            <li key={asset.uri} className="border-b border-hub-border/70 pb-2 last:border-0">
              <p className="truncate text-sm font-medium text-white">{asset.filename}</p>
              <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-hub-muted">
                <span className="capitalize">{asset.kind}</span>
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-hub-accent hover:underline"
                >
                  {t('delivery.downloadAsset')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
