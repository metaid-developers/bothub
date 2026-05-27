import { describe, expect, it } from 'vitest'
import {
  parseSocketEnvelope,
  WS_SERVER_NOTIFY_PRIVATE_CHAT,
} from '@/ws/envelope'

describe('parseSocketEnvelope', () => {
  it('parses valid private chat push envelope', () => {
    const raw = {
      M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
      C: 0,
      D: { fromGlobalMetaId: 'a', toGlobalMetaId: 'b', content: 'x', timestamp: 1 },
    }
    expect(parseSocketEnvelope(raw)).toEqual(raw)
  })

  it('parses JSON string payloads', () => {
    const envelope = {
      M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
      C: 0,
      D: { hello: true },
    }
    expect(parseSocketEnvelope(JSON.stringify(envelope))).toEqual(envelope)
  })

  it('rejects non-zero C codes', () => {
    expect(
      parseSocketEnvelope({
        M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
        C: 200,
        D: {},
      }),
    ).toBeNull()
  })

  it('rejects unknown event types', () => {
    expect(
      parseSocketEnvelope({
        M: 'WS_UNKNOWN',
        C: 0,
        D: {},
      }),
    ).toBeNull()
  })
})
