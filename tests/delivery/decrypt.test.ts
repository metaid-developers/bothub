import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptIncoming } from '@/delivery/decrypt'
import { ecdhEncryptWithSharedSecret } from '@/order/privateChatCrypto'
import * as metalet from '@/wallet/metalet'

vi.mock('@/wallet/metalet', () => ({
  ecdh: vi.fn(),
  eciesDecrypt: vi.fn(),
}))

const mockedEcdh = vi.mocked(metalet.ecdh)
const mockedEciesDecrypt = vi.mocked(metalet.eciesDecrypt)

describe('decryptIncoming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedEcdh.mockResolvedValue({ sharedSecret: 'shared-secret' })
    mockedEciesDecrypt.mockResolvedValue({ message: 'ecies plain' })
  })

  it('decrypts standard private simplemsg through ECDH without ECIES fallback', async () => {
    const content = ecdhEncryptWithSharedSecret('hello provider', 'shared-secret')

    const result = await decryptIncoming({
      content,
      protocol: '/protocols/simplemsg',
      encrypt: 'ecdh',
      peerChatPubKey: 'peer-chat-key',
      messageId: 'pin-ecdh-simplemsg',
    })

    expect(result).toEqual({ plaintext: 'hello provider' })
    expect(mockedEcdh).toHaveBeenCalledWith({ externalPubKey: 'peer-chat-key' })
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })

  it('returns ciphertext on ECDH failure without prompting ECIES', async () => {
    mockedEcdh.mockRejectedValueOnce(new Error('wallet ecdh failed'))

    const result = await decryptIncoming({
      content: 'U2FsdGVkX1+not-decryptable',
      protocol: '/protocols/simplemsg',
      encryption: 'ecdh',
      peerChatPubKey: 'peer-chat-key-failure',
      messageId: 'pin-ecdh-failure',
    })

    expect(result).toEqual({
      plaintext: 'U2FsdGVkX1+not-decryptable',
      error: 'wallet ecdh failed',
    })
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })

  it('treats plain order/status/delivery content as plain without wallet decrypt APIs', async () => {
    const result = await decryptIncoming({
      content: '[ORDER_STATUS:abc] Working',
      protocol: '/protocols/simplemsg',
      messageId: 'pin-plain-status',
    })

    expect(result).toEqual({ plaintext: '[ORDER_STATUS:abc] Working' })
    expect(mockedEcdh).not.toHaveBeenCalled()
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })

  it('does not reattempt a failed decrypt for the same message id', async () => {
    mockedEcdh.mockRejectedValue(new Error('wallet ecdh failed once'))

    const input = {
      content: 'U2FsdGVkX1+same-failed-message',
      protocol: '/protocols/simplemsg',
      encrypt: 'ecdh',
      peerChatPubKey: 'peer-chat-key-repeat-failure',
      messageId: 'pin-repeat-failure',
    }

    await expect(decryptIncoming(input)).resolves.toEqual({
      plaintext: input.content,
      error: 'wallet ecdh failed once',
    })
    await expect(decryptIncoming(input)).resolves.toEqual({
      plaintext: input.content,
      error: 'wallet ecdh failed once',
    })
    expect(mockedEcdh).toHaveBeenCalledTimes(1)
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })

  it('routes both encrypt and encryption ECDH markers to ECDH', async () => {
    const first = ecdhEncryptWithSharedSecret('via encrypt', 'shared-secret')
    const second = ecdhEncryptWithSharedSecret('via encryption', 'shared-secret')

    await expect(
      decryptIncoming({
        content: first,
        protocol: '/protocols/simplemsg',
        encrypt: 'ecdh',
        peerChatPubKey: 'peer-chat-key-encrypt-field',
        messageId: 'pin-encrypt-field',
      }),
    ).resolves.toEqual({ plaintext: 'via encrypt' })
    await expect(
      decryptIncoming({
        content: second,
        protocol: '/protocols/simplemsg',
        encryption: 'ecdh',
        peerChatPubKey: 'peer-chat-key-encryption-field',
        messageId: 'pin-encryption-field',
      }),
    ).resolves.toEqual({ plaintext: 'via encryption' })

    expect(mockedEcdh).toHaveBeenCalledTimes(2)
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })

  it('treats address-prefixed simplemsg protocol as ECDH simplemsg', async () => {
    const content = ecdhEncryptWithSharedSecret('prefixed protocol', 'shared-secret')

    const result = await decryptIncoming({
      content,
      protocol: 'bc1xxx:/protocols/simplemsg',
      encrypt: 'ecdh',
      peerChatPubKey: 'peer-chat-key-prefixed-protocol',
      messageId: 'pin-prefixed-protocol',
    })

    expect(result).toEqual({ plaintext: 'prefixed protocol' })
    expect(mockedEcdh).toHaveBeenCalledWith({
      externalPubKey: 'peer-chat-key-prefixed-protocol',
    })
    expect(mockedEciesDecrypt).not.toHaveBeenCalled()
  })
})
