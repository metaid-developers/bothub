import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { WorkspaceOrder } from '@/delivery/workspace'

function message(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'order-message',
    peerGlobalMetaId: 'idqprovider',
    fromGlobalMetaId: 'idqbuyer',
    toGlobalMetaId: 'idqprovider',
    content: '[ORDER] Make image',
    rawContent: '[ORDER] Make image',
    encryption: 'plain',
    contentType: 'text/plain',
    orderCorrelationId: 'order-1',
    timestamp: 1000,
    ...overrides,
  }
}

function order(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    serviceLabel: 'Image Render',
    requestSummary: 'Make image',
    orderCorrelationId: 'order-1',
    status: 'delivered',
    assetCount: 1,
    messageCount: 3,
    unreadCount: 0,
    createdAt: 1000,
    updatedAt: 2000,
    lastActivityAt: 3000,
    messages: [
      message(),
      message({
        id: 'status-1',
        fromGlobalMetaId: 'idqprovider',
        toGlobalMetaId: 'idqbuyer',
        content: '[STATUS:order-1] Provider started',
        timestamp: 2000,
      }),
      message({
        id: 'delivery-1',
        fromGlobalMetaId: 'idqprovider',
        toGlobalMetaId: 'idqbuyer',
        content: '[DELIVERY:order-1] Ready metafile://image.png',
        timestamp: 3000,
      }),
    ],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryStatusTimeline', () => {
  it('renders buyer-readable progress milestones', () => {
    render(<DeliveryStatusTimeline order={order()} selfGlobalMetaId="idqbuyer" />)

    expect(screen.getByText('请求已发送')).toBeInTheDocument()
    expect(screen.getByText('服务处理中')).toBeInTheDocument()
    expect(screen.getByText('成果已交付')).toBeInTheDocument()
    expect(screen.queryByText(/simplemsg|ciphertext|chat key/i)).not.toBeInTheDocument()
  })

  it('keeps technical decrypt details behind explicit diagnostics', () => {
    render(
      <DeliveryStatusTimeline
        order={order({
          status: 'active',
          messages: [
            message({
              id: 'failed',
              fromGlobalMetaId: 'idqprovider',
              content: 'U2FsdGVkX1cipher',
              rawContent: 'U2FsdGVkX1cipher',
              encryption: 'ecdh',
              decryptError: 'missing peer key',
            }),
          ],
        })}
        selfGlobalMetaId="idqbuyer"
      />,
    )

    const alert = screen.getByRole('status', { name: '交付记录需要同步' })
    expect(within(alert).getByText('有消息暂时无法解密，已保留原始记录。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看技术细节' })).not.toBeInTheDocument()
    const detailsButton = screen.getByRole('button', { name: '技术详情' })
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('U2FsdGVkX1cipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()

    fireEvent.click(detailsButton)

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('这条交付记录暂时无法显示，已保留原始记录')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1cipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()
  })

  it('shows empty state when no order is selected', () => {
    render(<DeliveryStatusTimeline order={null} selfGlobalMetaId="idqbuyer" />)

    expect(screen.getByText('选择一个请求查看交付进度')).toBeInTheDocument()
  })
})
