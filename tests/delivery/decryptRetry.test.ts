import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { clearTestSessionStorage } from '../setup'
import { DELIVERY_DB_NAME, getMessagesForSession } from '@/delivery/db'
import { buildSessionId } from '@/delivery/domain'
import { decryptIncoming } from '@/delivery/decrypt'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
import {
  persistDeliveryMessage,
  useMessageStore,
  type DeliveryMessage,
} from '@/delivery/messageStore'
import { buildOrderPayload } from '@/order/buildOrderPayload'
import type { WalletIdentity } from '@/wallet/types'

vi.mock('@/delivery/decrypt', () => ({
  decryptIncoming: vi.fn(),
}))

const SELF = 'idqself'
const PEER = 'idqprovider'
const RAW_CIPHERTEXT = 'U2FsdGVkX1+ciphertext'
const PROVIDER_AVATAR_URL = 'https://cdn.example/provider.png'
const wallet: WalletIdentity = {
  globalMetaId: SELF,
  mvcAddress: '1SelfMvcAddress',
  btcAddress: 'bc1self',
  dogeAddress: 'Dself',
}

function encryptedMessage(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'pin-encrypted',
    peerGlobalMetaId: PEER,
    fromGlobalMetaId: PEER,
    toGlobalMetaId: SELF,
    content: RAW_CIPHERTEXT,
    rawContent: RAW_CIPHERTEXT,
    encryption: 'ecdh',
    contentType: 'text/plain',
    timestamp: 1,
    pinId: 'pin-encrypted',
    decryptError: 'missing key',
    ...overrides,
  }
}

async function persistAndHydrate(message: DeliveryMessage): Promise<void> {
  await persistDeliveryMessage({ walletGlobalMetaId: SELF, message })
  await useMessageStore.getState().hydrateFromDb(SELF)
}

async function persistAllAndHydrate(messages: DeliveryMessage[]): Promise<void> {
  for (const message of messages) {
    await persistDeliveryMessage({ walletGlobalMetaId: SELF, message })
  }
  await useMessageStore.getState().hydrateFromDb(SELF)
}

async function deleteDeliveryDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

const mockedDecryptIncoming = vi.mocked(decryptIncoming)

