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
    expect(within(alert).getByText('有交付记录暂时无法显示，已保留原始记录。')).toBeInTheDocument()
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

    const nestedDetailsButton = screen.getAllByRole('button', { name: '技术详情' })[1]
    fireEvent.click(nestedDetailsButton)

    expect(screen.getByText('原始记录暂未显示')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1cipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()
  })

  it('hides raw ecdh content behind diagnostics even without a stored error', () => {
    render(
      <DeliveryStatusTimeline
        order={order({
          status: 'active',
          messages: [
            message({
              id: 'raw-ecdh',
              fromGlobalMetaId: 'idqprovider',
              content: 'U2FsdGVkX1rawcipher',
              rawContent: 'U2FsdGVkX1rawcipher',
              encryption: 'ecdh',
            }),
          ],
        })}
        selfGlobalMetaId="idqbuyer"
      />,
    )

    const detailsButton = screen.getByRole('button', { name: '技术详情' })
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('U2FsdGVkX1rawcipher')).not.toBeInTheDocument()

    fireEvent.click(detailsButton)

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('这条交付记录暂时无法显示，已保留原始记录')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1rawcipher')).not.toBeInTheDocument()

    const nestedDetailsButton = screen.getAllByRole('button', { name: '技术详情' })[1]
    fireEvent.click(nestedDetailsButton)

    expect(screen.getByText('原始记录暂未显示')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1rawcipher')).not.toBeInTheDocument()
  })

  it('renders an All conversation timeline with buyer-readable message bubbles', () => {
    render(
      <DeliveryStatusTimeline
        order={null}
        messages={[
          message({
            id: 'chat-1',
            peerName: 'Render Bot',
            fromGlobalMetaId: 'idqprovider',
            toGlobalMetaId: 'idqbuyer',
            content: 'I can start now.',
            orderCorrelationId: undefined,
            timestamp: 1,
          }),
          message({
            id: 'delivery-1',
            fromGlobalMetaId: 'idqprovider',
            toGlobalMetaId: 'idqbuyer',
            content: '[DELIVERY:order-pin-1] Ready metafile://image.png',
            orderCorrelationId: 'order-pin-1',
            timestamp: 2,
          }),
        ]}
        selfGlobalMetaId="idqbuyer"
        mode="all"
      />,
    )

    expect(screen.getByText('Render Bot')).toBeInTheDocument()
    expect(screen.getByText('I can start now.')).toBeInTheDocument()
    const deliveryCard = screen.getByLabelText('交付成果')
    expect(within(deliveryCard).getByText('Ready metafile://image.png')).toBeInTheDocument()
    expect(within(deliveryCard).getByText('1 个成果')).toBeInTheDocument()
    expect(screen.getByLabelText('image.png')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()
    expect(screen.queryByText('[DELIVERY:order-pin-1] Ready metafile://image.png')).not.toBeInTheDocument()
    expect(screen.queryByText('交付进度')).not.toBeInTheDocument()
  })

  it('renders a safe placeholder for decrypt gaps by default in All mode', () => {
    render(
      <DeliveryStatusTimeline
        order={null}
        messages={[
          message({
            id: 'raw-ecdh',
            fromGlobalMetaId: 'idqprovider',
            content: 'U2FsdGVkX1allcipher',
            rawContent: 'U2FsdGVkX1allcipher',
            encryption: 'ecdh',
            decryptError: 'missing peer key',
          }),
        ]}
        selfGlobalMetaId="idqbuyer"
        mode="all"
      />,
    )

    expect(screen.getByText('这条交付记录暂时无法显示，已保留原始记录')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1allcipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()

    const [topLevelDetailsButton, nestedDetailsButton] = screen.getAllByRole('button', {
      name: '技术详情',
    })
    expect(topLevelDetailsButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(topLevelDetailsButton)

    expect(topLevelDetailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByText('U2FsdGVkX1allcipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()

    fireEvent.click(nestedDetailsButton)

    expect(screen.getByText('原始记录暂未显示')).toBeInTheDocument()
    expect(screen.queryByText('U2FsdGVkX1allcipher')).not.toBeInTheDocument()
    expect(screen.queryByText('missing peer key')).not.toBeInTheDocument()
  })

  it('shows conversation empty state in All mode', () => {
    render(
      <DeliveryStatusTimeline
        order={null}
        messages={[]}
        selfGlobalMetaId="idqbuyer"
        mode="all"
      />,
    )

    expect(screen.getByText('还没有消息')).toBeInTheDocument()
    expect(
      screen.getByText('这个服务方的沟通和交付记录会显示在这里。'),
    ).toBeInTheDocument()
    expect(screen.queryByText('选择一个请求查看交付进度')).not.toBeInTheDocument()
  })

  it('shows empty state when no order is selected', () => {
    render(<DeliveryStatusTimeline order={null} selfGlobalMetaId="idqbuyer" />)

    expect(screen.getByText('选择一个请求查看交付进度')).toBeInTheDocument()
  })
})
