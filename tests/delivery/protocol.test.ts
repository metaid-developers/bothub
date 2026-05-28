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
