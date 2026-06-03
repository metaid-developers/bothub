import { decryptIncoming } from '@/delivery/decrypt'
import {
  persistDeliveryMessage,
  useMessageStore,
  type DeliveryMessage,
} from '@/delivery/messageStore'
import type { PeerProfile } from '@/delivery/peerProfile'
import type { WalletIdentity } from '@/wallet/types'

export interface RetryDecryptPeerMessagesResult {
  attempted: number
  updated: number
}

interface RetryDecryptPeerMessagesInput {
  walletIdentity: WalletIdentity
  peerGlobalMetaId: string
  peerProfile: PeerProfile
  pushDebug?: (line: string) => void
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function isCiphertextLike(value: string): boolean {
  const raw = value.trim()
  if (isPlainPrivateChatContent(raw)) return false
  return raw.startsWith('U2FsdGVkX1') || (raw.length >= 32 && !/\s/.test(raw))
}

function isPlainPrivateChatContent(content: string): boolean {
  return (
    content.startsWith('[ORDER:') ||
    content.startsWith('[ORDER_STATUS:') ||
    content.startsWith('[DELIVERY:') ||
    content.startsWith('[ORDER_END:') ||
    content.startsWith('[NeedsRating:') ||
    content.startsWith('[RATING:') ||
    content.startsWith('[REFUND:')
  )
}

function shouldRetryDecrypt(message: DeliveryMessage): boolean {
  const rawContent = message.rawContent.trim()
  if (!rawContent) return false
  if (message.content !== message.rawContent && !hasText(message.decryptError)) {
    return false
  }

  const hasEncryptedEvidence =
    message.encryption.trim().toLowerCase() === 'ecdh' || isCiphertextLike(rawContent)
  if (!hasEncryptedEvidence) return false

  return true
}

function pushRetryDebug(input: {
  peerGlobalMetaId: string
  detail: unknown
  pushDebug?: (line: string) => void
}): void {
  if (!input.pushDebug) return
  const detail =
    input.detail instanceof Error ? input.detail.message : String(input.detail)
  input.pushDebug(
    `[decrypt] retry failed for ${input.peerGlobalMetaId.slice(0, 8)}...: ${detail}`,
  )
}

export async function retryDecryptPeerMessages(
  input: RetryDecryptPeerMessagesInput,
): Promise<RetryDecryptPeerMessagesResult> {
  const walletGlobalMetaId = input.walletIdentity.globalMetaId.trim()
  const peerGlobalMetaId = input.peerGlobalMetaId.trim()
  const peerChatPubKey = input.peerProfile.chatPubkey?.trim() ?? ''
  if (!walletGlobalMetaId || !peerGlobalMetaId || !peerChatPubKey) {
    return { attempted: 0, updated: 0 }
  }

  const messages = useMessageStore.getState().byPeer[peerGlobalMetaId] ?? []
  let attempted = 0
  let updated = 0

  for (const message of messages) {
    if (!shouldRetryDecrypt(message)) continue

    attempted += 1
    try {
      const result = await decryptIncoming({
        content: message.rawContent,
        protocol: '/protocols/simplemsg',
        encryption: message.encryption,
        peerChatPubKey,
        messageId: message.id,
      })

      if (result.error) {
        pushRetryDebug({
          peerGlobalMetaId,
          detail: result.error,
          pushDebug: input.pushDebug,
        })
        continue
      }
      if (!result.plaintext || result.plaintext === message.rawContent) continue

      const next: DeliveryMessage = {
        ...message,
        content: result.plaintext,
        peerChatPubkey: peerChatPubKey,
        peerName: input.peerProfile.name?.trim() || message.peerName,
        peerAvatarUrl: input.peerProfile.avatarUrl?.trim() || message.peerAvatarUrl,
        decryptError: undefined,
      }
      useMessageStore.getState().append(next)
      await persistDeliveryMessage({ walletGlobalMetaId, message: next })
      updated += 1
    } catch (error) {
      pushRetryDebug({
        peerGlobalMetaId,
        detail: error,
        pushDebug: input.pushDebug,
      })
      continue
    }
  }

  return { attempted, updated }
}
