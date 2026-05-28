import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryComposer } from '@/components/delivery/DeliveryComposer'
import type { EnrichedDeliverySession } from '@/delivery/sessionDisplay'
import type { WalletIdentity } from '@/wallet/types'

const mocks = vi.hoisted(() => ({
  appendOutgoingFollowUp: vi.fn().mockResolvedValue(undefined),
  sendDeliveryFollowUp: vi.fn(),
}))

vi.mock('@/delivery/messageStore', () => ({
  useMessageStore: (selector: (state: { appendOutgoingFollowUp: typeof mocks.appendOutgoingFollowUp }) => unknown) =>
    selector({ appendOutgoingFollowUp: mocks.appendOutgoingFollowUp }),
}))

vi.mock('@/delivery/sendMessage', () => ({
  sendDeliveryFollowUp: (...args: unknown[]) => mocks.sendDeliveryFollowUp(...args),
}))

vi.mock('@/wallet/metalet', () => ({
  ecdh: vi.fn(),
  createPin: vi.fn(),
}))

const wallet: WalletIdentity = {
  globalMetaId: 'idqbuyer',
  mvcAddress: '1BuyerMvc',
  btcAddress: 'bc1buyer',
  dogeAddress: 'Dbuyer',
}

const session: EnrichedDeliverySession = {
  sessionKey: 'idqprovider:order-1',
  peerGlobalMetaId: 'idqprovider',
  orderCorrelationId: 'order-1',
  serviceLabel: 'Delivery Skill',
  lastMessage: {
    id: 'pin-order',
    peerGlobalMetaId: 'idqprovider',
    fromGlobalMetaId: 'idqbuyer',
    toGlobalMetaId: 'idqprovider',
    content: '[ORDER] test',
    rawContent: '[ORDER] test',
    encryption: 'plain',
    contentType: 'text/plain',
    timestamp: 1,
    pinId: 'pin-order',
  },
  messageCount: 1,
  status: 'active',
  assetCount: 0,
  providerChatPubkey: '04' + 'ab'.repeat(64),
}

describe('DeliveryComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.appendOutgoingFollowUp.mockResolvedValue(undefined)
    mocks.sendDeliveryFollowUp.mockResolvedValue({
      pinId: 'pin-follow-up',
      encryptedContent: 'encrypted-follow-up',
    })
  })

  it('is disabled with no provider key and shows the reason', () => {
    render(
      <DeliveryComposer
        wallet={wallet}
        session={{ ...session, providerChatPubkey: undefined }}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Message provider' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Provider chat key unavailable')).toBeInTheDocument()
  })

  it('is disabled with no connected wallet and shows the reason', () => {
    render(<DeliveryComposer wallet={null} session={session} />)

    expect(screen.getByRole('textbox', { name: 'Message provider' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Connect wallet to reply')).toBeInTheDocument()
  })

  it('is disabled with no selected session and shows the reason', () => {
    render(<DeliveryComposer wallet={wallet} session={null} />)

    expect(screen.getByRole('textbox', { name: 'Message provider' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Select a session to reply')).toBeInTheDocument()
  })

  it('disables the send button while sending', async () => {
    mocks.sendDeliveryFollowUp.mockReturnValue(new Promise(() => undefined))

    render(<DeliveryComposer wallet={wallet} session={session} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Message provider' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    const sendingButton = await screen.findByRole('button', { name: 'Sending' })
    expect(sendingButton).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Message provider' })).toBeDisabled()
  })

  it('preserves typed content when sending fails', async () => {
    mocks.sendDeliveryFollowUp.mockRejectedValue(new Error('wallet rejected'))

    render(<DeliveryComposer wallet={wallet} session={session} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Message provider' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await screen.findByText('wallet rejected')
    expect(screen.getByRole('textbox', { name: 'Message provider' })).toHaveValue(
      'Please send the source files too.',
    )
    expect(mocks.appendOutgoingFollowUp).not.toHaveBeenCalled()
  })

  it('clears content and appends an optimistic outgoing message on success', async () => {
    const onSent = vi.fn()
    render(<DeliveryComposer wallet={wallet} session={session} onSent={onSent} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Message provider' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() =>
      expect(mocks.appendOutgoingFollowUp).toHaveBeenCalledWith({
        wallet,
        session,
        content: 'Please send the source files too.',
        rawContent: 'encrypted-follow-up',
        pinId: 'pin-follow-up',
      }),
    )
    expect(screen.getByRole('textbox', { name: 'Message provider' })).toHaveValue('')
    expect(onSent).toHaveBeenCalledOnce()
  })
})
