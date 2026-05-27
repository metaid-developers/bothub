import { beforeEach, describe, expect, it } from 'vitest'
import { clearTestSessionStorage } from '../setup'
import { useMessageStore, type DeliveryMessage } from '@/delivery/messageStore'
import { buildOrderPayload } from '@/order/buildOrderPayload'

const SELF = 'idqself'

function sampleMessage(
  overrides: Partial<DeliveryMessage> & Pick<DeliveryMessage, 'id' | 'peerGlobalMetaId'>,
): DeliveryMessage {
  return {
    fromGlobalMetaId: 'idqpeer',
    toGlobalMetaId: SELF,
    content: 'hello',
    rawContent: 'hello',
    encryption: 'ecdh',
    contentType: 'text/plain',
    timestamp: 1,
    ...overrides,
  }
}

describe('messageStore', () => {
  beforeEach(() => {
    clearTestSessionStorage()
    useMessageStore.setState({ byPeer: {}, selectedSessionKey: null })
  })

  it('appends messages sorted by timestamp ascending within a session', () => {
    const { append, messagesForSession } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'm2',
        peerGlobalMetaId: 'idqpeer',
        timestamp: 2,
        content: 'second',
      }),
    )
    append(
      sampleMessage({
        id: 'm1',
        peerGlobalMetaId: 'idqpeer',
        timestamp: 1,
        content: 'first',
      }),
    )

    expect(messagesForSession('idqpeer', SELF).map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('deduplicates by message id', () => {
    const { append, messagesForSession } = useMessageStore.getState()
    const row = sampleMessage({ id: 'dup', peerGlobalMetaId: 'idqpeer' })
    append(row)
    append({ ...row, content: 'changed' })
    expect(messagesForSession('idqpeer', SELF)).toHaveLength(1)
    expect(messagesForSession('idqpeer', SELF)[0]?.content).toBe('hello')
  })

  it('lists sessions by latest message timestamp', () => {
    const { append, listSessions } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'a1',
        peerGlobalMetaId: 'peer-a',
        timestamp: 10,
      }),
    )
    append(
      sampleMessage({
        id: 'b1',
        peerGlobalMetaId: 'peer-b',
        timestamp: 20,
      }),
    )

    expect(listSessions(SELF).map((s) => s.peerGlobalMetaId)).toEqual(['peer-b', 'peer-a'])
  })

  it('splits order and default sessions for the same peer', () => {
    const orderRef = 'e'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Store split',
      rawRequest: 'z',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-store',
      skillName: 'store-skill',
      outputType: 'text',
    })
    const { append, listSessions, messagesForSession } = useMessageStore.getState()
    append(
      sampleMessage({
        id: 'order-1',
        peerGlobalMetaId: 'idqpeer',
        fromGlobalMetaId: SELF,
        content: orderPayload,
        timestamp: 1,
      }),
    )
    append(
      sampleMessage({
        id: 'chat-1',
        peerGlobalMetaId: 'idqpeer',
        content: 'general chat',
        timestamp: 2,
      }),
    )

    expect(listSessions(SELF)).toHaveLength(2)
    expect(messagesForSession(`idqpeer:${orderRef}`, SELF)).toHaveLength(1)
    expect(messagesForSession('idqpeer', SELF)).toHaveLength(1)
  })
})
