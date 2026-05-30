import { describe, expect, it } from 'vitest'
import { sessionPreviewText } from '@/delivery/messageDisplay'
import { buildOrderPayload } from '@/order/buildOrderPayload'

describe('sessionPreviewText', () => {
  it('shows clean delivery result text without structured asset payload details', () => {
    const preview = sessionPreviewText(
      '[DELIVERY:order-demo] {"result":"Here are your delivered files.","assets":["metafile://pin.png"]}',
    )

    expect(preview).toBe('Here are your delivered files.')
    expect(preview).not.toContain('[DELIVERY')
    expect(preview).not.toContain('"assets"')
  })

  it('shows order display summary without raw request payload', () => {
    const preview = sessionPreviewText(
      buildOrderPayload({
        displayText: 'Render a landing image',
        rawRequest: 'RAW PROMPT SHOULD NOT APPEAR',
        price: '0',
        currency: 'SPACE',
        orderReference: 'order-demo',
        serviceId: 'svc',
        skillName: 'image-skill',
        outputType: 'image',
      }),
    )

    expect(preview).toBe('Render a landing image')
    expect(preview).not.toContain('RAW PROMPT SHOULD NOT APPEAR')
    expect(preview).not.toContain('<raw_request>')
  })
})
