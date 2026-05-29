import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUserProfile() {
  return import('@/api/userProfile')
}

describe('user profile API client', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_META_SOCKET_BASE_URL', '/meta-socket/')
    vi.stubEnv('VITE_METAFILE_ACCELERATE_CONTENT_BASE', 'https://files.example/accelerate')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it.each([
    ['chatpubkey', 'chatpubkey-value'],
    ['chatPubkey', 'chatPubkey-value'],
    ['chatPublicKey', 'chatPublicKey-value'],
    ['pubkey', 'pubkey-value'],
  ])('normalizes %s as chatPubkey', async (fieldName, fieldValue) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            metaid: 'metaid-1',
            globalMetaId: 'global-1',
            name: 'Alice',
            avatar: '/content/avatar-pin',
            [fieldName]: fieldValue,
          },
        }),
      }),
    )

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-1')

    expect(fetch).toHaveBeenCalledWith('/meta-socket/api/info/globalmetaid/global-1')
    expect(profile).toMatchObject({
      metaid: 'metaid-1',
      globalMetaId: 'global-1',
      name: 'Alice',
      chatPubkey: fieldValue,
    })
  })

  it('accepts legacy /api/info success envelopes with code === 1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 1,
          message: 'ok',
          data: {
            metaid: 'metaid-legacy',
            globalmetaid: 'global-legacy',
            name: 'Legacy User',
          },
        }),
      }),
    )

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    await expect(fetchUserProfileByGlobalMetaId('global-legacy')).resolves.toMatchObject({
      metaid: 'metaid-legacy',
      globalMetaId: 'global-legacy',
      name: 'Legacy User',
    })
  })

  it.each([
    ['metafile://avatar-pin.png', 'https://files.example/accelerate/avatar-pin'],
    ['/content/avatar-pin', '/meta-socket/content/avatar-pin'],
    ['https://cdn.example/avatar.png', 'https://cdn.example/avatar.png'],
  ])('normalizes avatar URL %s', async (avatar, expectedAvatarUrl) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-avatar',
            avatar,
          },
        }),
      }),
    )

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-avatar')

    expect(profile.avatar).toBe(avatar)
    expect(profile.avatarUrl).toBe(expectedAvatarUrl)
  })
})
