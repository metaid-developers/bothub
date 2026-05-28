import { describe, expect, it } from 'vitest'
import type { DeliveryMessage } from '@/delivery/messageStore'
import { deriveSessionStatus, deliveryAssetsFromMessage } from '@/delivery/sessionDisplay'
import { buildOrderPayload } from '@/order/buildOrderPayload'

const SELF = 'buyer'
const PROVIDER = 'provider'

function message(
  content: string,
  overrides: Partial<DeliveryMessage> = {},
): DeliveryMessage {
  return {
    id: `message-${content}`,
    peerGlobalMetaId: PROVIDER,
    fromGlobalMetaId: PROVIDER,
    toGlobalMetaId: SELF,
    content,
    rawContent: content,
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 1,
    ...overrides,
  }
}

function orderMessage(orderReference = 'order-1'): DeliveryMessage {
  return message(
    buildOrderPayload({
      displayText: 'Render order',
      rawRequest: 'Make this',
      price: '0',
      currency: 'SPACE',
      orderReference,
      serviceId: 'svc',
      skillName: 'render-skill',
      outputType: 'image',
    }),
    { fromGlobalMetaId: SELF, toGlobalMetaId: PROVIDER },
  )
}

describe('deriveSessionStatus', () => {
  it('marks a provider plain-text reply after an outgoing order as active', () => {
    expect(deriveSessionStatus([orderMessage(), message('Working on it now')], SELF)).toBe(
      'active',
    )
  })

  it('maps NeedsRating protocol messages to completed', () => {
    expect(deriveSessionStatus([orderMessage(), message('[NeedsRating:order-1]')], SELF)).toBe(
      'completed',
    )
  })

  it('does not fail a session just because plain text contains no error', () => {
    expect(deriveSessionStatus([orderMessage(), message('Finished with no error')], SELF)).toBe(
      'active',
    )
  })

  it('marks explicit protocol status errors as failed', () => {
    expect(
      deriveSessionStatus(
        [orderMessage(), message('[ORDER_STATUS:order-1] error: provider crashed')],
        SELF,
      ),
    ).toBe('failed')
  })
})

describe('deliveryAssetsFromMessage', () => {
  it('extracts metafile assets from structured delivery assets fields', () => {
    const assets = deliveryAssetsFromMessage(
      message('[DELIVERY:order-1] {"result":"Done","assets":["metafile://pin.png"]}'),
    )

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      uri: 'metafile://pin.png',
      filename: 'pin.png',
      kind: 'image',
    })
  })
})
