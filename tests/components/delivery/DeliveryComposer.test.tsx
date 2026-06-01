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

  it('keeps missing provider key retry behind explicit technical details', () => {
    const onFetchProviderKey = vi.fn()
    render(
      <DeliveryComposer
        wallet={wallet}
        session={{ ...session, providerChatPubkey: undefined }}
        onFetchProviderKey={onFetchProviderKey}
      />,
    )

    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    expect(screen.getByText('暂时无法发送，正在补全对方资料')).toBeInTheDocument()
    expect(screen.queryByText('Provider chat key unavailable')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fetch provider key' })).not.toBeInTheDocument()

    expect(screen.getByText('需要时可展开详情处理资料同步。')).toBeInTheDocument()
    const detailsButton = screen.getByRole('button', { name: '同步资料技术详情' })
    expect(detailsButton).toHaveTextContent('技术详情')
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(detailsButton)
    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: '重试同步资料' }))

    expect(onFetchProviderKey).toHaveBeenCalledOnce()
  })

  it('enables sending when a resolved provider key is supplied outside the session', async () => {
    render(
      <DeliveryComposer
        wallet={wallet}
        session={{ ...session, providerChatPubkey: undefined }}
        providerChatPubkey="resolved-provider-key"
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: '补充需求或询问进度' }), {
      target: { value: 'Use the resolved key.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(mocks.sendDeliveryFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({ providerChatPubkey: 'resolved-provider-key' }),
      ),
    )
    expect(mocks.appendOutgoingFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ providerChatPubkey: 'resolved-provider-key' }),
      }),
    )
  })

  it('is disabled with no connected wallet and shows the reason', () => {
    render(<DeliveryComposer wallet={null} session={session} />)

    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    expect(screen.getByText('连接钱包后可继续沟通')).toBeInTheDocument()
    expect(screen.queryByText('Connect wallet to reply')).not.toBeInTheDocument()
  })

  it('is disabled with no selected session and shows the reason', () => {
    render(<DeliveryComposer wallet={wallet} session={null} />)

    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    expect(screen.getByText('选择一个请求后可继续沟通')).toBeInTheDocument()
  })

  it('disables the send button while sending', async () => {
    mocks.sendDeliveryFollowUp.mockReturnValue(new Promise(() => undefined))

    render(<DeliveryComposer wallet={wallet} session={session} />)

    fireEvent.change(screen.getByRole('textbox', { name: '补充需求或询问进度' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    const sendingButton = await screen.findByRole('button', { name: '发送中' })
    expect(sendingButton).toBeDisabled()
    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeDisabled()
  })

  it('preserves typed content when sending fails', async () => {
    mocks.sendDeliveryFollowUp.mockRejectedValue(new Error('wallet rejected'))

    render(<DeliveryComposer wallet={wallet} session={session} />)

    fireEvent.change(screen.getByRole('textbox', { name: '补充需求或询问进度' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await screen.findByText('wallet rejected')
    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toHaveValue(
      'Please send the source files too.',
    )
    expect(mocks.appendOutgoingFollowUp).not.toHaveBeenCalled()
  })

  it('clears content and appends an optimistic outgoing message on success', async () => {
    const onSent = vi.fn()
    render(<DeliveryComposer wallet={wallet} session={session} onSent={onSent} />)

    fireEvent.change(screen.getByRole('textbox', { name: '补充需求或询问进度' }), {
      target: { value: 'Please send the source files too.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() =>
      expect(mocks.appendOutgoingFollowUp).toHaveBeenCalledWith({
        wallet,
        session,
        content: 'Please send the source files too.',
        rawContent: 'encrypted-follow-up',
        pinId: 'pin-follow-up',
      }),
    )
    expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toHaveValue('')
    expect(onSent).toHaveBeenCalledOnce()
  })
})
