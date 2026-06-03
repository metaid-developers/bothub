import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import {
  DELIVERY_DB_NAME,
  getMessagesForSession,
  getOrdersForWallet,
  getSessionsForWallet,
} from '@/delivery/db'
import {
  persistFailedToSendOrder,
  persistPendingOrder,
} from '@/delivery/orderStore'
import type { ExecutePayAndRequestResult } from '@/order/flow'
import type { PreparedPayAndRequest } from '@/order/payAndRequestStages'
import type { WalletIdentity } from '@/wallet/types'

const wallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

const provider: ProviderInfo = {
  metaid: 'provider-metaid',
  globalMetaId: 'idqprovider',
  address: '1Provider',
  name: 'Fortune Bot',
  avatar: null,
  chatPubkey: '04' + 'ab'.repeat(64),
}

const service: SkillServiceCore = {
  id: 'svc-1',
  currentPinId: 'svc-current',
  sourceServicePinId: 'svc-source',
  serviceName: 'fortune-reading',
  displayName: 'Fortune Reading',
  description: 'desc',
  serviceIcon: '',
  providerSkill: 'fortune-skill',
  outputType: 'text',
  price: '0',
  currency: 'SPACE',
  settlementKind: 'native',
  paymentChain: 'mvc',
  mrc20Ticker: null,
  mrc20Id: null,
  paymentAddress: '1Payment',
  status: 0,
  operation: 'create',
  disabled: false,
  chainName: 'mvc',
  createdAt: 0,
  updatedAt: 0,
}

function result(overrides: Partial<ExecutePayAndRequestResult> = {}): ExecutePayAndRequestResult {
  return {
    paymentTxid: '',
    paymentCommitTxid: '',
    orderReference: 'order-ref-1',
    orderPinId: 'pin-order-1',
    sessionKey: 'idqprovider:order-ref-1',
    orderPayload:
      '[ORDER] Fortune Reading\n<raw_request>\nTell me my fortune\n</raw_request>\n支付金额 0 SPACE\norder id: order-ref-1\nservice id: svc-1\nskill name: fortune-skill\noutput type: text',
    displaySummary: 'Fortune Reading',
    ...overrides,
  }
}

