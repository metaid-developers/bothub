import { describe, expect, it } from 'vitest'
import {
  isPrivateChatForRecipient,
  isPrivateChatItem,
  messageIdFromPrivateChat,
  normalizePrivateChatItem,
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

  it('preserves userInfo display, avatar, address, and chat key aliases', () => {
    const normalized = normalizePrivateChatItem({
      fromGlobalMetaId: 'idqpeer',
      toGlobalMetaId: 'idqself',
      content: 'cipher',
      timestamp: 1_700_000_000,
      fromUserInfo: {
        globalMetaId: 'idqpeer',
        metaId: 'meta-peer',
        address: '1PeerAddress',
        name: 'Provider Bot',
        avatar: 'metafile://avatar-pin.png',
        avatarUrl: 'https://cdn.example/avatar.png',
        avatarImage: '/content/avatar-pin',
        avatarId: 'avatar-id',
        avatarPinId: 'avatar-pin-id',
        chat_pubkey: 'peer-key',
        chatPublicKeyPinId: 'chat-key-pin',
      },
    })

    expect(normalized?.fromUserInfo).toMatchObject({
      globalMetaId: 'idqpeer',
      metaid: 'meta-peer',
      address: '1PeerAddress',
      name: 'Provider Bot',
      avatar: 'metafile://avatar-pin.png',
      avatarUrl: 'https://cdn.example/avatar.png',
      avatarImage: '/content/avatar-pin',
      avatarId: 'avatar-id',
      avatarPinId: 'avatar-pin-id',
      chatPublicKey: 'peer-key',
      chatPubkey: 'peer-key',
      chatpubkey: 'peer-key',
      chatPublicKeyId: 'chat-key-pin',
      chatpubkeyId: 'chat-key-pin',
    })
  })

  it('derives from/to globalMetaId from preserved userInfo when top-level fields are missing', () => {
    const normalized = normalizePrivateChatItem({
      content: 'cipher',
      timestamp: 1_700_000_000,
      fromUserInfo: {
        globalMetaId: 'idqpeer',
        name: 'Provider Bot',
      },
      toUserInfo: {
        globalmetaid: 'idqself',
      },
    })

    expect(normalized).toMatchObject({
      fromGlobalMetaId: 'idqpeer',
      toGlobalMetaId: 'idqself',
      fromUserInfo: expect.objectContaining({ name: 'Provider Bot' }),
    })
  })

  it('preserves reply metadata from normalized private chat rows', () => {
    const normalized = normalizePrivateChatItem({
      from: 'idqpeer',
      to: 'idqself',
      content: 'cipher',
      timestamp: 1_700_000_000,
      replyPin: 'pin-original-order',
      replyInfo: { pinId: 'pin-original-order' },
      replyGlobalMetaId: 'idqself',
      replyMetaId: 'meta-self',
    })

    expect(normalized).toMatchObject({
      replyPin: 'pin-original-order',
      replyInfo: { pinId: 'pin-original-order' },
      replyGlobalMetaId: 'idqself',
      replyMetaId: 'meta-self',
    })
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
