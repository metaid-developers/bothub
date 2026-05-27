import { describe, expect, it, vi } from 'vitest'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import {
  executePayAndRequest,
  generateRandomHex,
  PayAndRequestError,
} from '@/order/flow'

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

describe('executePayAndRequest', () => {
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
    expect(ecdh).toHaveBeenCalledWith({ externalPubKey: provider.chatPubkey })
    expect(createPin).toHaveBeenCalledOnce()
    const pinArgs = createPin.mock.calls[0][0] as {
      chain: string
      dataList: Array<{ metaidData: { path: string; body: string } }>
    }
    expect(pinArgs.chain).toBe('mvc')
    expect(pinArgs.dataList[0].metaidData.path).toBe('/private/chat/simplemsg')
    const body = JSON.parse(pinArgs.dataList[0].metaidData.body) as {
      to: string
      encrypt: string
      content: string
    }
    expect(body.to).toBe(provider.globalMetaId)
    expect(body.encrypt).toBe('ecdh')
    expect(body.content).toBeTruthy()

    expect(result.paymentTxid).toBe(paymentTxid)
    expect(result.orderReference).toBe('')
    expect(result.orderPinId).toBe('pin-order-001')
    expect(result.sessionKey).toBe(`${provider.globalMetaId}:${paymentTxid}`)
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
})