describe('persistPendingOrder', () => {
  beforeEach(() => {
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
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DELIVERY_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('creates a pending provider order for free requests', async () => {
    const persisted = await persistPendingOrder({
      wallet,
      provider,
      service,
      prompt: 'Tell me my fortune',
      result: result(),
    })

    expect(persisted.order).toMatchObject({
      id: 'idqbuyer:idqprovider:pin-order-1',
      walletGlobalMetaId: wallet.globalMetaId,
      providerGlobalMetaId: provider.globalMetaId,
      providerChatPubkey: provider.chatPubkey,
      status: 'waiting',
      orderReference: 'order-ref-1',
      paymentTxid: '',
      orderPinId: 'pin-order-1',
      rawRequest: 'Tell me my fortune',
    })
    expect(await getOrdersForWallet(wallet.globalMetaId)).toHaveLength(1)
  })

  it('records paid payment and order pin identifiers', async () => {
    const paid = await persistPendingOrder({
      wallet,
      provider,
      service: { ...service, price: '1' },
      prompt: 'Paid fortune',
      result: result({
        paymentTxid: 'paid-txid-1',
        paymentCommitTxid: 'commit-txid-1',
        orderReference: '',
        sessionKey: 'idqprovider:paid-txid-1',
      }),
    })

    expect(paid.order).toMatchObject({
      id: 'idqbuyer:idqprovider:pin-order-1',
      paymentTxid: 'paid-txid-1',
      paymentCommitTxid: 'commit-txid-1',
      orderPinId: 'pin-order-1',
      status: 'waiting',
    })
  })

  it('persists orderPinId as canonical correlation while keeping payment metadata', async () => {
    const persisted = await persistPendingOrder({
      wallet,
      provider,
      service: { ...service, price: '1' },
      prompt: 'Paid fortune',
      result: result({
        paymentTxid: 'pay-tx',
        paymentCommitTxid: 'commit-tx',
        orderReference: 'legacy-ref',
        orderPinId: 'order-pin-i0',
        sessionKey: 'idqprovider:order-pin-i0',
      }),
    })

    expect(persisted.order).toMatchObject({
      id: 'idqbuyer:idqprovider:order-pin-i0',
      paymentTxid: 'pay-tx',
      paymentCommitTxid: 'commit-tx',
      orderReference: 'legacy-ref',
      orderPinId: 'order-pin-i0',
    })
    expect(persisted.session).toMatchObject({
      id: 'idqbuyer:idqprovider:order-pin-i0',
      orderCorrelationId: 'order-pin-i0',
    })
    expect(persisted.message).toMatchObject({
      sessionId: 'idqbuyer:idqprovider:order-pin-i0',
      orderCorrelationId: 'order-pin-i0',
      pinId: 'order-pin-i0',
    })
  })

  it('stores a pending delivery session and outgoing plaintext order message', async () => {
    const persisted = await persistPendingOrder({
      wallet,
      provider,
      service,
      prompt: 'Tell me my fortune',
      result: result(),
    })

    expect(persisted.session).toMatchObject({
      id: 'idqbuyer:idqprovider:pin-order-1',
      walletGlobalMetaId: wallet.globalMetaId,
      providerGlobalMetaId: provider.globalMetaId,
      providerChatPubkey: provider.chatPubkey,
      orderCorrelationId: 'pin-order-1',
      serviceId: service.id,
      serviceLabel: service.displayName,
      status: 'waiting',
      lastMessageId: 'pin-order-1',
    })
    expect(persisted.message).toMatchObject({
      id: 'pin-order-1',
      walletGlobalMetaId: wallet.globalMetaId,
      sessionId: persisted.session.id,
      peerGlobalMetaId: provider.globalMetaId,
      peerChatPubkey: provider.chatPubkey,
      direction: 'outgoing',
      content: result().orderPayload,
      rawContent: result().orderPayload,
      pinId: 'pin-order-1',
      decryptStatus: 'plain',
    })

    expect(await getSessionsForWallet(wallet.globalMetaId)).toHaveLength(1)
    expect(await getMessagesForSession(persisted.session.id)).toHaveLength(1)
  })

  it('rejects invalid identities or missing order correlation before writing rows', async () => {
    await expect(
      persistPendingOrder({
        wallet: { ...wallet, globalMetaId: '   ' },
        provider,
        service,
        prompt: 'Tell me my fortune',
        result: result(),
      }),
    ).rejects.toBeTruthy()
    await expect(
      persistPendingOrder({
        wallet,
        provider: { ...provider, globalMetaId: '   ' },
        service,
        prompt: 'Tell me my fortune',
        result: result(),
      }),
    ).rejects.toBeTruthy()
    await expect(
      persistPendingOrder({
        wallet,
        provider,
        service,
        prompt: 'Tell me my fortune',
        result: result({
          orderReference: '',
          paymentTxid: '',
          orderPinId: '',
          sessionKey: 'idqprovider:',
        }),
      }),
    ).rejects.toBeTruthy()

    expect(await getOrdersForWallet(wallet.globalMetaId)).toEqual([])
    expect(await getSessionsForWallet(wallet.globalMetaId)).toEqual([])
  })

  it('does not leave partial rows when the transaction fails mid-write', async () => {
    let putCount = 0
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
    ) {
      putCount += 1
      if (putCount === 3) {
        throw new DOMException('Injected put failure', 'DataError')
      }
      return originalPut.call(this, value)
    })

    await expect(
      persistPendingOrder({
        wallet,
        provider,
        service,
        prompt: 'Tell me my fortune',
        result: result(),
      }),
    ).rejects.toBeTruthy()

    expect(await getOrdersForWallet(wallet.globalMetaId)).toEqual([])
    expect(await getSessionsForWallet(wallet.globalMetaId)).toEqual([])
    expect(await getMessagesForSession('idqbuyer:idqprovider:order-ref-1')).toEqual([])
  })

  it('stores a recoverable failed_to_send order when payment succeeded but broadcast failed', async () => {
    const partial: PreparedPayAndRequest = {
      service: { ...service, price: '1' },
      provider,
      prompt: 'Paid fortune',
      payment: {
        paymentTxid: 'paid-txid-1',
        paymentCommitTxid: 'commit-txid-1',
        orderReference: '',
      },
      orderPayload:
        '[ORDER] Paid fortune\n<raw_request>\nPaid fortune\n</raw_request>\ntxid: paid-txid-1\nservice id: svc-1',
      encryptedContent: 'ciphertext',
      simplemsgBody: '{"content":"ciphertext"}',
      sessionKey: 'idqprovider:paid-txid-1',
      displaySummary: 'Paid fortune',
    }

    const persisted = await persistFailedToSendOrder({
      wallet,
      provider,
      service: { ...service, price: '1' },
      prompt: 'Paid fortune',
      partial,
    })

    expect(persisted.order).toMatchObject({
      id: 'idqbuyer:idqprovider:paid-txid-1',
      paymentTxid: 'paid-txid-1',
      paymentCommitTxid: 'commit-txid-1',
      orderReference: '',
      orderPinId: undefined,
      rawRequest: 'Paid fortune',
      displaySummary: 'Paid fortune',
      providerChatPubkey: provider.chatPubkey,
      status: 'failed_to_send',
    })
    expect(persisted.session).toMatchObject({
      id: 'idqbuyer:idqprovider:paid-txid-1',
      status: 'failed_to_send',
      orderCorrelationId: 'paid-txid-1',
      providerChatPubkey: provider.chatPubkey,
    })
    expect(persisted.message).toMatchObject({
      id: 'idqbuyer:idqprovider:paid-txid-1:failed-to-send',
      content: partial.orderPayload,
      rawContent: partial.orderPayload,
      orderCorrelationId: 'paid-txid-1',
      decryptStatus: 'failed',
      decryptError: 'payment succeeded but order message failed',
    })

    expect(await getOrdersForWallet(wallet.globalMetaId)).toHaveLength(1)
    expect(await getSessionsForWallet(wallet.globalMetaId)).toHaveLength(1)
    expect(await getMessagesForSession(persisted.session.id)).toHaveLength(1)
  })
})
