import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionsList } from '@/components/delivery/SessionsList'
import type { DeliverySession } from '@/delivery/messageStore'

const baseSession: DeliverySession = {
  sessionKey: 'provider-123::order-1',
  peerGlobalMetaId: 'idq1abcdefghijklmnop',
  orderCorrelationId: 'order-1',
  serviceLabel: 'Image Render',
  lastMessage: {
    id: 'message-1',
    peerGlobalMetaId: 'idq1abcdefghijklmnop',
    fromGlobalMetaId: 'idq1abcdefghijklmnop',
    toGlobalMetaId: 'self',
    content: '[DELIVERY:order-1] {"result":"Ready metafile://pin1.png"}',
    rawContent: '',
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 1,
  },
  messageCount: 3,
}

describe('SessionsList', () => {
  it('displays derived status and asset count for sessions', () => {
    render(
      <SessionsList
        sessions={[{ ...baseSession, status: 'delivered', assetCount: 2 }]}
        selectedSessionKey="provider-123::order-1"
        onSelectSession={vi.fn()}
        walletConnected
      />,
    )

    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.getByText('2 assets')).toBeInTheDocument()
  })

  it('keeps selection behavior intact', () => {
    const onSelectSession = vi.fn()
    render(
      <SessionsList
        sessions={[{ ...baseSession, status: 'active', assetCount: 0 }]}
        selectedSessionKey={null}
        onSelectSession={onSelectSession}
        walletConnected
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Image Render/ }))

    expect(onSelectSession).toHaveBeenCalledWith('provider-123::order-1')
  })
})
