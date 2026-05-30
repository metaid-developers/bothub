import { describe, expect, it, vi } from 'vitest'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import {
  executePayAndRequest,
  generateRandomHex,
  PayAndRequestBroadcastError,
  PayAndRequestError,
} from '@/order/flow'
import {
  CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS,
  ECDH_WALLET_RESPONSE_TIMEOUT_MS,
} from '@/order/walletTimeout'

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

describe('executePayAndRequest', () => {
  it('posts orders as standard simplemsg pins with millisecond timestamps', async () => {
    const now = 1_764_321_987_654
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const paymentTxid = 'e'.repeat(64)
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-order-standard' })

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

    const pinArgs = createPin.mock.calls[0][0] as {
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
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-order-001', txids: [paymentTxid] })

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
    expect(ecdh).toHaveBeenCalledWith({ externalPubKey: provider.chatPubkey })
    expect(createPin).toHaveBeenCalledOnce()
    const pinArgs = createPin.mock.calls[0][0] as {
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
    expect(result.orderPinId).toBe('pin-order-001')
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:${paymentTxid}`)
    expect(result.orderPayload).toContain(`txid: ${paymentTxid}`)
    expect(result.displaySummary).toBe('Please deliver my fortune reading.')
  })

  it('happy path: free order skips transfer and uses order reference', async () => {
    const transfer = vi.fn()
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) })
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-free-order' })

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
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(generateRandomHex(32))
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:${result.orderReference}`)
    expect(result.orderPayload).toContain(`order id: ${result.orderReference}`)
    expect(result.displaySummary).toBe('Free reading please.')
  })

  it('happy path: free order resolves a nested Metalet txid response to a simplemsg pin id', async () => {
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
    expect(result.paymentTxid).toBe('')
    expect(result.paymentCommitTxid).toBe('')
    expect(result.orderReference).toBe(generateRandomHex(32))
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:${result.orderReference}`)
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
      message: expect.stringMatching(/MRC20 paid checkout is not supported/i),
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
          createPin: vi.fn().mockRejectedValue(new Error('network down')),
        },
      }),
    ).rejects.toMatchObject({
      code: 'broadcast_failed',
      partial: {
        payment: {
          paymentTxid,
          paymentCommitTxid: '',
          orderReference: '',
        },
        sessionKey: `${provider.globalMetaId}:${paymentTxid}`,
      },
    })
  })

  it('throws a broadcast error with a free order reference when createPin fails', async () => {
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
          createPin: vi.fn().mockRejectedValue(new Error('network down')),
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
        sessionKey: `${provider.globalMetaId}:${expectedOrderReference}`,
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
    const createPin = vi.fn()
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
          createPin: vi.fn().mockReturnValue(new Promise(() => {})),
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
        sessionKey: `${provider.globalMetaId}:${expectedOrderReference}`,
        orderPayload: expect.stringContaining(`order id: ${expectedOrderReference}`),
      },
    })
  })
})
