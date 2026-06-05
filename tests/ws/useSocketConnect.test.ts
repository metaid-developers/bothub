import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connectSocket: vi.fn(() => ({ disconnect: vi.fn() })),
}))

vi.mock('@/ws/socket', async () => {
  const actual = await vi.importActual<typeof import('@/ws/socket')>('@/ws/socket')
  return {
    ...actual,
    connectSocket: mocks.connectSocket,
  }
})

async function loadUseSocket() {
  return import('@/ws/useSocket')
}

describe('useSocket connection lifecycle', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    mocks.connectSocket.mockReset()
  })

  it('opens socket subscriptions for every wallet private-chat identity alias', async () => {
    vi.stubEnv('VITE_USE_WS_MOCK', 'false')
    const { useSocket } = await loadUseSocket()

    useSocket.getState().connect({
      globalMetaId: 'idq1buyer',
      metaid: 'legacy-metaid-buyer',
      mvcAddress: '1BuyerMvcAddress',
      btcAddress: 'bc1buyer',
      dogeAddress: 'Dbuyer',
    })

    expect(mocks.connectSocket).toHaveBeenCalledTimes(5)
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ globalMetaId: 'idq1buyer' }),
    )
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ globalMetaId: 'legacy-metaid-buyer' }),
    )
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ globalMetaId: '1BuyerMvcAddress' }),
    )
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ globalMetaId: 'bc1buyer' }),
    )
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ globalMetaId: 'Dbuyer' }),
    )
  })
})
