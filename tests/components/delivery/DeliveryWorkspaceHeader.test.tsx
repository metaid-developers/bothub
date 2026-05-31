import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryWorkspaceHeader } from '@/components/delivery/DeliveryWorkspaceHeader'
import type { WorkspaceOrder } from '@/delivery/workspace'

function order(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceLabel: 'Image Render',
    requestSummary: 'Make a product hero image',
    rawRequest: 'Make a product hero image',
    priceLabel: '10 SPACE',
    paymentReference: 'txid-1',
    orderCorrelationId: 'order-1',
    status: 'delivered',
    assetCount: 2,
    messageCount: 4,
    unreadCount: 0,
    createdAt: 1000,
    updatedAt: 2000,
    lastActivityAt: 3000,
    messages: [],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryWorkspaceHeader', () => {
  it('summarizes selected order for a buyer', () => {
    render(<DeliveryWorkspaceHeader order={order()} />)

    expect(screen.getByText('Image Render')).toBeInTheDocument()
    expect(screen.getByText('Render Bot')).toBeInTheDocument()
    expect(screen.getByText('Make a product hero image')).toBeInTheDocument()
    expect(screen.getByText('已交付')).toBeInTheDocument()
    expect(screen.getByText('2 个成果')).toBeInTheDocument()
    expect(screen.getByText('10 SPACE')).toBeInTheDocument()
  })

  it('keeps refund and rating as reserved non-actions for now', () => {
    render(<DeliveryWorkspaceHeader order={order({ status: 'completed' })} />)

    expect(screen.getByText('评价')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('退款')).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders a useful empty state', () => {
    render(<DeliveryWorkspaceHeader order={null} />)

    expect(screen.getByText('选择一个请求查看交付进度')).toBeInTheDocument()
  })
})
