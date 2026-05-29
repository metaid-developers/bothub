import { describe, expect, it } from 'vitest'
import { buildOrderPayload } from '@/order/buildOrderPayload'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  buildGroupedSessionList,
  buildSessionKey,
  groupPeerMessagesBySession,
  messagesForSession,
  parseSessionKey,
  resolveProviderChatPubkey,
} from '@/delivery/sessionGrouping'

const SELF = 'idqself'
const PEER = 'idqpeer'

function msg(
  overrides: Partial<DeliveryMessage> & Pick<DeliveryMessage, 'id' | 'content' | 'timestamp'>,
): DeliveryMessage {
  return {
    peerGlobalMetaId: PEER,
    fromGlobalMetaId: PEER,
    toGlobalMetaId: SELF,
    rawContent: overrides.content,
    encryption: 'ecdh',
    contentType: 'text/plain',
    ...overrides,
  }
}

describe('sessionGrouping', () => {
  it('builds session keys from peer and correlation id', () => {
    expect(buildSessionKey(PEER, null)).toBe(PEER)
    expect(buildSessionKey(PEER, 'abc')).toBe(`${PEER}:abc`)
    expect(parseSessionKey(`${PEER}:abc`)).toEqual({
      peerGlobalMetaId: PEER,
      orderCorrelationId: 'abc',
    })
  })

  it('starts a new order session on outgoing [ORDER]', () => {
    const orderRef = 'a'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Free service',
      rawRequest: 'Need help',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-1',
      skillName: 'fortune',
      outputType: 'text',
    })

    const grouped = groupPeerMessagesBySession(
      [
        msg({
          id: 'm1',
          fromGlobalMetaId: SELF,
          toGlobalMetaId: PEER,
          content: orderPayload,
          timestamp: 1,
        }),
        msg({
          id: 'm2',
          content: 'Thanks, working on it',
          timestamp: 2,
        }),
      ],
      SELF,
    )

    expect(grouped.size).toBe(2)
    expect(grouped.get(buildSessionKey(PEER, orderRef))?.map((m) => m.id)).toEqual(['m1'])
    expect(grouped.get(PEER)?.map((m) => m.id)).toEqual(['m2'])
  })

  it('joins provider replies that mention payment txid', () => {
    const txid = 'b'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Paid',
      rawRequest: 'Go',
      price: '1',
      currency: 'SPACE',
      paymentTxid: txid,
      serviceId: 'pin-2',
      skillName: 'paid-skill',
      outputType: 'text',
    })

    const grouped = groupPeerMessagesBySession(
      [
        msg({
          id: 'o1',
          fromGlobalMetaId: SELF,
          toGlobalMetaId: PEER,
          content: orderPayload,
          timestamp: 1,
        }),
        msg({
          id: 'r1',
          content: `Payment ${txid} received, starting work.`,
          timestamp: 2,
        }),
        msg({
          id: 'r2',
          content: 'Unrelated hello',
          timestamp: 3,
        }),
      ],
      SELF,
    )

    expect(grouped.get(buildSessionKey(PEER, txid))?.map((m) => m.id)).toEqual(['o1', 'r1'])
    expect(grouped.get(PEER)?.map((m) => m.id)).toEqual(['r2'])
  })

  it('joins provider protocol updates with an order txid to the order session', () => {
    const txid = 'f'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Protocol scoped',
      rawRequest: 'Go',
      price: '1',
      currency: 'SPACE',
      paymentTxid: txid,
      serviceId: 'pin-protocol',
      skillName: 'protocol-skill',
      outputType: 'image',
    })

    const grouped = groupPeerMessagesBySession(
      [
        msg({
          id: 'order',
          fromGlobalMetaId: SELF,
          toGlobalMetaId: PEER,
          content: orderPayload,
          timestamp: 1,
        }),
        msg({
          id: 'status',
          content: `[ORDER_STATUS:${txid}] Generating`,
          timestamp: 2,
        }),
        msg({
          id: 'delivery',
          content: `[DELIVERY:${txid}] {"result":"Ready metafile://resultpin001i0.png"}`,
          timestamp: 3,
        }),
      ],
      SELF,
    )

    expect(grouped.get(buildSessionKey(PEER, txid))?.map((m) => m.id)).toEqual([
      'order',
      'status',
      'delivery',
    ])
    expect(grouped.get(PEER)).toBeUndefined()
  })

  it('lists grouped sessions with service label for order threads', () => {
    const orderRef = 'c'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Label test',
      rawRequest: 'x',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-3',
      skillName: 'label-skill',
      outputType: 'text',
    })

    const sessions = buildGroupedSessionList(
      {
        [PEER]: [
          msg({
            id: 'o1',
            fromGlobalMetaId: SELF,
            toGlobalMetaId: PEER,
            content: orderPayload,
            timestamp: 10,
          }),
        ],
      },
      SELF,
    )

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.sessionKey).toBe(buildSessionKey(PEER, orderRef))
    expect(sessions[0]?.serviceLabel).toBe('label-skill')
  })

  it('derives provider chat pubkey for grouped sessions', () => {
    const orderRef = 'e'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Key test',
      rawRequest: 'x',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-5',
      skillName: 'key-skill',
      outputType: 'text',
    })

    const sessions = buildGroupedSessionList(
      {
        [PEER]: [
          msg({
            id: 'o1',
            fromGlobalMetaId: SELF,
            toGlobalMetaId: PEER,
            content: orderPayload,
            timestamp: 1,
            peerChatPubkey: 'stored-provider-key',
          }),
          msg({
            id: 'r1',
            content: `Reply for ${orderRef}`,
            timestamp: 2,
            peerChatPubkey: 'incoming-provider-key',
          }),
        ],
      },
      SELF,
    )

    expect(sessions[0]).toMatchObject({
      sessionKey: buildSessionKey(PEER, orderRef),
      providerChatPubkey: 'stored-provider-key',
    })
  })

  it('resolves provider chat pubkey from session, order, newest message, then profile', () => {
    const baseSession = {
      sessionKey: buildSessionKey(PEER, 'order-key'),
      peerGlobalMetaId: PEER,
      orderCorrelationId: 'order-key',
      serviceLabel: 'Key Skill',
      lastMessage: msg({ id: 'last', content: 'last', timestamp: 4 }),
      messageCount: 2,
    }

    const messages = [
      msg({ id: 'old', content: 'old', timestamp: 1, peerChatPubkey: 'old-message-key' }),
      msg({ id: 'new', content: 'new', timestamp: 2, peerChatPubkey: 'new-message-key' }),
    ]

    expect(
      resolveProviderChatPubkey({
        session: { ...baseSession, providerChatPubkey: 'session-key' },
        orders: [{ providerGlobalMetaId: PEER, providerChatPubkey: 'order-key' }],
        messages,
        providerProfile: { chatPubkey: 'profile-key' },
      }),
    ).toBe('session-key')

    expect(
      resolveProviderChatPubkey({
        session: baseSession,
        orders: [{ providerGlobalMetaId: PEER, providerChatPubkey: 'order-key' }],
        messages,
        providerProfile: { chatPubkey: 'profile-key' },
      }),
    ).toBe('order-key')

    expect(
      resolveProviderChatPubkey({
        session: baseSession,
        orders: [{ providerGlobalMetaId: 'other-peer', providerChatPubkey: 'other-key' }],
        messages,
        providerProfile: { chatPubkey: 'profile-key' },
      }),
    ).toBe('new-message-key')

    expect(
      resolveProviderChatPubkey({
        session: baseSession,
        orders: [],
        messages: [],
        providerProfile: { chatPubkey: 'profile-key' },
      }),
    ).toBe('profile-key')
  })

  it('resolves messages for a session key', () => {
    const orderRef = 'd'.repeat(64)
    const orderPayload = buildOrderPayload({
      displayText: 'Resolve',
      rawRequest: 'y',
      price: '0',
      currency: 'SPACE',
      orderReference: orderRef,
      serviceId: 'pin-4',
      skillName: 'resolve-skill',
      outputType: 'text',
    })
    const byPeer = {
      [PEER]: [
        msg({
          id: 'o1',
          fromGlobalMetaId: SELF,
          toGlobalMetaId: PEER,
          content: orderPayload,
          timestamp: 1,
        }),
        msg({ id: 't1', content: 'peer default', timestamp: 2 }),
      ],
    }

    const orderSession = messagesForSession(
      byPeer,
      buildSessionKey(PEER, orderRef),
      SELF,
    )
    const defaultSession = messagesForSession(byPeer, PEER, SELF)

    expect(orderSession.map((m) => m.id)).toEqual(['o1'])
    expect(defaultSession.map((m) => m.id)).toEqual(['t1'])
  })

  it('excludes messages that do not belong to the current wallet', () => {
    const otherSelf = 'wallet-b'
    const byPeer = {
      [PEER]: [
        msg({
          id: 'old-wallet-message',
          fromGlobalMetaId: 'wallet-a',
          toGlobalMetaId: PEER,
          content: 'old wallet pending state',
          timestamp: 1,
        }),
      ],
    }

    expect(buildGroupedSessionList(byPeer, otherSelf)).toEqual([])
    expect(messagesForSession(byPeer, PEER, otherSelf)).toEqual([])
  })

  it('keeps messages for the current wallet while filtering unrelated rows', () => {
    const byPeer = {
      [PEER]: [
        msg({
          id: 'old-wallet-message',
          fromGlobalMetaId: 'wallet-a',
          toGlobalMetaId: PEER,
          content: 'old wallet pending state',
          timestamp: 1,
        }),
        msg({
          id: 'current-wallet-message',
          fromGlobalMetaId: 'wallet-b',
          toGlobalMetaId: PEER,
          content: 'current wallet state',
          timestamp: 2,
        }),
      ],
    }

    expect(buildGroupedSessionList(byPeer, 'wallet-b')).toEqual([
      expect.objectContaining({
        sessionKey: PEER,
        lastMessage: expect.objectContaining({ id: 'current-wallet-message' }),
        messageCount: 1,
      }),
    ])
    expect(messagesForSession(byPeer, PEER, 'wallet-b').map((m) => m.id)).toEqual([
      'current-wallet-message',
    ])
  })
})
