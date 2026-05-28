import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MetaletNotInstalledError,
  connect,
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

  it('throws MetaletNotInstalledError when extension missing', async () => {
    delete (window as Window & { metaidwallet?: unknown }).metaidwallet
    await expect(getGlobalMetaid()).rejects.toBeInstanceOf(MetaletNotInstalledError)
    expect(isMetaletInstalled()).toBe(false)
  })
})
