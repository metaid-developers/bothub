import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryConversationHeader } from '@/components/delivery/DeliveryConversationHeader'
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

describe('DeliveryConversationHeader', () => {
  it('summarizes the selected provider conversation', () => {
    render(
      <DeliveryConversationHeader
        conversation={conversation({
          providerName: 'Render Bot',
          activeOrderCount: 2,
          assetCount: 4,
        })}
      />,
    )

    expect(screen.getByText('Render Bot')).toBeInTheDocument()
    expect(screen.getByText('2 个进行中')).toBeInTheDocument()
    expect(screen.getByText('4 个成果')).toBeInTheDocument()
  })

  it('shows buyer-safe empty state when no provider conversation is selected', () => {
    render(<DeliveryConversationHeader conversation={null} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('选择一个服务方会话')).toBeInTheDocument()
    expect(
      screen.getByText('这个服务方的沟通和交付记录会显示在这里。'),
    ).toBeInTheDocument()
  })

  it('falls back to provider id when provider name is missing', () => {
    render(
      <DeliveryConversationHeader
        conversation={conversation({
          providerName: undefined,
          providerGlobalMetaId: 'idqproviderfallback',
        })}
      />,
    )

    expect(screen.getByText('idqproviderfallback')).toBeInTheDocument()
  })
})
