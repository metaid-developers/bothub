import { describe, expect, it, vi } from 'vitest'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import {
  buildDeliveryOrderPath,
  buildDeliverySessionPath,
  executePayAndRequest,
  generateRandomHex,
  PayAndRequestBroadcastError,
  PayAndRequestError,
} from '@/order/flow'
import {
  CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS,
  ECDH_WALLET_RESPONSE_TIMEOUT_MS,
} from '@/order/walletTimeout'
import { getLastCreatePinDiagnostic } from '@/order/createPinDiagnostics'
import { clearTestSessionStorage } from '../setup'

const provider: ProviderInfo = {
  metaid: 'provider-metaid',
  globalMetaId: 'idq1providerglobal001',
  address: '1ProviderAddress',
  name: 'Fortune Bot',
  avatar: null,
  chatPubkey: '04' + 'ab'.repeat(64),
}

const paidService: SkillServiceCore = {
  id: 'pin-paid-001',
  currentPinId: 'pin-paid-001',
  sourceServicePinId: 'pin-paid-create',
  serviceName: 'paid-service',
  displayName: 'Paid Service',
  description: 'desc',
  serviceIcon: '',
  providerSkill: 'paid-skill',
  outputType: 'text',
  price: '1',
  currency: 'SPACE',
  settlementKind: 'native',
  paymentChain: 'mvc',
  mrc20Ticker: null,
  mrc20Id: null,
  paymentAddress: '1PaymentAddressExample',
  status: 0,
  operation: 'create',
  disabled: false,
  chainName: 'mvc',
  createdAt: 0,
  updatedAt: 0,
}

const freeService: SkillServiceCore = {
  ...paidService,
  id: 'pin-free-001',
  currentPinId: 'pin-free-001',
  price: '0',
}

