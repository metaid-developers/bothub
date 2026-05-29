import { ecdhEncryptWithSharedSecret } from '@/order/privateChatCrypto'
import type { PayAndRequestMetalet } from '@/order/flow'
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

function collectTxidLikeStrings(value: unknown, out: string[] = []): string[] {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) out.push(item.trim())
      else collectTxidLikeStrings(item, out)
    }
    return out
  }

  const record = value as Record<string, unknown>
  for (const key of ['txids', 'txIds', 'txid', 'txId', 'transactionId', 'hash']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) out.push(candidate.trim())
    else if (Array.isArray(candidate)) collectTxidLikeStrings(candidate, out)
  }
  for (const key of ['data', 'result', 'raw', 'payload']) {
    collectTxidLikeStrings(record[key], out)
  }
  return out
}

function resolvePrimaryPinId(result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const direct = (result as { pinId?: unknown }).pinId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  return collectTxidLikeStrings(result)[0] ?? ''
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
