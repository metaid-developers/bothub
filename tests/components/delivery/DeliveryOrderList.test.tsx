import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryOrderList } from '@/components/delivery/DeliveryOrderList'
import type { WorkspaceOrder } from '@/delivery/workspace'

function workspaceOrder(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceId: 'svc-image',
    serviceLabel: 'Image Render',
    requestSummary: 'Make a hero image',
    rawRequest: 'Make a hero image',
    outputType: 'image',
    priceLabel: '',
    paymentReference: 'order-1',
    orderCorrelationId: 'order-1',
    status: 'waiting',
    assetCount: 0,
    messageCount: 1,
    unreadCount: 0,
    createdAt: 10,
    updatedAt: 10,
    lastActivityAt: 10,
    messages: [],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryOrderList', () => {
  it('renders buyer request cards instead of technical sessions', () => {
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId="self:provider:order-1"
        walletConnected
        syncStatus="ready"
        onSelectOrder={vi.fn()}
      />,
    )

    const list = screen.getByRole('list', { name: '我的请求' })
    expect(within(list).getByText('Image Render')).toBeInTheDocument()
    expect(within(list).getByText('Render Bot')).toBeInTheDocument()
    expect(within(list).getByText('Make a hero image')).toBeInTheDocument()
    expect(within(list).getByText('等待接单')).toBeInTheDocument()
    expect(screen.queryByText(/simplemsg|Socket.IO|Sessions/i)).not.toBeInTheDocument()
  })

  it('selects an order', async () => {
    const onSelectOrder = vi.fn()
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId={null}
        walletConnected
        syncStatus="ready"
        onSelectOrder={onSelectOrder}
      />,
    )

    await fireEvent.click(screen.getByRole('button', { name: /Image Render/ }))

    expect(onSelectOrder).toHaveBeenCalledWith('self:provider:order-1')
  })

  it('shows a recovery-oriented empty state when the wallet is connected but no orders exist', () => {
    render(
      <DeliveryOrderList
        orders={[]}
        selectedOrderId={null}
        walletConnected
        syncStatus="ready"
        onSelectOrder={vi.fn()}
      />,
    )

    expect(screen.getByText('还没有交付记录')).toBeInTheDocument()
    expect(
      screen.getByText('在 Bot Hub 下单后，交付进度和成果会保存在这里。'),
    ).toBeInTheDocument()
  })

  it('shows local cache while history sync is partial', () => {
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId="self:provider:order-1"
        walletConnected
        syncStatus="partial"
        failedPeerCount={2}
        onSelectOrder={vi.fn()}
      />,
    )

    expect(screen.getByText('已显示本地记录，2 个会话同步失败')).toBeInTheDocument()
  })
})
