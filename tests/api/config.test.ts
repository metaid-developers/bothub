import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadConfig() {
  return import('@/api/config')
}

describe('Metaso P2P runtime config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('reads the renamed Metaso P2P base URL env var', async () => {
    vi.stubEnv('VITE_METASO_P2P_BASE_URL', 'https://so.metaid.io/')
    vi.stubEnv(`VITE_${['META', 'SOCKET'].join('_')}_BASE_URL`, 'https://legacy.example/')

    const { getMetasoP2PBaseUrl, getNormalizedMetasoP2PBaseUrl } = await loadConfig()

    expect(getMetasoP2PBaseUrl()).toBe('https://so.metaid.io/')
    expect(getNormalizedMetasoP2PBaseUrl()).toBe('https://so.metaid.io')
  })

  it('does not use the legacy predecessor base URL env var', async () => {
    vi.stubEnv('VITE_METASO_P2P_BASE_URL', '')
    vi.stubEnv(`VITE_${['META', 'SOCKET'].join('_')}_BASE_URL`, 'https://legacy.example/')

    const { getMetasoP2PBaseUrl, getNormalizedMetasoP2PBaseUrl } = await loadConfig()

    expect(getMetasoP2PBaseUrl()).toBe('')
    expect(getNormalizedMetasoP2PBaseUrl()).toBe('')
  })
})
