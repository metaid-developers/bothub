import { describe, expect, it } from 'vitest'
import {
  isPrivateChatForRecipient,
  isPrivateChatItem,
  messageIdFromPrivateChat,
  peerChatPublicKeyFromPrivateChat,
  peerGlobalMetaIdFromPrivateChat,
  type PrivateChatItem,
} from '@/ws/privateChat'

const baseItem: PrivateChatItem = {
  fromGlobalMetaId: 'idqpeer',
  toGlobalMetaId: 'idqself',
  content: 'cipher',
  timestamp: 1_700_000_000,
  pinId: 'pin-abc',
}

describe('privateChat', () => {
  it('validates private chat item shape', () => {
    expect(isPrivateChatItem(baseItem)).toBe(true)
    expect(isPrivateChatItem({ ...baseItem, fromGlobalMetaId: '' })).toBe(false)
    expect(isPrivateChatItem(null)).toBe(false)
  })

  it('matches recipient globalMetaId', () => {
    expect(isPrivateChatForRecipient(baseItem, 'idqself')).toBe(true)
    expect(isPrivateChatForRecipient(baseItem, 'idqother')).toBe(false)
  })

  it('resolves peer globalMetaId from sender perspective', () => {
    expect(peerGlobalMetaIdFromPrivateChat(baseItem, 'idqself')).toBe('idqpeer')
    expect(peerGlobalMetaIdFromPrivateChat(baseItem, 'idqpeer')).toBe('idqself')
  })

  it('resolves peer id and chat key using self aliases', () => {
    const item: PrivateChatItem = {
      ...baseItem,
      fromGlobalMetaId: '1SelfMvcAddress',
      toGlobalMetaId: 'idqpeer',
      toUserInfo: { chatPublicKey: 'peer-key' },
    }

    expect(
      peerGlobalMetaIdFromPrivateChat(item, 'idqself', ['1SelfMvcAddress']),
    ).toBe('idqpeer')
    expect(
      peerChatPublicKeyFromPrivateChat(item, 'idqself', ['1SelfMvcAddress']),
    ).toBe('peer-key')
  })

  it('builds stable message id from pinId', () => {
    expect(messageIdFromPrivateChat(baseItem)).toBe('pin-abc')
    expect(
      messageIdFromPrivateChat({
        ...baseItem,
        pinId: undefined,
        txId: 'tx1',
        index: 2,
      }),
    ).toBe('tx1i2')
  })
})