const wallet = {
  globalMetaId: 'idq1buyerglobal001',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

const OLD_CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS = 90_000

describe('Delivery route helpers', () => {
  it('builds an order-centered Delivery URL', () => {
    expect(buildDeliveryOrderPath('idqbuyer:idqprovider:order-ref-1')).toBe(
      '/delivery?order=idqbuyer%3Aidqprovider%3Aorder-ref-1',
    )
  })

  it('keeps the session Delivery URL helper compatible', () => {
    expect(buildDeliverySessionPath('idqprovider:order-ref-1')).toBe(
      '/delivery?session=idqprovider%3Aorder-ref-1',
    )
  })
})

describe('executePayAndRequest', () => {
  it('posts orders as standard simplemsg pins with millisecond timestamps', async () => {
    const now = 1_764_321_987_654
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const paymentTxid = 'e'.repeat(64)
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-standard' })
      .mockResolvedValueOnce({ pinId: 'pin-order-standard' })

    await executePayAndRequest({
      service: paidService,
      provider,
      prompt: 'Please deliver my standard simplemsg order.',
      wallet,
      metalet: {
        transfer: vi.fn().mockResolvedValue({ txids: [paymentTxid] }),
        ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'aa'.repeat(32) }),
        createPin,
      },
    })

    expect(createPin).toHaveBeenCalledTimes(2)
    const pinArgs = createPin.mock.calls[1][0] as {
      dataList: Array<{
        metaidData: {
          path: string
          body: string
          contentType: string
          encryption: string
        }
      }>
    }
    const metaidData = pinArgs.dataList[0].metaidData
    expect(metaidData.path).toBe('/protocols/simplemsg')
    expect(metaidData.contentType).toBe('application/json')
    expect(metaidData.encryption).toBe('0')
    const body = JSON.parse(metaidData.body) as {
      to: string
      encrypt: string
      contentType: string
      timestamp: number
    }
    expect(body.to).toBe(provider.globalMetaId)
    expect(body.encrypt).toBe('ecdh')
    expect(body.contentType).toBe('text/plain')
    expect(body.timestamp).toBe(now)
    expect(body.timestamp).toBeGreaterThan(10_000_000_000)
  })

  it('rejects empty prompt', async () => {
    await expect(
      executePayAndRequest({
        service: paidService,
        provider,
        prompt: '   ',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'invalid_prompt' } satisfies Partial<PayAndRequestError>)
  })

  it('happy path: paid native order', async () => {
    const paymentTxid = 'f'.repeat(64)
    const transfer = vi.fn().mockResolvedValue({ txids: [paymentTxid] })
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'aa'.repeat(32) })
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-pin-001', txids: ['service-order-txid'] })
      .mockResolvedValueOnce({ pinId: 'simplemsg-pin-001', txids: [paymentTxid] })

    const result = await executePayAndRequest({
      service: paidService,
      provider,
      prompt: 'Please deliver my fortune reading.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).toHaveBeenCalledOnce()
    expect(transfer).toHaveBeenCalledWith({
      tasks: [
        {
          chain: paidService.paymentChain,
          currency: paidService.currency,
          receivers: [
            {
              address: paidService.paymentAddress,
              amount: '100000000',
            },
          ],
        },
      ],
    })
    expect(transfer.mock.invocationCallOrder[0]).toBeLessThan(
      ecdh.mock.invocationCallOrder[0],
    )
    expect(ecdh.mock.invocationCallOrder[0]).toBeLessThan(
      createPin.mock.invocationCallOrder[0],
    )
    expect(createPin.mock.invocationCallOrder[0]).toBeLessThan(
      createPin.mock.invocationCallOrder[1],
    )
    expect(ecdh).toHaveBeenCalledWith({ externalPubKey: provider.chatPubkey })
    expect(createPin).toHaveBeenCalledTimes(2)
    const serviceOrderArgs = createPin.mock.calls[0][0] as {
      chain: string
      dataList: Array<{ metaidData: { path: string; body: string; contentType: string } }>
    }
    expect(serviceOrderArgs.chain).toBe('mvc')
    expect(serviceOrderArgs.dataList[0].metaidData.path).toBe('/protocols/skill-service-order')
    expect(serviceOrderArgs.dataList[0].metaidData.contentType).toBe('application/json')
    expect(JSON.parse(serviceOrderArgs.dataList[0].metaidData.body)).toEqual({
      servicePinId: paidService.currentPinId,
      paymentTxid,
      price: paidService.price,
      currency: paidService.currency,
      settlementKind: paidService.settlementKind,
      metadata: '',
    })
    expect(serviceOrderArgs.dataList[0].metaidData.body).not.toContain('orderId')
    const pinArgs = createPin.mock.calls[1][0] as {
      chain: string
      dataList: Array<{ metaidData: { path: string; body: string } }>
    }
    expect(pinArgs.chain).toBe('mvc')
    expect(pinArgs.dataList[0].metaidData.path).toBe('/protocols/simplemsg')
    const body = JSON.parse(pinArgs.dataList[0].metaidData.body) as {
      to: string
      encrypt: string
      content: string
    }
    expect(body.to).toBe(provider.globalMetaId)
    expect(body.encrypt).toBe('ecdh')
    expect(body.content).toBeTruthy()

    expect(result.paymentTxid).toBe(paymentTxid)
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe('')
    expect(result.orderPinId).toBe('service-order-pin-001')
    expect(result.simplemsgPinId).toBe('simplemsg-pin-001')
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:service-order-pin-001`)
    expect(result.orderPayload).toContain(`txid: ${paymentTxid}`)
    expect(result.orderPayload).toContain('order pin id: service-order-pin-001')
    expect(result.displaySummary).toBe('Please deliver my fortune reading.')
  })

  it('happy path: free order skips transfer and uses order reference', async () => {
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-free-pin' })
      .mockResolvedValueOnce({ pinId: 'simplemsg-free-pin' })

    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0a)
      }
      return array
    })

    const result = await executePayAndRequest({
      service: freeService,
      provider,
      prompt: 'Free reading please.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).not.toHaveBeenCalled()
    expect(ecdh).toHaveBeenCalledWith({ externalPubKey: provider.chatPubkey })
    expect(createPin).toHaveBeenCalledTimes(2)
    expect(ecdh.mock.invocationCallOrder[0]).toBeLessThan(
      createPin.mock.invocationCallOrder[0],
    )
    const serviceOrderArgs = createPin.mock.calls[0][0] as {
      dataList: Array<{ metaidData: { path: string; body: string } }>
    }
    expect(serviceOrderArgs.dataList[0].metaidData.path).toBe('/protocols/skill-service-order')
    expect(JSON.parse(serviceOrderArgs.dataList[0].metaidData.body)).toMatchObject({
      servicePinId: freeService.currentPinId,
      paymentTxid: '',
      price: freeService.price,
      currency: freeService.currency,
      settlementKind: freeService.settlementKind,
      metadata: '',
    })
    expect(serviceOrderArgs.dataList[0].metaidData.body).not.toContain('orderId')
    const pinArgs = createPin.mock.calls[1][0] as {
      dataList: Array<{ metaidData: { path: string; body: string } }>
    }
    expect(pinArgs.dataList[0].metaidData.path).toBe('/protocols/simplemsg')
    const body = JSON.parse(pinArgs.dataList[0].metaidData.body) as {
      to: string
      encrypt: string
      content: string
    }
    expect(body.to).toBe(provider.globalMetaId)
    expect(body.encrypt).toBe('ecdh')
    expect(body.content).toBeTruthy()
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(generateRandomHex(32))
    expect(result.orderPinId).toBe('service-order-free-pin')
    expect(result.simplemsgPinId).toBe('simplemsg-free-pin')
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:service-order-free-pin`)
    expect(result.orderPayload).toContain(`order id: ${result.orderReference}`)
    expect(result.orderPayload).toContain('order pin id: service-order-free-pin')
    expect(result.displaySummary).toBe('Free reading please.')
  })

  it('happy path: free order resolves a nested Metalet txid response to a service order pin id', async () => {
    const orderTxid = 'a'.repeat(64)
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi.fn().mockResolvedValue({
      data: {
        result: {
          raw: {
            payload: {
              res: {
                transactions: [
                  {
                    revealTxId: `broadcast ok: ${orderTxid}`,
                  },
                ],
              },
            },
          },
        },
      },
    })

    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0c)
      }
      return array
    })

    const result = await executePayAndRequest({
      service: freeService,
      provider,
      prompt: 'Free blueprint please.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).not.toHaveBeenCalled()
    expect(result.orderPinId).toBe(`${orderTxid}i0`)
    expect(result.simplemsgPinId).toBe(`${orderTxid}i0`)
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(generateRandomHex(32))
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:${result.orderPinId}`)
    expect(result.orderPayload).toContain(`order pin id: ${result.orderPinId}`)
  })

  it('treats a resolved free order createPin without a parseable pin id as broadcast success', async () => {
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-indeterminate-simplemsg' })
      .mockResolvedValueOnce({ status: 'Task Finished' })

    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0f)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    const result = await executePayAndRequest({
      service: freeService,
      provider,
      prompt: 'Free blueprint please.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).not.toHaveBeenCalled()
    expect(createPin).toHaveBeenCalledTimes(2)
    expect(result.orderPinId).toBe('service-order-indeterminate-simplemsg')
    expect(result.simplemsgPinId).toBe('')
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(expectedOrderReference)
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:service-order-indeterminate-simplemsg`)
    expect(result.orderPayload).toContain(`order id: ${expectedOrderReference}`)
    expect(result.orderPayload).toContain('order pin id: service-order-indeterminate-simplemsg')
  })

  it('treats a resolved free order explorer open-url envelope as broadcast success', async () => {
    const orderTxid = 'b'.repeat(64)
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-open-url' })
      .mockResolvedValueOnce({
        error: {
          code: 'open-url',
          openUrl: `https://www.mvcscan.com/tx/${orderTxid}`,
        },
      })

    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x12)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    const result = await executePayAndRequest({
      service: freeService,
      provider,
      prompt: 'Short free order test.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).not.toHaveBeenCalled()
    expect(result.orderPinId).toBe('service-order-open-url')
    expect(result.simplemsgPinId).toBe(`${orderTxid}i0`)
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(expectedOrderReference)
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:service-order-open-url`)
  })

  it('treats a free order Chrome extension response-loss reject as pending broadcast success', async () => {
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi
      .fn()
      .mockResolvedValueOnce({ pinId: 'service-order-response-lost' })
      .mockRejectedValueOnce(
        new Error(
          'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
        ),
      )

    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x13)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    const result = await executePayAndRequest({
      service: freeService,
      provider,
      prompt: 'Short free order test.',
      wallet,
      metalet: { transfer, ecdh, createPin },
    })

    expect(transfer).not.toHaveBeenCalled()
    expect(createPin).toHaveBeenCalledTimes(2)
    expect(result.orderPinId).toBe('service-order-response-lost')
    expect(result.simplemsgPinId).toBe('')
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(expectedOrderReference)
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:service-order-response-lost`)
  })

  it('surfaces payment failure when transfer returns no txid', async () => {
    await expect(
      executePayAndRequest({
        service: paidService,
        provider,
        prompt: 'Need this service.',
        wallet,
        metalet: {
          transfer: vi.fn().mockResolvedValue({ txids: [] }),
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'payment_failed' } satisfies Partial<PayAndRequestError>)
  })

  it('fails native paid preflight before transfer when payment address is missing', async () => {
    const transfer = vi.fn()
    await expect(
      executePayAndRequest({
        service: { ...paidService, paymentAddress: '   ' },
        provider,
        prompt: 'Need this service.',
        wallet,
        metalet: {
          transfer,
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'payment_failed' } satisfies Partial<PayAndRequestError>)

    expect(transfer).not.toHaveBeenCalled()
  })

  it('fails preflight before transfer when wallet identity is missing', async () => {
    const transfer = vi.fn()
    await expect(
      executePayAndRequest({
        service: paidService,
        provider,
        prompt: 'Need this service.',
        wallet: { ...wallet, globalMetaId: '   ' },
        metalet: {
          transfer,
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'missing_wallet' } satisfies Partial<PayAndRequestError>)

    expect(transfer).not.toHaveBeenCalled()
  })

  it('fails preflight before transfer when provider global meta id is missing', async () => {
    const transfer = vi.fn()
    await expect(
      executePayAndRequest({
        service: paidService,
        provider: { ...provider, globalMetaId: '   ' },
        prompt: 'Need this service.',
        wallet,
        metalet: {
          transfer,
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'missing_provider_key' } satisfies Partial<PayAndRequestError>)

    expect(transfer).not.toHaveBeenCalled()
  })

  it('fails preflight before transfer or broadcast when provider chat key is missing', async () => {
    const transfer = vi.fn()
    const ecdh = vi.fn()
    const createPin = vi.fn()

    await expect(
      executePayAndRequest({
        service: paidService,
        provider: { ...provider, chatPubkey: null },
        prompt: 'Need this service.',
        wallet,
        metalet: {
          transfer,
          ecdh,
          createPin,
        },
      }),
    ).rejects.toMatchObject({ code: 'missing_provider_key' } satisfies Partial<PayAndRequestError>)

    expect(transfer).not.toHaveBeenCalled()
    expect(ecdh).not.toHaveBeenCalled()
    expect(createPin).not.toHaveBeenCalled()
  })

  it('blocks paid MRC20 checkout with a clear unsupported-state error before transfer', async () => {
    const transfer = vi.fn()
    await expect(
      executePayAndRequest({
        service: {
          ...paidService,
          settlementKind: 'mrc20',
          currency: 'MRC20',
          paymentChain: 'btc',
          mrc20Ticker: 'DEMO',
          mrc20Id: 'mrc20-genesis-id-demo',
          paymentAddress: 'bc1qmrc20recipient',
        },
        provider,
        prompt: 'Need MRC20 service.',
        wallet,
        metalet: {
          transfer,
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      code: 'payment_failed',
      message: 'MRC20 checkout is not available in BotHub yet. Choose a native paid or free service.',
    } satisfies Partial<PayAndRequestError>)

    expect(transfer).not.toHaveBeenCalled()
  })

  it('throws a broadcast error with paid payment context when createPin fails', async () => {
    const paymentTxid = 'd'.repeat(64)

    await expect(
      executePayAndRequest({
        service: paidService,
        provider,
        prompt: 'Paid request that should be recoverable.',
        wallet,
        metalet: {
          transfer: vi.fn().mockResolvedValue({ txids: [paymentTxid] }),
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'aa'.repeat(32) }),
          createPin: vi
            .fn()
            .mockResolvedValueOnce({ pinId: 'service-order-paid-failed-simplemsg' })
            .mockRejectedValueOnce(new Error('network down')),
        },
      }),
    ).rejects.toMatchObject({
      code: 'broadcast_failed',
      partial: {
        service: paidService,
        provider,
        prompt: 'Paid request that should be recoverable.',
        payment: {
          paymentTxid,
          paymentCommitTxid: '',
          orderReference: '',
        },
        sessionKey: `${provider.globalMetaId}:service-order-paid-failed-simplemsg`,
        orderPayload: expect.stringContaining(`txid: ${paymentTxid}`),
        serviceOrderPinId: 'service-order-paid-failed-simplemsg',
        encryptedContent: expect.any(String),
        simplemsgBody: expect.stringContaining('"content"'),
        displaySummary: 'Paid request that should be recoverable.',
      },
    })
  })

  it('throws a broadcast error with a free order reference when createPin fails', async () => {
    clearTestSessionStorage()
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0b)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    await expect(
      executePayAndRequest({
        service: freeService,
        provider,
        prompt: 'Free request that should be recoverable.',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) }),
          createPin: vi
            .fn()
            .mockResolvedValueOnce({ pinId: 'service-order-free-failed-simplemsg' })
            .mockRejectedValueOnce(new Error('network down')),
        },
      }),
    ).rejects.toMatchObject({
      code: 'broadcast_failed',
      partial: {
        payment: {
          paymentTxid: '',
          paymentCommitTxid: '',
          orderReference: expectedOrderReference,
        },
        sessionKey: `${provider.globalMetaId}:service-order-free-failed-simplemsg`,
        serviceOrderPinId: 'service-order-free-failed-simplemsg',
      },
    })
    expect(getLastCreatePinDiagnostic()).toMatchObject({
      phase: 'rejected',
      providerGlobalMetaId: provider.globalMetaId,
      orderReference: expectedOrderReference,
      sessionKey: `${provider.globalMetaId}:service-order-free-failed-simplemsg`,
      errorMessage: 'network down',
    })
  })

  it('throws a broadcast error with a free order reference when createPin resolves a canceled status', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x10)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    await expect(
      executePayAndRequest({
        service: freeService,
        provider,
        prompt: 'Free request that the wallet cancels.',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) }),
          createPin: vi
            .fn()
            .mockResolvedValueOnce({ pinId: 'service-order-free-canceled-simplemsg' })
            .mockResolvedValueOnce({ status: 'canceled' }),
        },
      }),
    ).rejects.toMatchObject({
      code: 'broadcast_failed',
      message: expect.stringMatching(/canceled/i),
      partial: {
        payment: {
          paymentTxid: '',
          paymentCommitTxid: '',
          orderReference: expectedOrderReference,
        },
        sessionKey: `${provider.globalMetaId}:service-order-free-canceled-simplemsg`,
        serviceOrderPinId: 'service-order-free-canceled-simplemsg',
      },
    })
  })

  it('throws a broadcast error when createPin resolves an error envelope without a pin id', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x11)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)

    await expect(
      executePayAndRequest({
        service: freeService,
        provider,
        prompt: 'Free request that the wallet rejects.',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) }),
          createPin: vi
            .fn()
            .mockResolvedValueOnce({ pinId: 'service-order-free-error-simplemsg' })
            .mockResolvedValueOnce({ error: 'user canceled' }),
        },
      }),
    ).rejects.toMatchObject({
      code: 'broadcast_failed',
      message: expect.stringMatching(/user canceled/i),
      partial: {
        payment: {
          paymentTxid: '',
          paymentCommitTxid: '',
          orderReference: expectedOrderReference,
        },
        sessionKey: `${provider.globalMetaId}:service-order-free-error-simplemsg`,
        serviceOrderPinId: 'service-order-free-error-simplemsg',
      },
    })
  })

  it('times out order encryption before broadcasting when ecdh never receives a wallet response', async () => {
    vi.useFakeTimers()
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0e)
      }
      return array
    })
    const createPin = vi.fn().mockResolvedValueOnce({ pinId: 'service-order-before-ecdh-timeout' })
    let caught: unknown

    try {
      void executePayAndRequest({
        service: freeService,
        provider,
        prompt: 'Free request that stalls while encrypting.',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn().mockReturnValue(new Promise(() => {})),
          createPin,
        },
      }).catch((err: unknown) => {
        caught = err
      })

      await vi.advanceTimersByTimeAsync(ECDH_WALLET_RESPONSE_TIMEOUT_MS)
    } finally {
      vi.useRealTimers()
    }

    expect(caught).toBeInstanceOf(PayAndRequestError)
    expect(caught).toMatchObject({
      code: 'encryption_failed',
      message: 'Order encryption timed out waiting for Metalet ECDH response',
    })
    expect(createPin).not.toHaveBeenCalled()
  })

  it('waits past the old 90s limit before timing out a free order broadcast', async () => {
    vi.useFakeTimers()
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint8Array) {
        array.fill(0x0d)
      }
      return array
    })
    const expectedOrderReference = generateRandomHex(32)
    let caught: unknown
    let settled = false

    try {
      void executePayAndRequest({
        service: freeService,
        provider,
        prompt: 'Free request that never settles.',
        wallet,
        metalet: {
          transfer: vi.fn(),
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) }),
          createPin: vi
            .fn()
            .mockResolvedValueOnce({ pinId: 'service-order-before-simplemsg-timeout' })
            .mockReturnValueOnce(new Promise(() => {})),
        },
      }).catch((err: unknown) => {
        settled = true
        caught = err
      })

      await vi.advanceTimersByTimeAsync(OLD_CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS)
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(
        CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS - OLD_CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS,
      )
    } finally {
      vi.useRealTimers()
    }

    expect(caught).toBeInstanceOf(PayAndRequestBroadcastError)
    expect(caught).toMatchObject({
      code: 'broadcast_failed',
      message: 'Order pin broadcast timed out waiting for wallet response',
      partial: {
        payment: {
          paymentTxid: '',
          paymentCommitTxid: '',
          orderReference: expectedOrderReference,
        },
        sessionKey: `${provider.globalMetaId}:service-order-before-simplemsg-timeout`,
        serviceOrderPinId: 'service-order-before-simplemsg-timeout',
        orderPayload: expect.stringContaining(`order id: ${expectedOrderReference}`),
      },
    })
  })
})
