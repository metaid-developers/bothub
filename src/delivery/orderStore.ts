import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import { openDeliveryDb } from '@/delivery/db'
import {
  buildOrderId,
  buildSessionId,
  type BuyerOrder,
  type DeliveryMessageRecord,
  type DeliverySessionRecord,
} from '@/delivery/domain'
import type { ExecutePayAndRequestResult } from '@/order/flow'
import type { WalletIdentity } from '@/wallet/types'

export interface PersistPendingOrderInput {
  wallet: WalletIdentity
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  result: ExecutePayAndRequestResult
}

function resolveOrderCorrelationId(result: ExecutePayAndRequestResult): string {
  return (result.paymentTxid || result.orderReference).trim()
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
  const messageId = input.result.orderPinId || `${sessionId}:order`

  const order: BuyerOrder = {
    id: orderId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
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
    status: 'pending_provider',
    createdAt: now,
    updatedAt: now,
  }

  const session: DeliverySessionRecord = {
    id: sessionId,
    walletGlobalMetaId,
    providerGlobalMetaId,
    providerChatPubkey,
    orderCorrelationId,
    serviceId: input.service.id,
    serviceLabel: input.service.displayName || input.service.serviceName,
    status: 'pending',
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
    direction: 'outgoing',
    content: input.result.orderPayload,
    rawContent: input.result.orderPayload,
    contentType: 'text/plain',
    encryption: 'plain',
    protocolTag: 'order',
    orderCorrelationId,
    pinId: input.result.orderPinId,
    timestamp: now,
    decryptStatus: 'plain',
  }

  await persistRowsAtomically(order, session, message)

  return { order, session, message }
}
