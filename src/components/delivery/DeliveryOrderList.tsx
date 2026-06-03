import { clsx } from 'clsx'
import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import type { DeliverySyncUiStatus } from '@/delivery/syncStatusStore'
import { STATUS_LABELS, type WorkspaceOrder } from '@/delivery/workspace'
import { t } from '@/i18n'

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}

function statusLabel(status: WorkspaceOrder['status']): string {
  const key = STATUS_LABELS[status]
  return key ? t(key as never) : status
}

interface DeliveryOrderListProps {
  orders: WorkspaceOrder[]
  selectedOrderId: string | null
  walletConnected: boolean
  syncStatus: DeliverySyncUiStatus
  failedPeerCount?: number
  onSelectOrder: (orderId: string) => void
}

export function DeliveryOrderList({
  orders,
  selectedOrderId,
  walletConnected,
  syncStatus,
  failedPeerCount = 0,
  onSelectOrder,
}: DeliveryOrderListProps) {
  if (!walletConnected && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
        <p className="text-sm font-semibold text-white">{t('delivery.walletNotConnectedTitle')}</p>
        <p className="max-w-xs text-xs text-hub-muted">
          {t('delivery.walletNotConnectedHint')}
        </p>
      </div>
    )
  }

  if (orders.length > 0) {
    return (
      <div>
        {syncStatus === 'partial' && failedPeerCount > 0 && (
          <p className="mb-2 px-1 text-xs text-amber-400/70">
            {`已显示本地记录，${failedPeerCount} 个会话同步失败`}
          </p>
        )}
        {syncStatus === 'error' && (
          <p className="mb-2 px-1 text-xs text-red-400/70">
            {t('delivery.workspace.syncError')}
          </p>
        )}
        <OrderCardList
          orders={orders}
          selectedOrderId={selectedOrderId}
          onSelectOrder={onSelectOrder}
        />
      </div>
    )
  }

  if (syncStatus === 'hydrating' || (syncStatus === 'idle' && walletConnected && orders.length === 0)) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncHydrating')}</p>
      </div>
    )
  }

  if (syncStatus === 'syncing' && orders.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncSyncing')}</p>
      </div>
    )
  }

  if (syncStatus === 'error' && orders.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-hub-muted">{t('delivery.workspace.syncError')}</p>
      </div>
    )
  }

  if (orders.length === 0 && walletConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
        <p className="text-sm font-semibold text-white">
          {t('delivery.workspace.noOrdersTitle')}
        </p>
        <p className="max-w-xs text-xs text-hub-muted">
          {t('delivery.workspace.noOrdersHint')}
        </p>
      </div>
    )
  }

  return (
    <OrderCardList
      orders={orders}
      selectedOrderId={selectedOrderId}
      onSelectOrder={onSelectOrder}
    />
  )
}

function OrderCardList({
  orders,
  selectedOrderId,
  onSelectOrder,
}: {
  orders: WorkspaceOrder[]
  selectedOrderId: string | null
  onSelectOrder: (orderId: string) => void
}) {
  return (
    <ul role="list" aria-label={t('delivery.workspace.orders')} className="space-y-1">
      {orders.map((order) => {
        const selectionId = order.orderCorrelationId?.trim() || order.id
        const isSelected = selectionId === selectedOrderId || order.id === selectedOrderId
        return (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => onSelectOrder(selectionId)}
              aria-label={order.serviceLabel}
              className={clsx(
                'w-full overflow-hidden rounded-card border px-3 py-2.5 text-left transition',
                isSelected
                  ? 'border-hub-accent/60 bg-hub-surface2/90'
                  : 'border-transparent bg-hub-surface2/40 hover:bg-hub-surface2/70',
              )}
            >
              <div className="flex items-center gap-2.5">
                <PeerAvatar
                  name={order.providerName}
                  avatarUrl={order.providerAvatarUrl}
                  globalMetaId={order.providerGlobalMetaId}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {order.serviceLabel || t('delivery.unknownService')}
                    </p>
                    <span
                      className={clsx(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        order.status === 'delivered' || order.status === 'completed'
                          ? 'bg-green-500/15 text-green-400'
                          : order.status === 'failed' || order.status === 'failed_to_send'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-hub-accent/15 text-hub-accent',
                      )}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-hub-muted">
                    {order.providerName || order.providerGlobalMetaId.slice(0, 12)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-hub-muted/70">
                    {order.requestSummary}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-hub-muted/60">
                    <span>{formatTime(order.lastActivityAt)}</span>
                    {order.assetCount > 0 && <span>{order.assetCount} 个成果</span>}
                  </div>
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
