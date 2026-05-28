import { describe, expect, it, vi } from 'vitest'
import {
  DeliveryFollowUpError,
  sendDeliveryFollowUp,
} from '@/delivery/sendMessage'
import type { WalletIdentity } from '@/wallet/types'

const wallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

describe('sendDeliveryFollowUp', () => {
  it('blocks empty messages', async () => {
    await expect(
      sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: 'idqprovider',
        providerChatPubkey: '04abc',
        content: '   ',
        metalet: {
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      code: 'empty_content',
    } satisfies Partial<DeliveryFollowUpError>)
  })

  it('blocks a missing provider chat pubkey', async () => {
    await expect(
      sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: 'idqprovider',
        providerChatPubkey: '  ',
        content: 'Can you revise the delivery?',
        metalet: {
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      code: 'missing_provider_key',
    } satisfies Partial<DeliveryFollowUpError>)
  })

  it('blocks a missing provider globalMetaId', async () => {
    await expect(
      sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: '  ',
        providerChatPubkey: '04' + 'ab'.repeat(64),
        content: 'Can you revise the delivery?',
        metalet: {
          ecdh: vi.fn(),
          createPin: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      code: 'missing_provider_key',
    } satisfies Partial<DeliveryFollowUpError>)
  })

  it('encrypts with ECDH and posts a private simplemsg pin', async () => {
    const ecdh = vi.fn().mockResolvedValue({ sharedSecret: 'aa'.repeat(32) })
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-follow-up-1' })

    const result = await sendDeliveryFollowUp({
      wallet,
      providerGlobalMetaId: 'idqprovider',
      providerChatPubkey: '04' + 'ab'.repeat(64),
      content: 'Can you add a source file?',
      replyPin: 'pin-original',
      metalet: { ecdh, createPin },
    })

    expect(ecdh).toHaveBeenCalledWith({ externalPubKey: '04' + 'ab'.repeat(64) })
    expect(createPin).toHaveBeenCalledOnce()
    const pinArgs = createPin.mock.calls[0][0] as {
      chain: string
      dataList: Array<{ metaidData: { path: string; body: string } }>
    }
    expect(pinArgs.chain).toBe('mvc')
    expect(pinArgs.dataList[0].metaidData.path).toBe('/private/chat/simplemsg')
    const body = JSON.parse(pinArgs.dataList[0].metaidData.body) as {
      to: string
      content: string
      contentType: string
      encrypt: string
      replyPin: string
    }
    expect(body).toMatchObject({
      to: 'idqprovider',
      contentType: 'text/plain',
      encrypt: 'ecdh',
      replyPin: 'pin-original',
    })
    expect(body.content).toBe(result.encryptedContent)
    expect(body.content).not.toBe('Can you add a source file?')
    expect(result.pinId).toBe('pin-follow-up-1')
  })

  it('defaults replyPin and includes a numeric timestamp', async () => {
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-follow-up-2' })

    await sendDeliveryFollowUp({
      wallet,
      providerGlobalMetaId: 'idqprovider',
      providerChatPubkey: '04' + 'ab'.repeat(64),
      content: 'Can you add one more note?',
      metalet: {
        ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'cc'.repeat(32) }),
        createPin,
      },
    })

    const pinArgs = createPin.mock.calls[0][0] as {
      dataList: Array<{ metaidData: { body: string } }>
    }
    const body = JSON.parse(pinArgs.dataList[0].metaidData.body) as {
      replyPin: string
      timestamp: number
    }
    expect(body.replyPin).toBe('')
    expect(typeof body.timestamp).toBe('number')
    expect(Number.isFinite(body.timestamp)).toBe(true)
  })

  it('falls back to the first txid when createPin omits pinId', async () => {
    const createPin = vi.fn().mockResolvedValue({ txids: ['txid-a', 'txid-b'] })

    await expect(
      sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: 'idqprovider',
        providerChatPubkey: '04' + 'ab'.repeat(64),
        content: 'Thanks, one more thing.',
        metalet: {
          ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'bb'.repeat(32) }),
          createPin,
        },
      }),
    ).resolves.toMatchObject({ pinId: 'txid-a' })
  })
})
