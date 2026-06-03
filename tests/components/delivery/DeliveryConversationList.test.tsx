import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryConversationList } from '@/components/delivery/DeliveryConversationList'
import type { DeliveryConversation } from '@/delivery/conversationWorkspace'
import type { DeliveryMessage } from '@/delivery/messageStore'

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

function conversation(
  overrides: Partial<DeliveryConversation> = {},
): DeliveryConversation {
  const lastMessage = overrides.lastMessage ?? message()
  return {
    id: 'idqprovider',
    providerGlobalMetaId: 'idqprovider',
    providerChatPubkey: 'chat-pubkey',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    latestActivityAt: 10,
    lastMessage,
    messageCount: lastMessage ? 1 : 0,
    activeOrderCount: 0,
    deliveredOrderCount: 0,
    assetCount: 0,
    messages: lastMessage ? [lastMessage] : [],
    assets: [],
    orderThreads: [],
    ...overrides,
  }
}

describe('DeliveryConversationList', () => {
  it('renders one provider row with aggregate order and asset counts', () => {
    render(
      <DeliveryConversationList
        conversations={[
          conversation({
            providerName: 'Render Bot',
            activeOrderCount: 2,
            assetCount: 3,
            lastMessage: message({ content: 'latest reply', timestamp: 30 }),
          }),
        ]}
        selectedConversationId="idqprovider"
        walletConnected
        syncStatus="ready"
        onSelectConversation={vi.fn()}
      />,
    )

    const list = screen.getByRole('list', { name: '服务方会话' })
    expect(within(list).getByText('Render Bot')).toBeInTheDocument()
    expect(within(list).getByText('latest reply')).toBeInTheDocument()
    expect(within(list).getByText('2 个进行中')).toBeInTheDocument()
    expect(within(list).getByText('3 个成果')).toBeInTheDocument()
    expect(screen.queryByText('Image Render')).not.toBeInTheDocument()
  })

  it('calls onSelectConversation with conversation id when row clicked', async () => {
    const onSelectConversation = vi.fn()
    render(
      <DeliveryConversationList
        conversations={[conversation()]}
        selectedConversationId={null}
        walletConnected
        syncStatus="ready"
        onSelectConversation={onSelectConversation}
      />,
    )

    await fireEvent.click(screen.getByRole('button', { name: 'Render Bot' }))

    expect(onSelectConversation).toHaveBeenCalledWith('idqprovider')
  })

  it('shows disconnected empty state', () => {
    render(
      <DeliveryConversationList
        conversations={[]}
        selectedConversationId={null}
        walletConnected={false}
        syncStatus="idle"
        onSelectConversation={vi.fn()}
      />,
    )

    expect(screen.getByText('连接钱包后查看交付')).toBeInTheDocument()
    expect(screen.getByText('连接 Metalet 钱包后即可查看和管理交付记录。')).toBeInTheDocument()
  })

  it('shows connected empty state with conversation copy', () => {
    render(
      <DeliveryConversationList
        conversations={[]}
        selectedConversationId={null}
        walletConnected
        syncStatus="ready"
        onSelectConversation={vi.fn()}
      />,
    )

    expect(screen.getByText('还没有服务方会话')).toBeInTheDocument()
    expect(
      screen.getByText('私聊或下单后，和服务方的沟通与交付会保存在这里。'),
    ).toBeInTheDocument()
  })

  it('shows partial sync banner with local cache', () => {
    render(
      <DeliveryConversationList
        conversations={[conversation()]}
        selectedConversationId="idqprovider"
        walletConnected
        syncStatus="partial"
        failedPeerCount={2}
        onSelectConversation={vi.fn()}
      />,
    )

    expect(screen.getByText('已显示本地记录，2 个会话同步失败')).toBeInTheDocument()
  })

  it('shows provider globalMetaId fallback when providerName missing', () => {
    render(
      <DeliveryConversationList
        conversations={[conversation({ providerName: undefined })]}
        selectedConversationId={null}
        walletConnected
        syncStatus="ready"
        onSelectConversation={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'idqprovider' })).toBeInTheDocument()
    expect(screen.getByText('idqprovider')).toBeInTheDocument()
  })

  it('marks selected row with aria-current', () => {
    render(
      <DeliveryConversationList
        conversations={[conversation()]}
        selectedConversationId="idqprovider"
        walletConnected
        syncStatus="ready"
        onSelectConversation={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { current: true })).toHaveTextContent('Render Bot')
  })
})
