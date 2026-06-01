import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import homesFixture from '../fixtures/meta-socket/private-chat-homes-live-shape.json'
import historyFixture from '../fixtures/meta-socket/private-chat-list-live-shape.json'
import type { WalletIdentity } from '@/wallet/types'

async function loadPrivateChat() {
  return import('@/api/privateChat')
}

describe('private chat API client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('fetch mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_META_SOCKET_BASE_URL', '/meta-socket/')
    })

    it('listPrivateChatHomes fetches canonical encoded homes endpoint and unwraps list', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => homesFixture,
      })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHomes } = await loadPrivateChat()
      const homes = await listPrivateChatHomes('wallet address/with space')

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/meta-socket/api/private-chat/homes/wallet%20address%2Fwith%20space',
      )
      expect(homes).toHaveLength(1)
      expect(homes[0]).toMatchObject({
        metaId: 'idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z',
        globalMetaId: 'idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z',
      })
      expect(homes[0].lastMessage?.content).toBeTruthy()
    })

    it('listPrivateChatHistory fetches canonical messages endpoint and preserves pagination fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => historyFixture,
      })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHistory } = await loadPrivateChat()
      const page = await listPrivateChatHistory({
        metaId: '1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX',
        otherMetaId: 'peer id/with?',
        cursor: '',
        size: 5,
        timestamp: 1777322934,
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/meta-socket/api/private-chat/messages?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=peer+id%2Fwith%3F&cursor=&size=5&timestamp=1777322934',
      )
      expect(page.total).toBe(3)
      expect(page.nextCursor).toBe('')
      expect(page.nextTimestamp).toBe(1777322934)
      expect(page.list).toHaveLength(3)
    })

    it('listPrivateChatHistory returns normalized rows for from/to-only payloads', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: {
              total: 1,
              nextCursor: '',
              nextTimestamp: 1_700_000_000_000,
              list: [
                {
                  from: 'idqpeer',
                  to: 'idqself',
                  protocol: '/protocols/simplemsg',
                  encrypt: 'ecdh',
                  fromUserInfo: { chatPubkey: 'peer-chat-key' },
                  content: 'cipher',
                  timestamp: 1_700_000_000_000,
                  pinId: 'pin-from-to-history',
                  replyPin: 'pin-original-order',
                },
              ],
            },
            message: '',
          }),
        }),
      )

      const { listPrivateChatHistory } = await loadPrivateChat()
      const page = await listPrivateChatHistory({
        metaId: 'me',
        otherMetaId: 'peer',
      })

      expect(page.list).toEqual([
        expect.objectContaining({
          fromGlobalMetaId: 'idqpeer',
          toGlobalMetaId: 'idqself',
          encryption: 'ecdh',
          replyPin: 'pin-original-order',
          fromUserInfo: expect.objectContaining({
            chatPublicKey: 'peer-chat-key',
          }),
        }),
      ])
    })

    it('listPrivateChatHomes returns normalized lastMessage for from/to-only payloads', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: {
              list: [
                {
                  metaId: 'peer',
                  globalMetaId: 'peer',
                  lastMessage: {
                    from: 'idqpeer',
                    to: 'idqself',
                    path: 'bc1xxx:/protocols/simplemsg',
                    encrypt: 'ecdh',
                    content: 'cipher',
                    timestamp: 1_700_000_000_000,
                    pinId: 'pin-home-from-to',
                  },
                },
              ],
            },
            message: '',
          }),
        }),
      )

      const { listPrivateChatHomes } = await loadPrivateChat()
      const homes = await listPrivateChatHomes('me')

      expect(homes[0].lastMessage).toEqual(
        expect.objectContaining({
          fromGlobalMetaId: 'idqpeer',
          toGlobalMetaId: 'idqself',
          protocol: 'bc1xxx:/protocols/simplemsg',
          encryption: 'ecdh',
        }),
      )
    })

    it('treats null empty homes and history lists as empty arrays', async () => {
      const fetchMock = vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes('/homes/')
            ? {
                code: 0,
                data: { list: null },
                message: '',
              }
            : {
                code: 0,
                data: {
                  total: 0,
                  nextCursor: '',
                  nextTimestamp: 0,
                  list: null,
                },
                message: '',
              },
      }))
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHistory, listPrivateChatHomes } = await loadPrivateChat()

      await expect(listPrivateChatHomes('wallet-with-no-homes')).resolves.toEqual([])
      await expect(
        listPrivateChatHistory({
          metaId: 'wallet-with-no-history',
          otherMetaId: 'new-peer',
        }),
      ).resolves.toEqual({
        list: [],
        total: 0,
        nextCursor: '',
        nextTimestamp: 0,
      })
    })

    it('falls back to legacy homes route only when canonical route is missing', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ code: 404, data: null, message: 'not found' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 0, data: { list: null }, message: '' }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHomes } = await loadPrivateChat()
      await expect(listPrivateChatHomes('me')).resolves.toEqual([])

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0][0]).toBe('/meta-socket/api/private-chat/homes/me')
      expect(fetchMock.mock.calls[1][0]).toBe('/meta-socket/api/group-chat/chat/homes/me')
    })

    it('falls back to legacy history route when canonical route returns 405', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 405,
          json: async () => ({ code: 405, data: null, message: 'method not allowed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: { total: 0, nextCursor: '', nextTimestamp: 0, list: null },
            message: '',
          }),
        })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHistory } = await loadPrivateChat()
      await expect(
        listPrivateChatHistory({ metaId: 'me', otherMetaId: 'peer', size: 5 }),
      ).resolves.toEqual({
        list: [],
        total: 0,
        nextCursor: '',
        nextTimestamp: 0,
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/meta-socket/api/private-chat/messages?metaId=me&otherMetaId=peer&size=5',
      )
      expect(fetchMock.mock.calls[1][0]).toBe(
        '/meta-socket/api/group-chat/private-chat-list?metaId=me&otherMetaId=peer&size=5',
      )
    })

    it('does not fall back for canonical non-404 failures', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ code: 50001, data: null, message: 'server failed' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHistory, PrivateChatApiError } = await loadPrivateChat()
      let thrown: unknown
      try {
        await listPrivateChatHistory({ metaId: 'me', otherMetaId: 'peer' })
      } catch (error) {
        thrown = error
      }

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(thrown).toBeInstanceOf(PrivateChatApiError)
      expect(thrown).toMatchObject({
        code: 50001,
        message: 'server failed',
      })
    })

    it('throws PrivateChatApiError for non-zero envelopes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ code: 50001, data: null, message: 'private chat failed' }),
        }),
      )

      const { listPrivateChatHistory, PrivateChatApiError } = await loadPrivateChat()
      let thrown: unknown
      try {
        await listPrivateChatHistory({
          metaId: 'me',
          otherMetaId: 'peer',
        })
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(PrivateChatApiError)
      expect(thrown).toMatchObject({
        name: 'PrivateChatApiError',
        code: 50001,
        message: 'private chat failed',
      })
    })

    it('throws PrivateChatApiError when history list contains invalid rows', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: {
              total: 1,
              nextCursor: '',
              nextTimestamp: 1,
              list: [{ fromGlobalMetaId: 'me', toGlobalMetaId: 'peer' }],
            },
            message: '',
          }),
        }),
      )

      const { listPrivateChatHistory, PrivateChatApiError } = await loadPrivateChat()
      let thrown: unknown
      try {
        await listPrivateChatHistory({
          metaId: 'me',
          otherMetaId: 'peer',
        })
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(PrivateChatApiError)
      expect(thrown).toMatchObject({
        code: 0,
        message: 'invalid private chat item',
      })
    })

    it('throws PrivateChatApiError when homes list contains invalid lastMessage', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            data: {
              list: [
                {
                  metaId: 'peer',
                  globalMetaId: 'peer',
                  lastMessage: { fromGlobalMetaId: 'me', toGlobalMetaId: 'peer' },
                },
              ],
            },
            message: '',
          }),
        }),
      )

      const { listPrivateChatHomes, PrivateChatApiError } = await loadPrivateChat()
      let thrown: unknown
      try {
        await listPrivateChatHomes('me')
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(PrivateChatApiError)
      expect(thrown).toMatchObject({
        code: 0,
        message: 'invalid private chat home',
      })
    })
  })

  it('resolvePrivateChatMetaId prefers wallet MVC address and falls back to globalMetaId', async () => {
    const { resolvePrivateChatMetaId } = await loadPrivateChat()
    const identity: WalletIdentity = {
      globalMetaId: 'idqglobal',
      mvcAddress: '1MvcAddress',
      btcAddress: 'bc1btc',
      dogeAddress: 'DDoge',
    }

    expect(resolvePrivateChatMetaId(identity)).toBe('1MvcAddress')
    expect(resolvePrivateChatMetaId({ ...identity, mvcAddress: '' })).toBe('idqglobal')
  })
})
