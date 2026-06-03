import { describe, expect, it } from 'vitest'
import { getMessageVariant } from '@/delivery/messageDisplay'
import { parseDeliveryProtocol } from '@/delivery/protocol'
import type { DeliveryMessage } from '@/delivery/messageStore'

function deliveryMessage(content: string): DeliveryMessage {
  return {
    id: `message-${content}`,
    peerGlobalMetaId: 'provider',
    fromGlobalMetaId: 'provider',
    toGlobalMetaId: 'buyer',
    content,
    rawContent: content,
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 1,
  }
}

describe('parseDeliveryProtocol', () => {
  const orderTxid = 'a'.repeat(64)

  it('strips ORDER_STATUS tags and captures useful non-empty correlation ids', () => {
    expect(parseDeliveryProtocol('[ORDER_STATUS:abcd] generating video')).toEqual({
      kind: 'order_status',
      orderCorrelationId: 'abcd',
      displayText: 'generating video',
      rawText: '[ORDER_STATUS:abcd] generating video',
      deliveryResult: '',
      structuredPayload: null,
    })
  })

  it.each([
    [`[ORDER_STATUS:${orderTxid}] generating video\norder pin id: order-pin-1`, 'order_status', 'order-pin-1', 'generating video'],
    [`[DELIVERY:${orderTxid}] {"result":"done metafile://abc123i0.png"}`, 'delivery', orderTxid, 'done metafile://abc123i0.png'],
    [`[NeedsRating:${orderTxid}] please rate\norder pin id: order-pin-1`, 'needs_rating', 'order-pin-1', 'please rate'],
    [`[ORDER_END:${orderTxid} completed] complete\norder pin id: order-pin-1`, 'order_end', 'order-pin-1', 'complete'],
  ] as const)('parses IDBots %s fixtures', (content, kind, orderCorrelationId, displayText) => {
    expect(parseDeliveryProtocol(content)).toMatchObject({
      kind,
      orderCorrelationId,
      displayText,
    })
  })

  it('normalizes protocol assignment to order pin id metadata when a legacy tag is also present', () => {
    expect(
      parseDeliveryProtocol(`[ORDER_STATUS:${orderTxid}] generating video\norder pin id: order-pin-i0`),
    ).toMatchObject({
      kind: 'order_status',
      orderCorrelationId: 'order-pin-i0',
      displayText: 'generating video',
    })
  })

  it.each([
    [
      'orderPinId',
      `[ORDER_STATUS:${orderTxid}] generating video\norderPinId: order-pin-camel-i0`,
      'order-pin-camel-i0',
    ],
    [
      'serviceOrderPinId',
      `[ORDER_END:${orderTxid}] complete\nserviceOrderPinId = service-order-pin-camel-i0`,
      'service-order-pin-camel-i0',
    ],
  ] as const)(
    'normalizes protocol assignment to %s metadata over a legacy tag',
    (_metadataKey, content, orderCorrelationId) => {
      expect(parseDeliveryProtocol(content)).toMatchObject({
        orderCorrelationId,
      })
    },
  )

  it('normalizes delivery payload orderPinId metadata as the order correlation', () => {
    expect(
      parseDeliveryProtocol(
        `[DELIVERY:${orderTxid}] {"orderPinId":"order-pin-i0","result":"done metafile://abc123i0.png"}`,
      ),
    ).toMatchObject({
      kind: 'delivery',
      orderCorrelationId: 'order-pin-i0',
      displayText: 'done metafile://abc123i0.png',
    })
  })

  it('normalizes delivery payload serviceOrderPinId metadata as the order correlation', () => {
    expect(
      parseDeliveryProtocol(
        `[DELIVERY:${orderTxid}] {"serviceOrderPinId":"service-order-pin-i0","result":"done"}`,
      ),
    ).toMatchObject({
      kind: 'delivery',
      orderCorrelationId: 'service-order-pin-i0',
      displayText: 'done',
    })
  })

  it('extracts DELIVERY result payloads as display text and delivery result', () => {
    expect(parseDeliveryProtocol('[DELIVERY] {"result":"done metafile://abc123i0.png"}')).toEqual({
      kind: 'delivery',
      orderCorrelationId: '',
      displayText: 'done metafile://abc123i0.png',
      rawText: '[DELIVERY] {"result":"done metafile://abc123i0.png"}',
      deliveryResult: 'done metafile://abc123i0.png',
      structuredPayload: { result: 'done metafile://abc123i0.png' },
    })
  })

  it('keeps DELIVERY kind when payload is invalid or missing a result', () => {
    expect(parseDeliveryProtocol('[DELIVERY] {not json')).toMatchObject({
      kind: 'delivery',
      orderCorrelationId: '',
      displayText: '{not json',
      deliveryResult: '',
      structuredPayload: null,
    })

    expect(parseDeliveryProtocol('[DELIVERY] {"status":"done"}')).toMatchObject({
      kind: 'delivery',
      displayText: '{"status":"done"}',
      deliveryResult: '',
      structuredPayload: null,
    })
  })

  it('keeps structured DELIVERY payloads when result is an empty string', () => {
    expect(parseDeliveryProtocol('[DELIVERY] {"result":""}')).toEqual({
      kind: 'delivery',
      orderCorrelationId: '',
      displayText: '{"result":""}',
      rawText: '[DELIVERY] {"result":""}',
      deliveryResult: '',
      structuredPayload: { result: '' },
    })
  })

  it('keeps structured DELIVERY payloads when result is whitespace-only', () => {
    expect(parseDeliveryProtocol('[DELIVERY] {"result":"   "}')).toEqual({
      kind: 'delivery',
      orderCorrelationId: '',
      displayText: '{"result":"   "}',
      rawText: '[DELIVERY] {"result":"   "}',
      deliveryResult: '',
      structuredPayload: { result: '   ' },
    })
  })

  it('strips ORDER_END and NeedsRating tags', () => {
    expect(parseDeliveryProtocol('[ORDER_END:abcd] complete')).toMatchObject({
      kind: 'order_end',
      orderCorrelationId: 'abcd',
      displayText: 'complete',
    })

    expect(parseDeliveryProtocol('[NeedsRating:abcd]')).toMatchObject({
      kind: 'needs_rating',
      orderCorrelationId: 'abcd',
      displayText: '',
    })
  })

  it('returns plain content when no known protocol tag is present', () => {
    expect(parseDeliveryProtocol('hello provider')).toMatchObject({
      kind: 'plain',
      orderCorrelationId: '',
      displayText: 'hello provider',
      deliveryResult: '',
      structuredPayload: null,
    })
  })
})

describe('getMessageVariant', () => {
  it.each([
    ['[ORDER_STATUS:abcd] generating video', 'status'],
    ['[DELIVERY] {"result":"done"}', 'delivery'],
    ['[ORDER_END:abcd] complete', 'completion'],
    ['[NeedsRating:abcd]', 'rating_reserved'],
  ] as const)('maps %s to %s', (content, variant) => {
    expect(getMessageVariant(deliveryMessage(content))).toBe(variant)
  })
})
