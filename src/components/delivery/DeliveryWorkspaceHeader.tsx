import { PeerAvatar } from '@/components/delivery/PeerAvatar'
import { STATUS_LABELS, type WorkspaceOrder, type WorkspaceOrderStatus } from '@/delivery/workspace'
import { t } from '@/i18n'

interface DeliveryWorkspaceHeaderProps {
  order: WorkspaceOrder | null
}

function statusLabel(status: WorkspaceOrderStatus): string {
  const key = STATUS_LABELS[status]
  return key ? t(key as never) : status
}

export function DeliveryWorkspaceHeader({ order }: DeliveryWorkspaceHeaderProps) {
  if (!order) {
    return (
      <div
        aria-label={t('delivery.workspace.noSelectedAria')}
        role="status"
        className="border-b border-hub-border px-4 py-3"
      >
        <p className="text-sm font-semibold text-white">
          {t('delivery.workspace.noSelectedTitle')}
        </p>
        <p className="mt-1 text-xs text-hub-muted">
          {t('delivery.workspace.noSelectedHint')}
        </p>
      </div>
    )
  }

  return (
    <header className="border-b border-hub-border px-4 py-3">
      <div className="flex items-center gap-3">
        <PeerAvatar
          name={order.providerName}
          avatarUrl={order.providerAvatarUrl}
          globalMetaId={order.providerGlobalMetaId}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {order.serviceLabel || t('delivery.unknownService')}
            </p>
            <span className="shrink-0 rounded-full bg-hub-accent/15 px-2.5 py-0.5 text-xs font-medium text-hub-accent">
              {statusLabel(order.status)}
            </span>
          </div>
          <p className="truncate text-xs text-hub-muted">
            {order.providerName || order.providerGlobalMetaId.slice(0, 12)}
          </p>
          <p className="mt-0.5 truncate text-sm text-white/80">{order.requestSummary}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-hub-muted">
        {order.priceLabel && <span>{order.priceLabel}</span>}
        <span>
          {order.assetCount} 个成果
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-hub-border px-2 py-0.5 text-hub-muted"
          >
            评价
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-hub-border px-2 py-0.5 text-hub-muted"
          >
            退款
          </button>
        </span>
      </div>
    </header>
  )
}
