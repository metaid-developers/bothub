import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { clearTestLocalStorage } from '../setup'
import * as metalet from '@/wallet/metalet'
import { fetchUserProfileByGlobalMetaId } from '@/api/userProfile'
import { useWallet } from '@/wallet/useWallet'

vi.mock('@/wallet/metalet', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  ensureReady: vi.fn(),
  getGlobalMetaid: vi.fn(),
  isMetaletInstalled: vi.fn(() => true),
  MetaletNotInstalledError: class MetaletNotInstalledError extends Error {
    name = 'MetaletNotInstalledError'
  },
}))

vi.mock('@/api/userProfile', () => ({
  fetchUserProfileByGlobalMetaId: vi.fn(),
}))

describe('useWallet store', () => {
  beforeEach(() => {
    clearTestLocalStorage()
    useWallet.setState({
      identity: null,
      status: 'disconnected',
      errorMessage: null,
    })
    vi.clearAllMocks()
  })

  it('connect stores identity and sets connected status', async () => {
    vi.mocked(metalet.connect).mockResolvedValue({})
    vi.mocked(metalet.getGlobalMetaid).mockResolvedValue({
      globalMetaId: 'idq1abc',
      mvcAddress: '1mvc',
      btcAddress: 'bc1',
      dogeAddress: 'Ddoge',
    })

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })
    expect(result.current.identity?.globalMetaId).toBe('idq1abc')
  })

  it('connect hydrates non-sensitive profile fields into wallet identity', async () => {
    vi.mocked(metalet.connect).mockResolvedValue({})
    vi.mocked(metalet.getGlobalMetaid).mockResolvedValue({
      globalMetaId: 'idq1profile',
      mvcAddress: '1mvc',
      btcAddress: 'bc1',
      dogeAddress: 'Ddoge',
    })
    vi.mocked(fetchUserProfileByGlobalMetaId).mockResolvedValue({
      globalMetaId: 'idq1profile',
      metaid: 'metaid-profile',
      name: 'Ada',
      avatar: 'metafile://avatar.png',
      avatarUrl: 'https://files.example/avatar',
      chatPubkey: 'chat-key',
    })

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.identity).toMatchObject({
      globalMetaId: 'idq1profile',
      metaid: 'metaid-profile',
      name: 'Ada',
      avatar: 'metafile://avatar.png',
      avatarUrl: 'https://files.example/avatar',
      chatPubkey: 'chat-key',
    })
    expect(typeof result.current.identity?.profileUpdatedAt).toBe('number')
  })

  it('connect still succeeds when profile hydration fails', async () => {
    vi.mocked(metalet.connect).mockResolvedValue({})
    vi.mocked(metalet.getGlobalMetaid).mockResolvedValue({
      globalMetaId: 'idq1abc',
      mvcAddress: '1mvc',
      btcAddress: 'bc1',
      dogeAddress: 'Ddoge',
    })
    vi.mocked(fetchUserProfileByGlobalMetaId).mockRejectedValue(new Error('profile offline'))

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.status).toBe('connected')
    expect(result.current.identity).toMatchObject({
      globalMetaId: 'idq1abc',
      mvcAddress: '1mvc',
    })
  })

  it('connect resets from connecting to error when Metalet does not respond', async () => {
    vi.mocked(metalet.connect).mockRejectedValue(
      new Error('Confirm the connect request in Metalet, or retry if the window closed.'),
    )

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow(/Confirm the connect request/)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toMatch(/Confirm the connect request/)
    expect(result.current.identity).toBeNull()
    expect(metalet.getGlobalMetaid).not.toHaveBeenCalled()
  })

  it('disconnect clears identity', async () => {
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1abc',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
      },
      status: 'connected',
    })
    vi.mocked(metalet.disconnect).mockResolvedValue({})

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.status).toBe('disconnected')
    expect(result.current.identity).toBeNull()
  })

  it('clearStaleConnection clears local connected state without calling Metalet', async () => {
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1abc',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
      },
      status: 'connected',
      errorMessage: null,
    })

    const { result } = renderHook(() => useWallet())

    act(() => {
      result.current.clearStaleConnection()
    })

    expect(result.current.status).toBe('disconnected')
    expect(result.current.identity).toBeNull()
    expect(result.current.errorMessage).toBeNull()
    expect(metalet.disconnect).not.toHaveBeenCalled()
  })

  it('identifies wallet readiness errors that should clear local state', () => {
    expect(
      useWallet
        .getState()
        .isWalletReadinessError(
          new Error('Metalet wallet is not connected to this site. Connect Metalet and try again.'),
        ),
    ).toBe(true)
    expect(
      useWallet
        .getState()
        .isWalletReadinessError(
          new Error('Connected Metalet account changed. Reconnect your wallet before sending a request.'),
        ),
    ).toBe(true)
    expect(
      useWallet.getState().isWalletReadinessError(new Error('Order encryption failed')),
    ).toBe(false)
  })

  it('hydrateFromMetalet clears stale connected identity when live wallet preflight fails', async () => {
    useWallet.setState({
      identity: {
        globalMetaId: 'idq1stale',
        mvcAddress: '1mvc',
        btcAddress: 'bc1',
        dogeAddress: 'Ddoge',
      },
      status: 'connected',
      errorMessage: null,
    })
    vi.mocked(metalet.ensureReady).mockRejectedValue(
      new Error('Metalet wallet is not connected to this site. Connect Metalet and try again.'),
    )

    const { result } = renderHook(() => useWallet())

    await act(async () => {
      await result.current.hydrateFromMetalet()
    })

    expect(metalet.ensureReady).toHaveBeenCalledWith('idq1stale')
    expect(metalet.getGlobalMetaid).not.toHaveBeenCalled()
    expect(result.current.identity).toBeNull()
    expect(result.current.status).toBe('disconnected')
    expect(result.current.errorMessage).toBeNull()
  })
})
