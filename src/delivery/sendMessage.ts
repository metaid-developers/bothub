import { ecdhEncryptWithSharedSecret } from '@/order/privateChatCrypto'
import type { PayAndRequestMetalet } from '@/order/flow'
import { resolvePrimaryPinId } from '@/order/pinResult'
import { WalletResponseTimeoutError, withWalletResponseTimeout } from '@/order/walletTimeout'
import type { WalletIdentity } from '@/wallet/types'

const SIMPLEMSG_PATH = '/protocols/simplemsg'

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

function buildPrivateMessagePayload(input: {
  toGlobalMetaId: string
  encryptedContent: string
  replyPin: string
}): string {
  return JSON.stringify({
    to: input.toGlobalMetaId,
    timestamp: Date.now(),
    content: input.encryptedContent,
    contentType: 'text/plain',
    encrypt: 'ecdh',
    replyPin: input.replyPin,
  })
}

function createLocalFollowUpId(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `local-follow-up:${Date.now()}:${random}`
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
  let pinResult: unknown
  try {
    pinResult = await withWalletResponseTimeout(
      input.metalet.createPin({
        chain: 'mvc',
        dataList: [
          {
            metaidData: {
              operation: 'create',
              path: SIMPLEMSG_PATH,
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
      }),
      'Follow-up broadcast timed out waiting for wallet response',
    )
  } catch (err) {
    if (err instanceof WalletResponseTimeoutError) {
      throw new DeliveryFollowUpError(err.message, 'broadcast_failed')
    }
    throw err
  }

  const pinId = resolvePrimaryPinId(pinResult) || createLocalFollowUpId()

  return { pinId, encryptedContent }
}
