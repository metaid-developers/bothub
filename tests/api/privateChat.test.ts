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

    it('listPrivateChatHomes fetches encoded homes endpoint and unwraps list', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => homesFixture,
      })
      vi.stubGlobal('fetch', fetchMock)

      const { listPrivateChatHomes } = await loadPrivateChat()
      const homes = await listPrivateChatHomes('wallet address/with space')

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/meta-socket/api/group-chat/chat/homes/wallet%20address%2Fwith%20space',
      )
      expect(homes).toHaveLength(1)
      expect(homes[0]).toMatchObject({
        metaId: 'idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z',
        globalMetaId: 'idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z',
      })
      expect(homes[0].lastMessage?.content).toBeTruthy()
    })

    it('listPrivateChatHistory builds query string and preserves pagination fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
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
        '/meta-socket/api/group-chat/private-chat-list?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=peer+id%2Fwith%3F&cursor=&size=5&timestamp=1777322934',
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

    it('throws PrivateChatApiError for non-zero envelopes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
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
