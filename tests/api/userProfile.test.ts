import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUserProfile() {
  return import('@/api/userProfile')
}

describe('user profile API client', () => {
  const avatarPin = `${'a'.repeat(64)}i0`
  const expectedAvatarThumbnail = `/meta-socket/api/v1/users/avatar/accelerate/${avatarPin}?process=thumbnail`

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
    ['chat_pubkey', 'chat_pubkey-value'],
    ['chat_public_key', 'chat_public_key-value'],
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
    [`metafile://${avatarPin}.png`, expectedAvatarThumbnail],
    [`/content/${avatarPin}`, expectedAvatarThumbnail],
    [`/files/content/${avatarPin}`, expectedAvatarThumbnail],
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

  it.each(['avatarId', 'avatarPinId'] as const)(
    'normalizes %s through the avatar thumbnail endpoint',
    async (fieldName) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            code: 1,
            data: {
              globalMetaId: 'global-avatar-id',
              [fieldName]: avatarPin,
            },
          }),
        }),
      )

      const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
      const profile = await fetchUserProfileByGlobalMetaId('global-avatar-id')

      expect(profile.avatarUrl).toBe(expectedAvatarThumbnail)
    },
  )

  it('does not treat bare /content/ as a usable avatar image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-bare-content',
            avatar: '/content/',
          },
        }),
      }),
    )

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-bare-content')

    expect(profile.avatarUrl).toBeUndefined()
  })

  it('falls back to the address profile when the globalMetaId profile has only an unusable avatar', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/meta-socket/api/users/address/1ProviderAddress') {
        return {
          ok: true,
          json: async () => ({
            code: 1,
            data: {
              globalMetaId: 'global-address-fallback',
              address: '1ProviderAddress',
              name: 'Address Bot',
              avatarPinId: avatarPin,
            },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-address-fallback',
            address: '1ProviderAddress',
            avatar: '/content/',
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-address-fallback')

    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/info/globalmetaid/global-address-fallback')
    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/users/address/1ProviderAddress')
    expect(profile).toMatchObject({
      name: 'Address Bot',
      avatarUrl: expectedAvatarThumbnail,
    })
  })
})
