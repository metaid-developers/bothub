import { ecdhDecryptWithSharedSecret } from '@/order/privateChatCrypto'
import * as metalet from '@/wallet/metalet'

export interface DecryptIncomingInput {
  content: string
  protocol?: string
  encrypt?: string
  encryption?: string
  peerChatPubKey?: string
  messageId?: string
}

export interface DecryptIncomingResult {
  plaintext: string
  error?: string
}

function normalizeEncryption(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeProtocol(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function cacheKeyForInput(input: DecryptIncomingInput, content: string): string {
  const id = input.messageId?.trim()
  if (id) return `id:${id}`
  let hash = 0
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0
  }
  return `raw:${content.length}:${hash}`
}

function isPlainPrivateChatContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return true
  return (
    trimmed.startsWith('[ORDER:') ||
    trimmed.startsWith('[ORDER_STATUS:') ||
    trimmed.startsWith('[DELIVERY:') ||
    trimmed.startsWith('[RATING:') ||
    trimmed.startsWith('[REFUND:')
  )
}

function isCiphertextLike(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed || isPlainPrivateChatContent(trimmed)) return false
  if (trimmed.startsWith('U2FsdGVkX1')) return true
  return trimmed.length >= 32 && !/\s/.test(trimmed)
}

const sharedSecretByPeerChatPubKey = new Map<string, string>()
const decryptResultByMessage = new Map<string, DecryptIncomingResult>()

async function sharedSecretForPeer(peerChatPubKey: string): Promise<string> {
  const cached = sharedSecretByPeerChatPubKey.get(peerChatPubKey)
  if (cached) return cached
  const { sharedSecret } = await metalet.ecdh({ externalPubKey: peerChatPubKey })
  sharedSecretByPeerChatPubKey.set(peerChatPubKey, sharedSecret)
  return sharedSecret
}

async function tryEcdhDecrypt(
  content: string,
  peerChatPubKey: string,
): Promise<string | null> {
  const sharedSecret = await sharedSecretForPeer(peerChatPubKey)
  const plain = ecdhDecryptWithSharedSecret(content, sharedSecret)
  return plain && plain !== content ? plain : null
}

/** Decrypt private-chat content; returns raw ciphertext on failure (R6). */
export async function decryptIncoming(
  input: DecryptIncomingInput,
): Promise<DecryptIncomingResult> {
  const content = String(input.content ?? '')
  if (!content) return { plaintext: '' }

  const cacheKey = cacheKeyForInput(input, content)
  const cached = decryptResultByMessage.get(cacheKey)
  if (cached) return { ...cached }

  const encryption = normalizeEncryption(input.encryption ?? input.encrypt)
  const protocol = normalizeProtocol(input.protocol)
  const peerKey = input.peerChatPubKey?.trim() ?? ''
  const isSimplemsg = protocol === '' || protocol.endsWith('/protocols/simplemsg')

  if (encryption !== 'ecdh' && isPlainPrivateChatContent(content)) {
    const result = { plaintext: content }
    decryptResultByMessage.set(cacheKey, result)
    return result
  }

  const shouldTryEcdh =
    peerKey &&
    isSimplemsg &&
    (encryption === 'ecdh' || (encryption === '' && isCiphertextLike(content)))

  if (shouldTryEcdh) {
    try {
      const plain = await tryEcdhDecrypt(content, peerKey)
      if (plain) {
        const result = { plaintext: plain }
        decryptResultByMessage.set(cacheKey, result)
        return result
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const result = { plaintext: content, error: message }
      decryptResultByMessage.set(cacheKey, result)
      return result
    }

    if (encryption === 'ecdh') {
      const result = { plaintext: content, error: 'decryption failed' }
      decryptResultByMessage.set(cacheKey, result)
      return result
    }
  }

  const result = { plaintext: content }
  decryptResultByMessage.set(cacheKey, result)
  return result
}
