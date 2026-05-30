import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MetaletNotInstalledError,
  connect,
  ecdh,
  getGlobalMetaid,
  isMetaletInstalled,
} from '@/wallet/metalet'

const mockWallet = {
  connect: vi.fn().mockResolvedValue({}),
  disconnect: vi.fn(),
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

  it('connect delegates to window.metaidwallet', async () => {
    await connect()
    expect(mockWallet.connect).toHaveBeenCalledOnce()
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

  it('ecdh falls back to top-level wallet.ecdh when common.ecdh is unavailable', async () => {
    mockWallet.ecdh.mockResolvedValue({ sharedSecret: 'fallback-secret' })
    vi.stubGlobal('window', {
      ...window,
      metaidwallet: {
        ...mockWallet,
        common: {},
      },
    })

    const result = await ecdh({ externalPubKey: 'provider-chat-key', path: '/protocols/simplemsg' })

    expect(result.sharedSecret).toBe('fallback-secret')
    expect(mockWallet.ecdh).toHaveBeenCalledWith({
      externalPubKey: 'provider-chat-key',
      path: '/protocols/simplemsg',
    })
  })

  it('throws MetaletNotInstalledError when extension missing', async () => {
    delete (window as Window & { metaidwallet?: unknown }).metaidwallet
    await expect(getGlobalMetaid()).rejects.toBeInstanceOf(MetaletNotInstalledError)
    expect(isMetaletInstalled()).toBe(false)
  })
})
