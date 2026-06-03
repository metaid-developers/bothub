import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryOrderTabs } from '@/components/delivery/DeliveryOrderTabs'
import type {
  DeliveryConversation,
  DeliveryOrderThread,
} from '@/delivery/conversationWorkspace'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { WorkspaceOrder } from '@/delivery/workspace'

function message(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'message-1',
    peerGlobalMetaId: 'idqprovider',
    peerName: 'Render Bot',
    fromGlobalMetaId: 'idqprovider',
    toGlobalMetaId: 'idqbuyer',
    content: 'provider reply',
    rawContent: 'provider reply',
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 10,
    ...overrides,
  }
}

function workspaceOrder(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-pin-1',
    sessionId: 'self:provider:order-pin-1',
    sessionKey: 'idqprovider:order-pin-1',
    providerGlobalMetaId: 'idqprovider',
    providerName: 'Render Bot',
    serviceLabel: 'Image Render',
    requestSummary: 'Make an image',
    orderCorrelationId: 'order-pin-1',
    status: 'delivered',
    assetCount: 1,
    messageCount: 2,
    unreadCount: 0,
    createdAt: 10,
    updatedAt: 20,
    lastActivityAt: 30,
    messages: [],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

function orderThread(
  overrides: Partial<DeliveryOrderThread> = {},
): DeliveryOrderThread {
  const order = overrides.order ?? workspaceOrder()
  return {
    id: order.id,
    tabId: 'order:order-pin-1',
    orderId: order.id,
    orderCorrelationId: 'order-pin-1',
    serviceLabel: order.serviceLabel,
    requestSummary: order.requestSummary,
    status: order.status,
    lastActivityAt: order.lastActivityAt,
    assetCount: order.assetCount,
    messageCount: order.messageCount,
    order,
    messages: order.messages,
    assets: [],
    routeAliases: [],
    ...overrides,
  }
}

function conversationWithTwoOrders(): DeliveryConversation {
  const first = orderThread()
  const secondOrder = workspaceOrder({
    id: 'self:provider:order-pin-2',
    serviceLabel: '',
    requestSummary: 'Write launch copy',
    orderCorrelationId: 'order-pin-2',
    assetCount: 0,
    messageCount: 1,
  })
  const second = orderThread({
    id: secondOrder.id,
    tabId: 'order:order-pin-2',
    orderId: secondOrder.id,
    orderCorrelationId: 'order-pin-2',
    serviceLabel: secondOrder.serviceLabel,
    requestSummary: secondOrder.requestSummary,
    assetCount: secondOrder.assetCount,
    messageCount: secondOrder.messageCount,
    order: secondOrder,
    messages: secondOrder.messages,
  })

  return {
    id: 'idqprovider',
    providerGlobalMetaId: 'idqprovider',
    providerChatPubkey: 'chat-pubkey',
    providerName: 'Render Bot',
    latestActivityAt: 30,
    lastMessage: message(),
    messageCount: 3,
    activeOrderCount: 1,
    deliveredOrderCount: 1,
    assetCount: 1,
    messages: [message()],
    assets: [],
    orderThreads: [first, second],
  }
}

describe('DeliveryOrderTabs', () => {
  it('renders All plus one tab per order and reports selection', () => {
    const onSelectTab = vi.fn()
    render(
      <DeliveryOrderTabs
        conversation={conversationWithTwoOrders()}
        selectedTabId="all"
        onSelectTab={onSelectTab}
      />,
    )

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(screen.getByRole('tab', { name: /Image Render/ }))
    expect(onSelectTab).toHaveBeenCalledWith('order:order-pin-1')
  })

  it('does not render a textbox or free-text input', () => {
    render(
      <DeliveryOrderTabs
        conversation={conversationWithTwoOrders()}
        selectedTabId="all"
        onSelectTab={vi.fn()}
      />,
    )

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders a stable All tab when no conversation is selected', () => {
    render(
      <DeliveryOrderTabs
        conversation={null}
        selectedTabId="all"
        onSelectTab={vi.fn()}
      />,
    )

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('keeps long order labels bounded while preserving the full title', () => {
    const longLabel =
      'Extremely long image rendering request with many detailed scene requirements'
    render(
      <DeliveryOrderTabs
        conversation={{
          ...conversationWithTwoOrders(),
          orderThreads: [
            orderThread({
              serviceLabel: longLabel,
            }),
          ],
        }}
        selectedTabId="order:order-pin-1"
        onSelectTab={vi.fn()}
      />,
    )

    const tab = screen.getByRole('tab', { name: new RegExp(longLabel) })
    expect(tab).toHaveAttribute('title', expect.stringContaining(longLabel))
    expect(tab).toHaveClass('max-w-[16rem]')
    expect(screen.getByText(longLabel)).toHaveClass('truncate')
  })
})
