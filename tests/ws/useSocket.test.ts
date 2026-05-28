import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { clearTestSessionStorage } from '../setup'
import {
  DELIVERY_DB_NAME,
  getAssetsForSession,
  getSessionsForWallet,
} from '@/delivery/db'
import { useMessageStore } from '@/delivery/messageStore'
import { WS_SERVER_NOTIFY_PRIVATE_CHAT, type SocketEnvelope } from '@/ws/envelope'
import type { PrivateChatItem } from '@/ws/privateChat'
import { useSocket } from '@/ws/useSocket'
import { decryptIncoming } from '@/delivery/decrypt'

vi.mock('@/delivery/decrypt', () => ({
  decryptIncoming: vi.fn(async ({ content }: { content: string }) => ({
    plaintext: content,
  })),
}))

const SELF = 'idqself'
const PEER = 'idqpeer'
const mockedDecryptIncoming = vi.mocked(decryptIncoming)

function envelope(
  overrides: Partial<PrivateChatItem> = {},
): SocketEnvelope<PrivateChatItem> {
  return {
    M: WS_SERVER_NOTIFY_PRIVATE_CHAT,
    C: 0,
    D: {
      fromGlobalMetaId: PEER,
      toGlobalMetaId: SELF,
      fromUserInfo: { chatPublicKey: 'provider-chat-key' },
      content:
        '[DELIVERY:socket-order] {"result":"Ready","assets":["metafile://socket.png"]}',
      contentType: 'text/plain',
      encryption: 'plain',
      timestamp: 1_700_000_000_000,
      pinId: 'pin-socket-delivery',
      txId: 'tx-socket-delivery',
      index: 0,
      ...overrides,
    },
  }
}

describe('useSocket delivery persistence', () => {
  beforeEach(() => {
    clearTestSessionStorage()
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
    useSocket.setState({
      status: 'disconnected',
      connectedGlobalMetaId: null,
      connectedIdentity: null,
      lastError: null,
      debugLog: [],
    })
    mockedDecryptIncoming.mockResolvedValue({ plaintext: envelope().D.content })
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      value: IDBKeyRange,
      writable: true,
      configurable: true,
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('appends live private chat to memory and persists parsed delivery assets', async () => {
    await useSocket.getState().handleEnvelope(envelope(), SELF)

    expect(useMessageStore.getState().messagesForSession('idqpeer:socket-order', SELF)).toEqual([
      expect.objectContaining({ id: 'pin-socket-delivery' }),
    ])
    expect(await getSessionsForWallet(SELF)).toEqual([
      expect.objectContaining({
        id: `${SELF}:${PEER}:socket-order`,
        status: 'delivered',
        assetCount: 1,
      }),
    ])
    expect(await getAssetsForSession(`${SELF}:${PEER}:socket-order`)).toEqual([
      expect.objectContaining({
        uri: 'metafile://socket.png',
        messageId: 'pin-socket-delivery',
      }),
    ])
  })

  it('keeps the UI message and logs cache errors when live persistence fails', async () => {
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
    ) {
      if (this.name === 'messages') {
        throw new DOMException('Injected message write failure', 'DataError')
      }
      return originalPut.call(this, value)
    })

    await useSocket.getState().handleEnvelope(envelope(), SELF)

    expect(useMessageStore.getState().messagesForSession('idqpeer:socket-order', SELF)).toEqual([
      expect.objectContaining({ id: 'pin-socket-delivery' }),
    ])
    expect(useSocket.getState().debugLog).toEqual([
      expect.stringContaining('[cache] delivery message was not saved'),
    ])
  })

  it('logs conversion failures separately from cache persistence failures', async () => {
    mockedDecryptIncoming.mockRejectedValueOnce(new Error('decrypt exploded'))

    await useSocket.getState().handleEnvelope(envelope(), SELF)

    expect(useMessageStore.getState().messagesForSession('idqpeer:socket-order', SELF)).toEqual(
      [],
    )
    expect(useSocket.getState().debugLog).toEqual([
      expect.stringContaining('[delivery] private chat was not merged'),
    ])
    expect(useSocket.getState().debugLog).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('[cache] delivery message was not saved'),
      ]),
    )
  })
})
