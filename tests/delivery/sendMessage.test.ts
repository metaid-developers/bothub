import { describe, expect, it, vi } from 'vitest'
import {
  DeliveryFollowUpError,
  sendDeliveryFollowUp,
} from '@/delivery/sendMessage'
import { CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS } from '@/order/walletTimeout'
import type { WalletIdentity } from '@/wallet/types'

const wallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

const OLD_CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS = 90_000

describe('sendDeliveryFollowUp', () => {
  it('posts follow-ups as standard simplemsg pins with millisecond timestamps', async () => {
    const now = 1_764_322_123_456
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const createPin = vi.fn().mockResolvedValue({ pinId: 'pin-follow-up-standard' })

    await sendDeliveryFollowUp({
      wallet,
      providerGlobalMetaId: 'idqprovider',
      providerChatPubkey: '04' + 'ab'.repeat(64),
      content: 'Can you add a source file?',
      metalet: {
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
    expect(body.to).toBe('idqprovider')
    expect(body.encrypt).toBe('ecdh')
    expect(body.contentType).toBe('text/plain')
    expect(body.timestamp).toBe(now)
    expect(body.timestamp).toBeGreaterThan(10_000_000_000)
  })

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
    expect(pinArgs.dataList[0].metaidData.path).toBe('/protocols/simplemsg')
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

  it('resolves a nested Metalet txid response to a simplemsg pin id', async () => {
    const followUpTxid = 'c'.repeat(64)
    const createPin = vi.fn().mockResolvedValue({
      result: {
        res: {
          transactions: [
            {
              revealTxid: `sent ${followUpTxid}`,
            },
          ],
        },
      },
    })

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
    ).resolves.toMatchObject({ pinId: `${followUpTxid}i0` })
  })

  it('waits past the old 90s limit before timing out a follow-up broadcast', async () => {
    vi.useFakeTimers()
    let caught: unknown
    let settled = false

    try {
      void sendDeliveryFollowUp({
        wallet,
        providerGlobalMetaId: 'idqprovider',
        providerChatPubkey: '04' + 'ab'.repeat(64),
        content: 'Can you add one more note?',
        metalet: {
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

    expect(caught).toBeInstanceOf(DeliveryFollowUpError)
    expect(caught).toMatchObject({
      code: 'broadcast_failed',
      message: 'Follow-up broadcast timed out waiting for wallet response',
    })
  })
})
