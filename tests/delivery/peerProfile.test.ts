import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mergePeerProfiles,
  peerProfileFromPrivateChatUserInfo,
  peerProfileFromUserProfile,
  peerProfileNeedsHydration,
} from '@/delivery/peerProfile'

describe('peerProfile', () => {
  const avatarPin = `${'a'.repeat(64)}i0`
  const expectedAvatarUrl = `https://man.metaid.io/content/${avatarPin}`

  beforeEach(() => {
    vi.stubEnv('VITE_META_SOCKET_BASE_URL', '/meta-socket/')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts private chat user info aliases into a normalized peer profile', () => {
    expect(peerProfileFromPrivateChatUserInfo({
      name: ' Provider Bot ',
      avatarImage: `metafile://${avatarPin}.png`,
      chatpubkey: ' provider-chat-key ',
    })).toEqual({
      chatPubkey: 'provider-chat-key',
      name: 'Provider Bot',
      avatarUrl: expectedAvatarUrl,
    })
  })

  it('uses avatar pin aliases when private chat user info has no avatar URL', () => {
    expect(peerProfileFromPrivateChatUserInfo({
      avatarPinId: avatarPin,
      chatPublicKey: 'provider-chat-key',
    })).toEqual({
      chatPubkey: 'provider-chat-key',
      avatarUrl: expectedAvatarUrl,
    })
  })

  it('does not overwrite useful earlier peer profile fields', () => {
    expect(mergePeerProfiles(
      {
        chatPubkey: ' first-key ',
        name: '  ',
      },
      {
        chatPubkey: 'second-key',
        name: ' Second Bot ',
        avatarUrl: ' https://cdn.example/second.png ',
      },
      {
        name: 'Third Bot',
        avatarUrl: 'https://cdn.example/third.png',
      },
    )).toEqual({
      chatPubkey: 'first-key',
      name: 'Second Bot',
      avatarUrl: 'https://cdn.example/second.png',
    })
  })

  it('requires hydration when any useful peer profile field is missing', () => {
    expect(peerProfileNeedsHydration({})).toBe(true)
    expect(peerProfileNeedsHydration({
      chatPubkey: 'provider-chat-key',
      name: 'Provider Bot',
    })).toBe(true)
    expect(peerProfileNeedsHydration({
      chatPubkey: 'provider-chat-key',
      name: 'Provider Bot',
      avatarUrl: 'https://cdn.example/provider.png',
    })).toBe(false)
  })

  it('extracts fetched user profiles into cleaned peer profiles', () => {
    expect(peerProfileFromUserProfile({
      name: ' Profile Bot ',
      avatarUrl: ' https://cdn.example/profile.png ',
      chatPubkey: ' profile-chat-key ',
    })).toEqual({
      chatPubkey: 'profile-chat-key',
      name: 'Profile Bot',
      avatarUrl: 'https://cdn.example/profile.png',
    })
  })

  it.each([
    ['avatar', { avatar: `metafile://${avatarPin}.png` }],
    ['avatarImage', { avatarImage: `/content/${avatarPin}` }],
    ['avatarId', { avatarId: avatarPin }],
    ['avatarPinId', { avatarPinId: avatarPin }],
  ])('normalizes fetched profile %s fallback when avatarUrl is absent', (_fieldName, profile) => {
    expect(peerProfileFromUserProfile({
      name: 'Profile Bot',
      chatPubkey: 'profile-chat-key',
      ...profile,
    })).toEqual({
      chatPubkey: 'profile-chat-key',
      name: 'Profile Bot',
      avatarUrl: expectedAvatarUrl,
    })
  })
})