describe('decryptRetry', () => {
  beforeEach(() => {
    clearTestSessionStorage()
    useMessageStore.setState({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,
    })
    mockedDecryptIncoming.mockReset()
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
    await deleteDeliveryDb()
  })

  it('retries encrypted peer messages after profile chat key hydration', async () => {
    await persistAndHydrate(encryptedMessage())
    mockedDecryptIncoming.mockResolvedValueOnce({
      plaintext: 'decrypted provider reply',
    })

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: {
        chatPubkey: 'provider-chat-key',
        name: 'Provider Bot',
        avatarUrl: PROVIDER_AVATAR_URL,
      },
    })

    expect(result).toEqual({ attempted: 1, updated: 1 })
    expect(mockedDecryptIncoming).toHaveBeenCalledWith({
      content: RAW_CIPHERTEXT,
      protocol: '/protocols/simplemsg',
      encryption: 'ecdh',
      peerChatPubKey: 'provider-chat-key',
      messageId: 'pin-encrypted',
    })
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-encrypted',
        content: 'decrypted provider reply',
        rawContent: RAW_CIPHERTEXT,
        peerChatPubkey: 'provider-chat-key',
        peerName: 'Provider Bot',
        peerAvatarUrl: PROVIDER_AVATAR_URL,
      }),
    ])
    expect(
      useMessageStore.getState().messagesForSession(PEER, SELF)[0]?.decryptError,
    ).toBeUndefined()

    const sessionId = buildSessionId({
      walletGlobalMetaId: SELF,
      providerGlobalMetaId: PEER,
    })
    const records = await getMessagesForSession(sessionId)
    expect(records).toEqual([
      expect.objectContaining({
        id: 'pin-encrypted',
        content: 'decrypted provider reply',
        rawContent: RAW_CIPHERTEXT,
        peerChatPubkey: 'provider-chat-key',
        peerName: 'Provider Bot',
        peerAvatarUrl: PROVIDER_AVATAR_URL,
        decryptStatus: 'decrypted',
      }),
    ])
    expect(records[0]?.decryptError).toBeUndefined()
  })

  it('skips retry when the hydrated profile has no chat key', async () => {
    await persistAndHydrate(encryptedMessage())

    await expect(
      retryDecryptPeerMessages({
        walletIdentity: wallet,
        peerGlobalMetaId: PEER,
        peerProfile: { name: 'Provider Bot' },
      }),
    ).resolves.toEqual({ attempted: 0, updated: 0 })

    expect(mockedDecryptIncoming).not.toHaveBeenCalled()
  })

  it('does not retry plain messages', async () => {
    await persistAndHydrate(
      encryptedMessage({
        content: 'plain provider reply',
        rawContent: 'plain provider reply',
        encryption: 'plain',
        decryptError: undefined,
      }),
    )

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
    })

    expect(result).toEqual({ attempted: 0, updated: 0 })
    expect(mockedDecryptIncoming).not.toHaveBeenCalled()
  })

  it('does not retry plain failed outgoing order rows without encrypted evidence', async () => {
    const orderPayload = buildOrderPayload({
      displayText: 'Plain failed order',
      rawRequest: 'Please handle this request',
      price: '0',
      currency: 'SPACE',
      orderReference: 'plain-failed-order',
      serviceId: 'svc-plain-failed-order',
      skillName: 'plain-failed-order',
      outputType: 'text',
    })
    await persistAndHydrate(
      encryptedMessage({
        id: 'pin-plain-failed-order',
        fromGlobalMetaId: SELF,
        toGlobalMetaId: PEER,
        content: orderPayload,
        rawContent: orderPayload,
        encryption: 'plain',
        decryptError: 'send failed before broadcast',
        pinId: 'pin-plain-failed-order',
      }),
    )

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
    })

    expect(result).toEqual({ attempted: 0, updated: 0 })
    expect(mockedDecryptIncoming).not.toHaveBeenCalled()
  })

  it.each([
    ['DELIVERY', '[DELIVERY:order]{"result":"Ready","status":"delivered"}'],
    ['ORDER_STATUS', '[ORDER_STATUS:order]{"status":"Working","step":"queued"}'],
    ['ORDER_END', '[ORDER_END:order]{"status":"Completed","done":true}'],
    ['NeedsRating', '[NeedsRating:order]{"status":"Delivered","rating":false}'],
  ])(
    'does not retry compact %s plaintext protocol rows without encrypted evidence',
    async (_tag, payload) => {
      await persistAndHydrate(
        encryptedMessage({
          id: `pin-compact-plain-${String(_tag).toLowerCase()}`,
          content: payload,
          rawContent: payload,
          encryption: 'plain',
          decryptError: 'previous delivery merge failed',
          pinId: `pin-compact-plain-${String(_tag).toLowerCase()}`,
        }),
      )

      const result = await retryDecryptPeerMessages({
        walletIdentity: wallet,
        peerGlobalMetaId: PEER,
        peerProfile: { chatPubkey: 'provider-chat-key' },
      })

      expect(result).toEqual({ attempted: 0, updated: 0 })
      expect(mockedDecryptIncoming).not.toHaveBeenCalled()
    },
  )

  it('does not retry already decrypted rows', async () => {
    await persistAndHydrate(
      encryptedMessage({
        content: 'already decrypted provider reply',
        rawContent: RAW_CIPHERTEXT,
        decryptError: undefined,
      }),
    )

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
    })

    expect(result).toEqual({ attempted: 0, updated: 0 })
    expect(mockedDecryptIncoming).not.toHaveBeenCalled()
  })

  it('keeps ciphertext and records debug when decrypt returns an error', async () => {
    const debugLines: string[] = []
    await persistAndHydrate(encryptedMessage())
    mockedDecryptIncoming.mockResolvedValueOnce({
      plaintext: RAW_CIPHERTEXT,
      error: 'wallet ecdh failed',
    })

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
      pushDebug: (line) => debugLines.push(line),
    })

    expect(result).toEqual({ attempted: 1, updated: 0 })
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-encrypted',
        content: RAW_CIPHERTEXT,
        rawContent: RAW_CIPHERTEXT,
        decryptError: 'missing key',
      }),
    ])
    expect(debugLines).toEqual([
      '[decrypt] retry failed for idqprovi...: wallet ecdh failed',
    ])
  })

  it('keeps ciphertext and records debug when decrypt throws', async () => {
    const debugLines: string[] = []
    await persistAndHydrate(encryptedMessage())
    mockedDecryptIncoming.mockRejectedValueOnce(new Error('wallet rejected ecdh'))

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
      pushDebug: (line) => debugLines.push(line),
    })

    expect(result).toEqual({ attempted: 1, updated: 0 })
    expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([
      expect.objectContaining({
        id: 'pin-encrypted',
        content: RAW_CIPHERTEXT,
        rawContent: RAW_CIPHERTEXT,
        decryptError: 'missing key',
      }),
    ])
    expect(debugLines).toEqual([
      '[decrypt] retry failed for idqprovi...: wallet rejected ecdh',
    ])
  })

  it('stops retrying the peer after the first decrypt error in a pass', async () => {
    const debugLines: string[] = []
    await persistAllAndHydrate([
      encryptedMessage({
        id: 'pin-encrypted-1',
        pinId: 'pin-encrypted-1',
        timestamp: 1,
        rawContent: 'U2FsdGVkX1+ciphertext-1',
        content: 'U2FsdGVkX1+ciphertext-1',
      }),
      encryptedMessage({
        id: 'pin-encrypted-2',
        pinId: 'pin-encrypted-2',
        timestamp: 2,
        rawContent: 'U2FsdGVkX1+ciphertext-2',
        content: 'U2FsdGVkX1+ciphertext-2',
      }),
    ])
    mockedDecryptIncoming.mockResolvedValueOnce({
      plaintext: 'U2FsdGVkX1+ciphertext-1',
      error: 'wallet ecdh failed',
    })

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
      pushDebug: (line) => debugLines.push(line),
    })

    expect(result).toEqual({ attempted: 1, updated: 0 })
    expect(mockedDecryptIncoming).toHaveBeenCalledTimes(1)
    expect(debugLines).toEqual([
      '[decrypt] retry failed for idqprovi...: wallet ecdh failed',
    ])
  })

  it('stops retrying the peer after the first thrown decrypt error in a pass', async () => {
    const debugLines: string[] = []
    await persistAllAndHydrate([
      encryptedMessage({
        id: 'pin-encrypted-throw-1',
        pinId: 'pin-encrypted-throw-1',
        timestamp: 1,
        rawContent: 'U2FsdGVkX1+throw-ciphertext-1',
        content: 'U2FsdGVkX1+throw-ciphertext-1',
      }),
      encryptedMessage({
        id: 'pin-encrypted-throw-2',
        pinId: 'pin-encrypted-throw-2',
        timestamp: 2,
        rawContent: 'U2FsdGVkX1+throw-ciphertext-2',
        content: 'U2FsdGVkX1+throw-ciphertext-2',
      }),
    ])
    mockedDecryptIncoming.mockRejectedValueOnce(new Error('wallet rejected ecdh'))

    const result = await retryDecryptPeerMessages({
      walletIdentity: wallet,
      peerGlobalMetaId: PEER,
      peerProfile: { chatPubkey: 'provider-chat-key' },
      pushDebug: (line) => debugLines.push(line),
    })

    expect(result).toEqual({ attempted: 1, updated: 0 })
    expect(mockedDecryptIncoming).toHaveBeenCalledTimes(1)
    expect(debugLines).toEqual([
      '[decrypt] retry failed for idqprovi...: wallet rejected ecdh',
    ])
  })
})
