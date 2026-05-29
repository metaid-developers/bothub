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

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })
})
