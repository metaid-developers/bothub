import { beforeEach, describe, expect, it } from 'vitest'
import { clearTestSessionStorage } from '../setup'
import { useMessageStore, type DeliveryMessage } from '@/delivery/messageStore'

function sampleMessage(
  overrides: Partial<DeliveryMessage> & Pick<DeliveryMessage, 'id' | 'peerGlobalMetaId'>,
): DeliveryMessage {
  return {
    fromGlobalMetaId: 'idqpeer',
    toGlobalMetaId: 'idqself',
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
    useMessageStore.setState({ byPeer: {}, selectedPeerGlobalMetaId: null })
  })

  it('appends messages sorted by timestamp ascending', () => {
    const { append, messagesForPeer } = useMessageStore.getState()
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

    expect(messagesForPeer('idqpeer').map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('deduplicates by message id', () => {
    const { append, messagesForPeer } = useMessageStore.getState()
    const row = sampleMessage({ id: 'dup', peerGlobalMetaId: 'idqpeer' })
    append(row)
    append({ ...row, content: 'changed' })
    expect(messagesForPeer('idqpeer')).toHaveLength(1)
    expect(messagesForPeer('idqpeer')[0]?.content).toBe('hello')
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

    expect(listSessions().map((s) => s.peerGlobalMetaId)).toEqual(['peer-b', 'peer-a'])
  })
})
