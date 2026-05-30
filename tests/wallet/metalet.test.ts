import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  METALET_COMMON_ECDH_WAIT_TIMEOUT_MS,
  METALET_ECDH_RESPONSE_TIMEOUT_MS,
  METALET_QUERY_RESPONSE_TIMEOUT_MS,
  MetaletNotInstalledError,
  connect,
  ecdh,
  ensureReady,
  getGlobalMetaid,
  isMetaletInstalled,
} from '@/wallet/metalet'

const mockWallet = {
  ping: vi.fn().mockResolvedValue('pong'),
  connect: vi.fn().mockResolvedValue({}),
  disconnect: vi.fn(),
  isConnected: vi.fn().mockResolvedValue({ connected: true }),
  getGlobalMetaid: vi.fn().mockResolvedValue({
    globalMetaId: 'idq1testglobalmetaid1234567890',
    mvcAddress: '1MvcAddressExample',
    btcAddress: 'bc1qexample',
    dogeAddress: 'DExampleDoge',
  }),
  getBalance: vi.fn(),
  transfer: vi.fn(),
  createPin: vi.fn(),
  ecdh: vi.fn(),
  eciesEncrypt: vi.fn(),
  eciesDecrypt: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}

describe('metalet adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { ...window, metaidwallet: mockWallet })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (window as Window & { metaidwallet?: unknown }).metaidwallet
  })

  it('isMetaletInstalled returns true when extension present', () => {
    expect(isMetaletInstalled()).toBe(true)
  })

  it('getGlobalMetaid returns typed identity fields (flat shape)', async () => {
    const result = await getGlobalMetaid()
    expect(result).toEqual({
      globalMetaId: 'idq1testglobalmetaid1234567890',
      mvcAddress: '1MvcAddressExample',
      btcAddress: 'bc1qexample',
      dogeAddress: 'DExampleDoge',
    })
    expect(mockWallet.getGlobalMetaid).toHaveBeenCalledOnce()
  })

  it('getGlobalMetaid normalizes nested Metalet shape', async () => {
    mockWallet.getGlobalMetaid.mockResolvedValueOnce({
      mvc: { address: '1MvcNested', globalMetaId: 'idq1nestedmvc' },
      btc: { address: 'bc1nested', globalMetaId: 'idq1nestedbtc' },
      doge: { address: 'Dnested', globalMetaId: 'idq1nesteddoge' },
    })
    const result = await getGlobalMetaid()
    expect(result.globalMetaId).toBe('idq1nestedmvc')
    expect(result.mvcAddress).toBe('1MvcNested')
  })

  it('getGlobalMetaid rejects Metalet status responses', async () => {
    mockWallet.getGlobalMetaid.mockResolvedValueOnce({ status: 'locked' })

    await expect(getGlobalMetaid()).rejects.toThrow(/Metalet wallet is locked/)
  })

  it('connect delegates to window.metaidwallet', async () => {
    await connect()
    expect(mockWallet.connect).toHaveBeenCalledOnce()
  })

  it('ensureReady verifies the live wallet bridge before checkout', async () => {
    const result = await ensureReady('idq1testglobalmetaid1234567890')

    expect(result.globalMetaId).toBe('idq1testglobalmetaid1234567890')
    expect(mockWallet.ping).toHaveBeenCalledOnce()
    expect(mockWallet.isConnected).toHaveBeenCalledOnce()
    expect(mockWallet.getGlobalMetaid).toHaveBeenCalledOnce()
  })

  it('ensureReady times out when Metalet query bridge does not respond', async () => {
    vi.useFakeTimers()
    mockWallet.ping.mockReturnValueOnce(new Promise(() => {}))

    const pending = ensureReady('idq1testglobalmetaid1234567890')
    const rejection = expect(pending).rejects.toThrow(/Metalet wallet did not respond to ping/)
    await vi.advanceTimersByTimeAsync(METALET_QUERY_RESPONSE_TIMEOUT_MS)

    await rejection
    expect(mockWallet.isConnected).not.toHaveBeenCalled()
  })

  it('ensureReady rejects disconnected wallet status before checkout', async () => {
    mockWallet.isConnected.mockResolvedValueOnce({ status: 'not-connected' })

    await expect(ensureReady('idq1testglobalmetaid1234567890')).rejects.toThrow(
      /not connected to this site/,
    )
  })

  it('ensureReady rejects when the active Metalet account differs from the persisted wallet', async () => {
    await expect(ensureReady('idq1different')).rejects.toThrow(/Connected Metalet account changed/)
  })

  it('ecdh prefers the demo-chat compatible common.ecdh surface', async () => {
    const commonEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'common-secret' })
    mockWallet.ecdh.mockResolvedValue({ sharedSecret: 'top-level-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    const result = await ecdh({ externalPubKey: 'provider-chat-key' })

    expect(result.sharedSecret).toBe('common-secret')
    expect(commonEcdh).toHaveBeenCalledWith({ externalPubKey: 'provider-chat-key' })
    expect(mockWallet.ecdh).not.toHaveBeenCalled()
  })

  it('ecdh waits for common.ecdh injection and does not call top-level wallet.ecdh', async () => {
    vi.useFakeTimers()
    const commonEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'delayed-common-secret' })
    const walletWithDelayedCommon = {
      ...mockWallet,
      common: {},
      ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'top-level-secret' }),
    }
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: walletWithDelayedCommon,
    })

    const pending = ecdh({ externalPubKey: 'provider-chat-key', path: '/protocols/simplemsg' })
    walletWithDelayedCommon.common = { ecdh: commonEcdh }
    await vi.advanceTimersByTimeAsync(50)
    const result = await pending

    vi.useRealTimers()
    expect(result.sharedSecret).toBe('delayed-common-secret')
    expect(commonEcdh).toHaveBeenCalledWith({
      externalPubKey: 'provider-chat-key',
      path: '/protocols/simplemsg',
    })
    expect(walletWithDelayedCommon.ecdh).not.toHaveBeenCalled()
  })

  it('ecdh falls back to top-level wallet.ecdh when common.ecdh is not injected before the wait timeout', async () => {
    vi.useFakeTimers()
    const topLevelEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'top-level-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        common: {},
        ecdh: topLevelEcdh,
      },
    })

    const pending = ecdh({ externalPubKey: 'provider-chat-key' })
    await vi.advanceTimersByTimeAsync(METALET_COMMON_ECDH_WAIT_TIMEOUT_MS)
    const result = await pending

    expect(result.sharedSecret).toBe('top-level-secret')
    expect(topLevelEcdh).toHaveBeenCalledWith({ externalPubKey: 'provider-chat-key' })
  })

  it('ecdh fails when neither common.ecdh nor top-level wallet.ecdh is available', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        common: {},
        ecdh: undefined,
      },
    })

    const pending = ecdh({ externalPubKey: 'provider-chat-key' })
    const rejection = expect(pending).rejects.toThrow(/Metalet common\.ecdh API is unavailable/)
    await vi.advanceTimersByTimeAsync(METALET_COMMON_ECDH_WAIT_TIMEOUT_MS)

    await rejection
  })

  it('ecdh falls back to top-level wallet.ecdh when common.ecdh never responds', async () => {
    vi.useFakeTimers()
    const commonEcdh = vi.fn().mockReturnValue(new Promise(() => {}))
    const topLevelEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'top-level-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        ecdh: topLevelEcdh,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    const pending = ecdh({ externalPubKey: 'provider-chat-key' })
    await vi.advanceTimersByTimeAsync(METALET_ECDH_RESPONSE_TIMEOUT_MS)
    const result = await pending

    expect(result.sharedSecret).toBe('top-level-secret')
    expect(commonEcdh).toHaveBeenCalledWith({ externalPubKey: 'provider-chat-key' })
    expect(topLevelEcdh).toHaveBeenCalledWith({ externalPubKey: 'provider-chat-key' })
  })

  it('ecdh rejects Metalet status responses without falling back', async () => {
    const commonEcdh = vi.fn().mockResolvedValue({ status: 'locked' })
    const topLevelEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'top-level-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        ecdh: topLevelEcdh,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    await expect(ecdh({ externalPubKey: 'provider-chat-key' })).rejects.toThrow(
      /Metalet wallet is locked/,
    )
    expect(topLevelEcdh).not.toHaveBeenCalled()
  })

  it('ecdh rejects malformed responses without a sharedSecret', async () => {
    const commonEcdh = vi.fn().mockResolvedValue({})
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    await expect(ecdh({ externalPubKey: 'provider-chat-key' })).rejects.toThrow(
      /Metalet ECDH response did not include a shared secret/,
    )
  })

  it('ecdh fails clearly when common.ecdh times out and top-level wallet.ecdh is unavailable', async () => {
    vi.useFakeTimers()
    const commonEcdh = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        ecdh: undefined,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    const pending = ecdh({ externalPubKey: 'provider-chat-key' })
    const rejection = expect(pending).rejects.toThrow(
      /Metalet common\.ecdh request timed out and top-level wallet\.ecdh API is unavailable/,
    )
    await vi.advanceTimersByTimeAsync(METALET_ECDH_RESPONSE_TIMEOUT_MS)

    await rejection
  })

  it('ecdh does not fall back when common.ecdh explicitly rejects', async () => {
    const commonEcdh = vi.fn().mockRejectedValue(new Error('user rejected'))
    const topLevelEcdh = vi.fn().mockResolvedValue({ sharedSecret: 'top-level-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        ecdh: topLevelEcdh,
        common: {
          ecdh: commonEcdh,
        },
      },
    })

    await expect(ecdh({ externalPubKey: 'provider-chat-key' })).rejects.toThrow(/user rejected/)
    expect(topLevelEcdh).not.toHaveBeenCalled()
  })

  it('throws MetaletNotInstalledError when extension missing', async () => {
    delete (window as Window & { metaidwallet?: unknown }).metaidwallet
    await expect(getGlobalMetaid()).rejects.toBeInstanceOf(MetaletNotInstalledError)
    expect(isMetaletInstalled()).toBe(false)
  })
})
