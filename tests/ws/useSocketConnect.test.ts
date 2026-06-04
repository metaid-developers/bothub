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

  it('opens socket subscriptions for both wallet globalMetaId and MVC address', async () => {
    vi.stubEnv('VITE_USE_WS_MOCK', 'false')
    const { useSocket } = await loadUseSocket()

    useSocket.getState().connect({
      globalMetaId: 'idq1buyer',
      mvcAddress: '1BuyerMvcAddress',
      btcAddress: 'bc1buyer',
      dogeAddress: 'Dbuyer',
    })

    expect(mocks.connectSocket).toHaveBeenCalledTimes(2)
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ globalMetaId: 'idq1buyer' }),
    )
    expect(mocks.connectSocket).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ globalMetaId: '1BuyerMvcAddress' }),
    )
  })
})
