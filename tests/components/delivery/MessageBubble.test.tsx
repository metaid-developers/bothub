import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from '@/components/delivery/MessageBubble'
import type { DeliveryMessage } from '@/delivery/messageStore'

function message(content: string, overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: crypto.randomUUID(),
    peerGlobalMetaId: 'provider',
    fromGlobalMetaId: 'provider',
    toGlobalMetaId: 'self',
    content,
    rawContent: content,
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 1,
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('renders status messages as compact timeline events with stripped text', () => {
    render(
      <MessageBubble
        message={message('[ORDER_STATUS:order-1] Provider is generating assets')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByRole('status', { name: 'Order status update' })).toBeInTheDocument()
    expect(screen.getByText('Provider is generating assets')).toBeInTheDocument()
    expect(screen.queryByText(/\[ORDER_STATUS/)).not.toBeInTheDocument()
  })

  it('renders delivery messages with result text and asset count', () => {
    render(
      <MessageBubble
        message={message('[DELIVERY:order-1] {"result":"Ready metafile://pin1.png metafile://pin2.pdf"}')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByRole('article', { name: 'Delivery result' })).toBeInTheDocument()
    expect(screen.getByText('Ready metafile://pin1.png metafile://pin2.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 assets attached')).toBeInTheDocument()
  })

  it('counts structured delivery assets without rendering raw payload as body text', () => {
    render(
      <MessageBubble
        message={message('[DELIVERY:order-1] {"result":"Done","assets":["metafile://pin.png"]}')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('1 asset attached')).toBeInTheDocument()
    expect(screen.queryByText(/"assets"/)).not.toBeInTheDocument()
  })

  it('renders compact asset previews inside delivery messages', () => {
    render(
      <MessageBubble
        message={message('[DELIVERY:order-1] {"result":"Done","assets":["metafile://pin.png","metafile://pin.png"]}')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByRole('img', { name: 'pin.png' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /download/i })).toHaveLength(1)
  })

  it('renders completion and rating-reserved messages with distinct accessible labels', () => {
    render(
      <>
        <MessageBubble
          message={message('[ORDER_END:order-1] Order completed')}
          selfGlobalMetaId="self"
        />
        <MessageBubble
          message={message('[NeedsRating:order-1] Rating will be requested later')}
          selfGlobalMetaId="self"
        />
      </>,
    )

    expect(screen.getByRole('status', { name: 'Order completed' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Rating reserved' })).toBeInTheDocument()
    expect(screen.getByText('Rating will be requested later')).toBeInTheDocument()
  })

  it('keeps NeedsRating as a reserved status without rendering rating UI', () => {
    render(
      <MessageBubble
        message={message('[NeedsRating:order-1] Rating will be requested later')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByRole('status', { name: 'Rating reserved' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: /rating|review/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /rate|review|star|submit/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/leave a review|write a review|rate this|submit rating|[★☆]/i),
    ).not.toBeInTheDocument()
  })

  it('keeps decrypt-failed raw ciphertext hidden behind explicit details', () => {
    render(
      <MessageBubble
        message={message('encrypted-ciphertext', {
          rawContent: 'encrypted-ciphertext',
          decryptError: 'missing peer key',
          pinId: 'pin-decrypt-failed',
          txId: 'tx-decrypt-failed',
        })}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByText('Unable to decrypt this message')).toBeInTheDocument()
    expect(screen.getByText('Pin: pin-decrypt-failed')).toBeInTheDocument()
    expect(screen.getByText('Tx: tx-decrypt-failed')).toBeInTheDocument()
    expect(screen.queryByText('encrypted-ciphertext')).not.toBeInTheDocument()
    expect(screen.queryByText(/connect wallet|pay/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show technical details' }))

    expect(screen.getByText('missing peer key')).toBeInTheDocument()
    expect(screen.getByText('encrypted-ciphertext')).toBeInTheDocument()
  })
})
