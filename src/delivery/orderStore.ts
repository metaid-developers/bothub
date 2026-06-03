import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import { normalizeAvatarUrl } from '@/api/userProfile'
import { openDeliveryDb } from '@/delivery/db'
import {
  buildOrderId,
  buildSessionId,
  type BuyerOrder,
  type DeliveryMessageRecord,
  type DeliverySessionRecord,
} from '@/delivery/domain'
import type { ExecutePayAndRequestResult } from '@/order/flow'
import type { PreparedPayAndRequest } from '@/order/payAndRequestStages'
import type { WalletIdentity } from '@/wallet/types'

export interface PersistPendingOrderInput {
  wallet: WalletIdentity
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  result: ExecutePayAndRequestResult
}

export interface PersistFailedToSendOrderInput {
  wallet: WalletIdentity
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  partial: PreparedPayAndRequest
}

function resolveOrderCorrelationId(result: ExecutePayAndRequestResult): string {
  return (result.orderPinId || result.paymentTxid || result.orderReference).trim()
}

function normalizePaymentChain(value: string): BuyerOrder['paymentChain'] {
  const chain = value.trim().toLowerCase()
  if (chain === 'btc' || chain === 'doge' || chain === 'mvc') return chain
  return 'mvc'
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

function abortTransaction(transaction: IDBTransaction): void {
  try {
    transaction.abort()
  } catch {
    // The transaction may already be aborting.
  }
}

async function persistRowsAtomically(
  order: BuyerOrder,
  session: DeliverySessionRecord,
  message: DeliveryMessageRecord,
): Promise<void> {
  const db = await openDeliveryDb()
  const transaction = db.transaction(['orders', 'sessions', 'messages'], 'readwrite')
  const done = transactionDone(transaction)

  try {
    transaction.objectStore('orders').put(order)
    transaction.objectStore('sessions').put(session)
    transaction.objectStore('messages').put(message)
    await done
  } catch (error) {
    abortTransaction(transaction)
    await done.catch(() => undefined)
    throw error
  } finally {
    db.close()
  }
}

export async function persistPendingOrder(
  input: PersistPendingOrderInput,
): Promise<{
  order: BuyerOrder
  session: DeliverySessionRecord
  message: DeliveryMessageRecord
}> {
  const walletGlobalMetaId = input.wallet.globalMetaId.trim()
  const providerGlobalMetaId = input.provider.globalMetaId.trim()
  const providerChatPubkey = input.provider.chatPubkey?.trim() || undefined
  const providerName = input.provider.name?.trim() || undefined
  const providerAvatarUrl = normalizeAvatarUrl(input.provider.avatar?.trim() || undefined)
  const orderCorrelationId = resolveOrderCorrelationId(input.result)
  if (!walletGlobalMetaId) {
    throw new Error('Wallet globalMetaId is required to persist a pending order')
  }
  if (!providerGlobalMetaId) {
    throw new Error('Provider globalMetaId is required to persist a pending order')
  }
  if (!orderCorrelationId) {
    throw new Error('Order correlation id is required to persist a pending order')
  }

  const now = Date.now()
  const sessionId = buildSessionId({
    walletGlobalMetaId,
    providerGlobalMetaId,
    orderCorrelationId,
  })
  const orderId = buildOrderId(walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId)
  const simplemsgPinId = input.result.simplemsgPinId?.trim() || ''
  const messageId = simplemsgPinId || input.result.orderPinId || `${sessionId}:order`

  const order: BuyerOrder = {
    id: orderId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
    providerName,
    providerAvatarUrl,
    serviceId: input.service.id,
    serviceName: input.service.serviceName,
    skillName: input.service.providerSkill || input.service.serviceName,
    outputType: input.service.outputType,
    rawRequest: input.prompt.trim(),
    displaySummary: input.result.displaySummary,
    price: input.service.price,
    currency: input.service.currency,
    settlementKind: input.service.settlementKind,
    paymentChain: normalizePaymentChain(input.service.paymentChain),
    paymentTxid: input.result.paymentTxid,
    paymentCommitTxid: input.result.paymentCommitTxid,
    orderReference: input.result.orderReference,
    orderPinId: input.result.orderPinId,
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
  }

  const session: DeliverySessionRecord = {
    id: sessionId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
    providerName,
    providerAvatarUrl,
    orderCorrelationId,
    serviceId: input.service.id,
    serviceLabel: input.service.displayName || input.service.serviceName,
    status: 'waiting',
    lastMessageId: messageId,
    lastActivityAt: now,
    assetCount: 0,
    unreadCount: 0,
  }

  const message: DeliveryMessageRecord = {
    id: messageId,
    walletGlobalMetaId,
    sessionId,
    peerGlobalMetaId: providerGlobalMetaId,
    peerChatPubkey: providerChatPubkey,
    peerName: providerName,
    peerAvatarUrl: providerAvatarUrl,
    direction: 'outgoing',
    content: input.result.orderPayload,
    rawContent: input.result.orderPayload,
    contentType: 'text/plain',
    encryption: 'plain',
    protocolTag: 'order',
    orderCorrelationId,
    pinId: simplemsgPinId || input.result.orderPinId || undefined,
    timestamp: now,
    decryptStatus: 'plain',
  }

  await persistRowsAtomically(order, session, message)

  return { order, session, message }
}

export async function persistFailedToSendOrder(
  input: PersistFailedToSendOrderInput,
): Promise<{
  order: BuyerOrder
  session: DeliverySessionRecord
  message: DeliveryMessageRecord
}> {
  const walletGlobalMetaId = input.wallet.globalMetaId.trim()
  const providerGlobalMetaId = input.provider.globalMetaId.trim()
  const providerChatPubkey = input.provider.chatPubkey?.trim() || undefined
  const providerName = input.provider.name?.trim() || undefined
  const providerAvatarUrl = normalizeAvatarUrl(input.provider.avatar?.trim() || undefined)
  const orderCorrelationId = (
    input.partial.serviceOrderPinId ||
    input.partial.payment.paymentTxid ||
    input.partial.payment.orderReference
  ).trim()
  if (!walletGlobalMetaId) {
    throw new Error('Wallet globalMetaId is required to persist a failed order')
  }
  if (!providerGlobalMetaId) {
    throw new Error('Provider globalMetaId is required to persist a failed order')
  }
  if (!orderCorrelationId) {
    throw new Error('Order correlation id is required to persist a failed order')
  }

  const now = Date.now()
  const sessionId = buildSessionId({
    walletGlobalMetaId,
    providerGlobalMetaId,
    orderCorrelationId,
  })
  const orderId = buildOrderId(walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId)
  const messageId = `${sessionId}:failed-to-send`

  const order: BuyerOrder = {
    id: orderId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
    providerName,
    providerAvatarUrl,
    serviceId: input.service.id,
    serviceName: input.service.serviceName,
    skillName: input.service.providerSkill || input.service.serviceName,
    outputType: input.service.outputType,
    rawRequest: input.prompt.trim(),
    displaySummary: input.partial.displaySummary,
    price: input.service.price,
    currency: input.service.currency,
    settlementKind: input.service.settlementKind,
    paymentChain: normalizePaymentChain(input.service.paymentChain),
    paymentTxid: input.partial.payment.paymentTxid,
    paymentCommitTxid: input.partial.payment.paymentCommitTxid,
    orderReference: input.partial.payment.orderReference,
    orderPinId: input.partial.serviceOrderPinId || undefined,
    status: 'failed_to_send',
    createdAt: now,
    updatedAt: now,
  }

  const session: DeliverySessionRecord = {
    id: sessionId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
    providerName,
    providerAvatarUrl,
    orderCorrelationId,
    serviceId: input.service.id,
    serviceLabel: input.service.displayName || input.service.serviceName,
    status: 'failed_to_send',
    lastMessageId: messageId,
    lastActivityAt: now,
    assetCount: 0,
    unreadCount: 0,
  }

  const message: DeliveryMessageRecord = {
    id: messageId,
    walletGlobalMetaId,
    sessionId,
    peerGlobalMetaId: providerGlobalMetaId,
    peerChatPubkey: providerChatPubkey,
    peerName: providerName,
    peerAvatarUrl: providerAvatarUrl,
    direction: 'outgoing',
    content: input.partial.orderPayload,
    rawContent: input.partial.orderPayload,
    contentType: 'text/plain',
    encryption: 'plain',
    protocolTag: 'order',
    orderCorrelationId,
    timestamp: now,
    decryptStatus: 'failed',
    decryptError: 'payment succeeded but order message failed',
  }

  await persistRowsAtomically(order, session, message)

  return { order, session, message }
}
