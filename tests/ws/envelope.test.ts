import { describe, expect, it } from 'vitest'
import {
  parseSocketEnvelope,
  WS_SERVER_NOTIFY_PRIVATE_CHAT,
} from '@/ws/envelope'

const PAYLOAD = { content: 'hello', timestamp: 1 }

describe('parseSocketEnvelope', () => {
  it('parses { M, C, D } canonical envelope', () => {
    const raw = { M: WS_SERVER_NOTIFY_PRIVATE_CHAT, C: 0, D: PAYLOAD }
    expect(parseSocketEnvelope(raw)).toEqual(raw)
  })

  it('parses { M, D } without C (accepts missing C)', () => {
    const raw = { M: WS_SERVER_NOTIFY_PRIVATE_CHAT, D: PAYLOAD }
    expect(parseSocketEnvelope(raw)).toEqual({ ...raw, C: 0 })
  })

  it('parses { M, data } alternate key', () => {
    const raw = { M: WS_SERVER_NOTIFY_PRIVATE_CHAT, data: PAYLOAD }
    expect(parseSocketEnvelope(raw)).toEqual({ M: WS_SERVER_NOTIFY_PRIVATE_CHAT, C: 0, D: PAYLOAD })
  })

  it('parses Socket.IO array format [event, payload]', () => {
    expect(parseSocketEnvelope([WS_SERVER_NOTIFY_PRIVATE_CHAT, PAYLOAD])).toEqual({
      M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
      C: 0,
      D: PAYLOAD,
    })
  })

  it('parses JSON string payloads', () => {
    const envelope = { M: WS_SERVER_NOTIFY_PRIVATE_CHAT, D: PAYLOAD }
    expect(parseSocketEnvelope(JSON.stringify(envelope))).toEqual({ ...envelope, C: 0 })
  })

  it('accepts C with any value (C is not enforced)', () => {
    expect(
      parseSocketEnvelope({ M: WS_SERVER_NOTIFY_PRIVATE_CHAT, C: 200, D: PAYLOAD }),
    ).toEqual({ M: WS_SERVER_NOTIFY_PRIVATE_CHAT, C: 0, D: PAYLOAD })
  })

  it('rejects unknown event types', () => {
    expect(parseSocketEnvelope({ M: 'WS_UNKNOWN', D: {} })).toBeNull()
  })
})
