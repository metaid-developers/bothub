import { ecdhEncryptWithSharedSecret } from '@/order/privateChatCrypto'
import type { PayAndRequestMetalet } from '@/order/flow'
import type { WalletIdentity } from '@/wallet/types'

export class DeliveryFollowUpError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'empty_content'
      | 'missing_provider_key'
      | 'missing_wallet'
      | 'broadcast_failed',
  ) {
    super(message)
    this.name = 'DeliveryFollowUpError'
  }
}

export interface SendDeliveryFollowUpInput {
  wallet: WalletIdentity
  providerGlobalMetaId: string
  providerChatPubkey: string
  content: string
  replyPin?: string
  metalet: Pick<PayAndRequestMetalet, 'ecdh' | 'createPin'>
}

export interface SendDeliveryFollowUpResult {
  pinId: string
  encryptedContent: string
}

function extractTransferTxids(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const txids = (result as { txids?: unknown }).txids
  if (!Array.isArray(txids)) return []
  return txids.map((id) => String(id).trim()).filter(Boolean)
}

function resolvePrimaryPinId(result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const direct = (result as { pinId?: unknown }).pinId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  return extractTransferTxids(result)[0] ?? ''
}

function buildPrivateMessagePayload(input: {
  toGlobalMetaId: string
  encryptedContent: string
  replyPin: string
}): string {
  return JSON.stringify({
    to: input.toGlobalMetaId,
    timestamp: Math.floor(Date.now() / 1000),
    content: input.encryptedContent,
    contentType: 'text/plain',
    encrypt: 'ecdh',
    replyPin: input.replyPin,
  })
}

export async function sendDeliveryFollowUp(
  input: SendDeliveryFollowUpInput,
): Promise<SendDeliveryFollowUpResult> {
  const content = input.content.trim()
  if (!content) {
    throw new DeliveryFollowUpError('Message is required', 'empty_content')
  }

  const walletGlobalMetaId = input.wallet.globalMetaId.trim()
  if (!walletGlobalMetaId) {
    throw new DeliveryFollowUpError('Wallet globalMetaId is required', 'missing_wallet')
  }

  const providerGlobalMetaId = input.providerGlobalMetaId.trim()
  const providerChatPubkey = input.providerChatPubkey.trim()
  if (!providerGlobalMetaId || !providerChatPubkey) {
    throw new DeliveryFollowUpError(
      'Provider chat key is unavailable',
      'missing_provider_key',
    )
  }

  const { sharedSecret } = await input.metalet.ecdh({
    externalPubKey: providerChatPubkey,
  })
  const encryptedContent = ecdhEncryptWithSharedSecret(content, sharedSecret)
  const pinResult = await input.metalet.createPin({
    chain: 'mvc',
    dataList: [
      {
        metaidData: {
          operation: 'create',
          path: '/private/chat/simplemsg',
          body: buildPrivateMessagePayload({
            toGlobalMetaId: providerGlobalMetaId,
            encryptedContent,
            replyPin: input.replyPin?.trim() ?? '',
          }),
          contentType: 'application/json',
          encryption: '0',
          version: '1.0.0',
        },
      },
    ],
  })

  const pinId = resolvePrimaryPinId(pinResult)
  if (!pinId) {
    throw new DeliveryFollowUpError(
      'Follow-up broadcast did not return an id',
      'broadcast_failed',
    )
  }

  return { pinId, encryptedContent }
}
