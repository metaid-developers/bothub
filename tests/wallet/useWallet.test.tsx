import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { clearTestLocalStorage } from '../setup'
import * as metalet from '@/wallet/metalet'
import { useWallet } from '@/wallet/useWallet'

vi.mock('@/wallet/metalet', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getGlobalMetaid: vi.fn(),
  isMetaletInstalled: vi.fn(() => true),
  MetaletNotInstalledError: class MetaletNotInstalledError extends Error {
    name = 'MetaletNotInstalledError'
  },
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
})
