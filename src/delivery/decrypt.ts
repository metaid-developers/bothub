import { ecdhDecryptWithSharedSecret } from '@/order/privateChatCrypto'
import * as metalet from '@/wallet/metalet'

export interface DecryptIncomingInput {
  content: string
  encryption?: string
  peerChatPubKey?: string
}

export interface DecryptIncomingResult {
  plaintext: string
  error?: string
}

function normalizeEncryption(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

async function tryEcdhDecrypt(
  content: string,
  peerChatPubKey: string,
): Promise<string | null> {
  const { sharedSecret } = await metalet.ecdh({ externalPubKey: peerChatPubKey })
  const plain = ecdhDecryptWithSharedSecret(content, sharedSecret)
  return plain && plain !== content ? plain : null
}

async function tryEciesDecrypt(content: string): Promise<string | null> {
  const { message } = await metalet.eciesDecrypt({ encrypted: content })
  const plain = String(message ?? '').trim()
  return plain || null
}

/** Decrypt private-chat content; returns raw ciphertext on failure (R6). */
export async function decryptIncoming(
  input: DecryptIncomingInput,
): Promise<DecryptIncomingResult> {
  const content = String(input.content ?? '')
  if (!content) return { plaintext: '' }

  const encryption = normalizeEncryption(input.encryption)
  const peerKey = input.peerChatPubKey?.trim() ?? ''

  if ((encryption === 'ecdh' || encryption === '') && peerKey) {
    try {
      const plain = await tryEcdhDecrypt(content, peerKey)
      if (plain) return { plaintext: plain }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (encryption === 'ecdh') {
        return { plaintext: content, error: message }
      }
    }
  }

  try {
    const plain = await tryEciesDecrypt(content)
    if (plain) return { plaintext: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { plaintext: content, error: message }
  }

  return { plaintext: content, error: 'decryption failed' }
}
