import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUserProfile() {
  return import('@/api/userProfile')
}

describe('user profile API client', () => {
  const avatarPin = `${'a'.repeat(64)}i0`
  const fallbackAvatarPin = `${'b'.repeat(64)}i0`
  const expectedAvatarContent = `https://manapi.metaid.io/content/${avatarPin}`
  const expectedFallbackAvatarContent = `https://manapi.metaid.io/content/${fallbackAvatarPin}`

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
    [`metafile://${avatarPin}.png`, expectedAvatarContent],
    [`/content/${avatarPin}`, expectedAvatarContent],
    [`/files/content/${avatarPin}`, expectedAvatarContent],
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

  it('normalizes delivery avatar URL variants to MetaID content URLs', async () => {
    const pinId = `${'c'.repeat(64)}i0`
    const expected = `https://manapi.metaid.io/content/${pinId}`

    const { normalizeAvatarUrl } = await loadUserProfile()

    expect(normalizeAvatarUrl(`/api/v1/users/avatar/accelerate/${pinId}?process=thumbnail`)).toBe(
      expected,
    )
    expect(normalizeAvatarUrl(`/users/avatar/accelerate/${pinId}?process=thumbnail`)).toBe(
      expected,
    )
    expect(normalizeAvatarUrl(`https://file.metaid.io/metafile-indexer/content/${pinId}`)).toBe(
      expected,
    )
  })

  it('treats bare meta-socket avatar paths as meta-socket-relative URLs', async () => {
    const { normalizeAvatarUrl } = await loadUserProfile()

    expect(normalizeAvatarUrl('/metafile-indexer/content/avatar-image.png')).toBe(
      '/meta-socket/metafile-indexer/content/avatar-image.png',
    )
    expect(normalizeAvatarUrl('/api/v1/files/content/avatar-image.png')).toBe(
      '/meta-socket/api/v1/files/content/avatar-image.png',
    )
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

      expect(profile.avatarUrl).toBe(expectedAvatarContent)
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

  it('falls back to the meta-socket address profile when the globalMetaId profile has only an unusable avatar', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/meta-socket/api/info/address/1ProviderAddress') {
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
    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/info/address/1ProviderAddress')
    expect(profile).toMatchObject({
      name: 'Address Bot',
      avatarUrl: expectedAvatarContent,
    })
  })

  it('merges address profile fields when the globalMetaId avatar normalizes to a content URL', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/meta-socket/api/info/address/1AccelerateAddress') {
        return {
          ok: true,
          json: async () => ({
            code: 1,
            data: {
              globalMetaId: 'global-accelerate-fallback',
              address: '1AccelerateAddress',
              name: 'Address Profile',
              avatarPinId: fallbackAvatarPin,
              chatpubkey: '04address',
            },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-accelerate-fallback',
            address: '1AccelerateAddress',
            name: 'Global Profile',
            avatar: `/content/${avatarPin}`,
            chatpubkey: '04global',
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-accelerate-fallback')

    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/info/address/1AccelerateAddress')
    expect(profile).toMatchObject({
      name: 'Address Profile',
      avatarUrl: expectedFallbackAvatarContent,
      chatPubkey: '04address',
    })
  })

  it('uses address fallback for file.metaid content avatars', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/meta-socket/api/info/address/1FileMetaidAddress') {
        return {
          ok: true,
          json: async () => ({
            code: 1,
            data: {
              address: '1FileMetaidAddress',
              avatarPinId: fallbackAvatarPin,
            },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-file-metaid-fallback',
            address: '1FileMetaidAddress',
            avatar: `https://file.metaid.io/metafile-indexer/content/${avatarPin}`,
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()
    const profile = await fetchUserProfileByGlobalMetaId('global-file-metaid-fallback')

    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/info/address/1FileMetaidAddress')
    expect(profile.avatarUrl).toBe(expectedFallbackAvatarContent)
  })

  it('keeps the globalMetaId profile when address fallback returns a non-json 404 response', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/meta-socket/api/info/address/1MissingAddress') {
        return {
          ok: false,
          status: 404,
          text: async () => 'not found',
        }
      }
      return {
        ok: true,
        json: async () => ({
          code: 1,
          data: {
            globalMetaId: 'global-missing-address',
            address: '1MissingAddress',
            name: 'Global Profile',
            avatar: '/content/',
            chatpubkey: '04global',
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchUserProfileByGlobalMetaId } = await loadUserProfile()

    await expect(fetchUserProfileByGlobalMetaId('global-missing-address')).resolves.toMatchObject({
      name: 'Global Profile',
      chatPubkey: '04global',
    })
    expect(fetchMock).toHaveBeenCalledWith('/meta-socket/api/info/address/1MissingAddress')
  })
})
