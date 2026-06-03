import { useState, useMemo, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'
import type { DeliveryAssetRecord } from '@/delivery/domain'
import { AssetPreviewCard } from '@/components/delivery/AssetPreviewCard'
import { AssetPreviewDialog } from '@/components/delivery/AssetPreviewDialog'
import { t } from '@/i18n'

type Asset = DeliveryAssetRecord | ParsedDeliveryAsset

type AssetKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
type FilterKind = 'all' | AssetKind

interface DeliveryAssetLibraryProps {
  assets: ParsedDeliveryAsset[]
  scopeLabel?: string
}

const FILTER_LABELS: Record<string, string> = {
  all: '全部',
  image: '图片',
  video: '视频',
  audio: '音频',
  document: '文档',
  archive: '压缩包',
  other: '其他',
}

function kindCount(assets: ParsedDeliveryAsset[], kind: AssetKind): number {
  return assets.filter((a) => a.kind === kind).length
}

export function DeliveryAssetLibrary({ assets, scopeLabel }: DeliveryAssetLibraryProps) {
  const [filter, setFilter] = useState<FilterKind>('all')
  const [previewAsset, setPreviewAsset] = useState<ParsedDeliveryAsset | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const trimmedScopeLabel = scopeLabel?.trim()

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: assets.length }
    for (const kind of ['image', 'video', 'audio', 'document', 'archive', 'other'] as AssetKind[]) {
      result[kind] = kindCount(assets, kind)
    }
    return result
  }, [assets])

  const filteredAssets = useMemo(
    () => (filter === 'all' ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter],
  )

  const filtersWithCounts = useMemo(() => {
    const kinds: FilterKind[] = ['all', 'image', 'video', 'audio', 'document', 'archive', 'other']
    return kinds.filter((k) => (k === 'all' ? true : counts[k] > 0))
  }, [counts])

  useEffect(() => {
    if (filter !== 'all' && !filtersWithCounts.includes(filter)) {
      setFilter('all')
    }
  }, [filter, filtersWithCounts])

  async function copyAllLinks() {
    if (!navigator.clipboard) {
      setCopyError('复制失败，请手动打开链接。')
      return
    }
    const text = assets.map((a: Asset) => a.downloadUrl).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyError(null)
    } catch {
      setCopyError('复制失败，请手动打开链接。')
    }
  }

  const handlePreview = useCallback(
    (a: Asset) => setPreviewAsset(a as ParsedDeliveryAsset),
    [],
  )

  const handleCopyLink = useCallback(async (a: Asset) => {
    if (!navigator.clipboard) {
      setCopyError('复制失败，请手动打开链接。')
      return
    }
    try {
      await navigator.clipboard.writeText(a.downloadUrl)
      setCopyError(null)
    } catch {
      setCopyError('复制失败，请手动打开链接。')
    }
  }, [])

  if (assets.length === 0) {
    return (
      <aside
        aria-label={t('delivery.workspace.assets')}
        className="min-h-0 overflow-y-auto border-t border-hub-border bg-hub-surface/30 p-4 md:col-start-3 md:row-span-2 md:row-start-1 md:border-l md:border-t-0"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.workspace.assets')}
          </h2>
          <span className="text-[11px] text-hub-muted">0</span>
        </div>
        {trimmedScopeLabel && (
          <p className="mt-1 truncate text-[11px] text-hub-muted/80" title={trimmedScopeLabel}>
            {trimmedScopeLabel}
          </p>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-semibold text-white">还没有收到成果</p>
          <p className="mt-1 max-w-xs text-xs text-hub-muted">
            服务方完成交付后，图片、视频、音频和附件会显示在这里。
          </p>
        </div>
      </aside>
    )
  }

  return (
    <>
      <aside
        aria-label={t('delivery.workspace.assets')}
        className="min-h-0 overflow-y-auto border-t border-hub-border bg-hub-surface/30 p-4 md:col-start-3 md:row-span-2 md:row-start-1 md:border-l md:border-t-0"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.workspace.assets')}
          </h2>
          <span className="text-[11px] text-hub-muted">
            {assets.length} 个成果
          </span>
        </div>
        {trimmedScopeLabel && (
          <p className="mt-1 truncate text-[11px] text-hub-muted/80" title={trimmedScopeLabel}>
            {trimmedScopeLabel}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {filtersWithCounts.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setFilter(kind)}
              aria-label={`${FILTER_LABELS[kind] ?? kind} ${kind === 'all' ? counts.all : counts[kind] ?? 0}`}
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] font-medium transition',
                filter === kind
                  ? 'bg-hub-accent/20 text-hub-accent'
                  : 'text-hub-muted hover:bg-hub-surface2',
              )}
            >
              {FILTER_LABELS[kind] ?? kind}
              {kind !== 'all' && (
                <span className="ml-0.5 opacity-60">{counts[kind] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {filteredAssets.map((asset, index) => (
            <AssetPreviewCard
              key={`${asset.uri}-${index}`}
              asset={asset}
              mode="compact"
              onPreview={handlePreview}
              onCopyLink={handleCopyLink}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAllLinks}
            aria-label="复制全部链接"
            className="rounded-card border border-hub-border px-2 py-1 text-[11px] text-hub-muted hover:bg-hub-surface2"
          >
            复制全部链接
          </button>
          {copyError && <p className="text-[11px] text-red-400">{copyError}</p>}
        </div>
      </aside>

      {previewAsset && (
        <AssetPreviewDialog
          asset={previewAsset}
          open
          onClose={() => setPreviewAsset(null)}
        />
      )}
    </>
  )
}
