import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import { useWallet } from '@/wallet/useWallet'

vi.mock('@/wallet/metalet', () => ({
  MetaletNotInstalledError: class MetaletNotInstalledError extends Error {
    name = 'MetaletNotInstalledError'
  },
}))

describe('WalletConnectButton', () => {
  beforeEach(() => {
    useWallet.setState({
      identity: null,
      status: 'disconnected',
      errorMessage: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      hydrateFromMetalet: vi.fn(),
    })
  })

  it('shows profile avatar, display name, shortened globalMetaId, and disconnect action', () => {
    const disconnect = vi.fn()
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1abcdefghijklmnopqrstuv',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
        name: 'Ada Lovelace',
        avatarUrl: 'https://files.example/avatar.png',
      },
      status: 'connected',
      disconnect,
    })

    render(<WalletConnectButton />)

    expect(screen.getByRole('img', { name: 'Ada Lovelace avatar' })).toHaveAttribute(
      'src',
      'https://files.example/avatar.png',
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByTitle('idq1abcdefghijklmnopqrstuv')).toHaveTextContent('idq1ab…stuv')

    fireEvent.click(screen.getByRole('button', { name: '断开' }))

    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('shows a normalized raw avatar when avatarUrl is missing', () => {
    const avatarPin = `${'a'.repeat(64)}i0`
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1abcdefghijklmnopqrstuv',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
        name: 'Raw Avatar',
        avatar: `/content/${avatarPin}`,
      },
      status: 'connected',
    })

    render(<WalletConnectButton />)

    expect(screen.getByRole('img', { name: 'Raw Avatar avatar' })).toHaveAttribute(
      'src',
      `https://manapi.metaid.io/content/${avatarPin}`,
    )
  })

  it('falls back to an initial when no avatar URL is available', () => {
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1abcdefghijklmnopqrstuv',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
        name: 'Ada',
      },
      status: 'connected',
    })

    render(<WalletConnectButton />)

    expect(screen.getByText('AD')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })

  it('shows a retryable connect button after a connection error', () => {
    useWallet.setState({
      status: 'error',
      errorMessage: 'Metalet wallet did not respond to connect.',
    })

    render(<WalletConnectButton />)

    expect(screen.getByRole('button', { name: '连接钱包' })).toBeEnabled()
    expect(screen.getByText('钱包连接失败，请确认 Metalet 已解锁并重新连接')).toBeInTheDocument()
  })
})
