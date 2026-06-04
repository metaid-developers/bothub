import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadOnlineBots() {
  return import('@/api/onlineBots')
}

describe('online bots API client', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_META_SOCKET_BASE_URL', 'https://socket.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('hydrates current socket online items through profile data for display avatars', async () => {
    const avatarPin = `${'e'.repeat(64)}i0`
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://socket.test/socket/online/list?page=1&size=20') {
        return {
          json: async () => ({
            code: 0,
            data: {
              items: [
                {
                  metaid: '1OnlineAddress',
                  type: 'app',
                  connectedAt: 1780544945562,
                },
              ],
            },
          }),
        }
      }
      if (url === 'https://socket.test/api/info/globalmetaid/1OnlineAddress') {
        return {
          ok: true,
          json: async () => ({
            code: 1,
            data: {
              globalMetaId: 'idq1online',
              metaid: 'metaid-online',
              name: 'Online Bot',
              avatar: `/content/${avatarPin}`,
              avatarId: avatarPin,
              chatpubkey: '04online-chat-key',
            },
          }),
        }
      }
      if (
        url === 'https://file.metaid.io/metafile-indexer/api/v1/info/globalmetaid/1OnlineAddress'
      ) {
        return {
          ok: true,
          json: async () => ({
            code: 40400,
            message: 'not found',
            data: null,
          }),
        }
      }
      throw new Error(`unexpected URL ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { getOnlineBots } = await loadOnlineBots()
    const result = await getOnlineBots(1, 20)

    expect(result.total).toBe(1)
    expect(result.bots).toEqual([
      {
        globalMetaId: 'idq1online',
        metaId: 'metaid-online',
        name: 'Online Bot',
        avatar: `https://file.metaid.io/metafile-indexer/content/${avatarPin}`,
        llm: '',
        lastSeenAgoSeconds: 0,
      },
    ])
  })
})
