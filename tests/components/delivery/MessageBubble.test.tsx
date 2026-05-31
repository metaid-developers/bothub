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

    expect(screen.getByRole('article', { name: '交付成果' })).toBeInTheDocument()
    expect(screen.getByText('Ready metafile://pin1.png metafile://pin2.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 个成果')).toBeInTheDocument()
  })

  it('shows incoming peer name and avatar beside regular private chat text', () => {
    render(
      <MessageBubble
        message={message('hello from provider', {
          peerName: 'Provider Bot',
          peerAvatarUrl: 'https://cdn.example/provider.png',
        } as Partial<DeliveryMessage>)}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByText('Provider Bot')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Provider Bot avatar' })).toHaveAttribute(
      'src',
      'https://cdn.example/provider.png',
    )
  })

  it('shows a stable incoming peer avatar fallback when profile media is missing', () => {
    render(
      <MessageBubble
        message={message('hello from provider', {
          peerGlobalMetaId: 'idqproviderabcdef',
        })}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByLabelText('idqpro…cdef avatar')).toHaveTextContent('I')
  })

  it('counts structured delivery assets without rendering raw payload as body text', () => {
    render(
      <MessageBubble
        message={message('[DELIVERY:order-1] {"result":"Done","assets":["metafile://pin.png"]}')}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('1 个成果')).toBeInTheDocument()
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
    expect(screen.getAllByRole('link', { name: '下载' })).toHaveLength(1)
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

  it('keeps decrypt-failed raw content hidden behind explicit technical details', () => {
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

    expect(screen.getByText('这条交付记录暂时无法显示，已保留原始记录')).toBeInTheDocument()
    expect(screen.queryByText('Pin: pin-decrypt-failed')).not.toBeInTheDocument()
    expect(screen.queryByText('Tx: tx-decrypt-failed')).not.toBeInTheDocument()
    expect(screen.queryByText('encrypted-ciphertext')).not.toBeInTheDocument()
    expect(screen.queryByText(/ciphertext|Unable to decrypt/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/connect wallet|pay/i)).not.toBeInTheDocument()

    const detailsButton = screen.getByRole('button', { name: '技术详情' })
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(detailsButton)

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Pin: pin-decrypt-failed')).toBeInTheDocument()
    expect(screen.getByText('Tx: tx-decrypt-failed')).toBeInTheDocument()
    expect(screen.getByText('missing peer key')).toBeInTheDocument()
    expect(screen.getByText('encrypted-ciphertext')).toBeInTheDocument()
  })

  it('renders a recoverable plaintext order with decryptError as an order bubble', () => {
    const orderPayload = [
      '[ORDER] Free Ecommerce Store Blueprint',
      '<raw_request>',
      'Launch a practical ecommerce store.',
      '</raw_request>',
      '支付金额 0 SPACE',
      'order id: order-ref-1',
      'service id: svc-1',
      'skill name: ecommerce-blueprint',
      'output type: text',
    ].join('\n')

    render(
      <MessageBubble
        message={message(orderPayload, {
          decryptError: 'payment succeeded but order message failed',
          rawContent: orderPayload,
        })}
        selfGlobalMetaId="self"
      />,
    )

    expect(screen.getByText('Order')).toBeInTheDocument()
    expect(screen.getByText('Free Ecommerce Store Blueprint')).toBeInTheDocument()
    expect(screen.getByText('Price: 0 SPACE')).toBeInTheDocument()
    expect(screen.queryByText('这条交付记录暂时无法显示，已保留原始记录')).not.toBeInTheDocument()
    expect(screen.queryByText(/Could not decrypt/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show prompt' }))
    expect(screen.getByText('Launch a practical ecommerce store.')).toBeInTheDocument()
  })
})
