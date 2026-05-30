import { describe, expect, it } from 'vitest'
import {
  buildAssetId,
  buildOrderId,
  buildSessionId,
  normalizeOrderCorrelationId,
} from '@/delivery/domain'

describe('delivery domain helpers', () => {
  it('builds deterministic session ids from wallet, provider, and order correlation', () => {
    expect(
      buildSessionId({
        walletGlobalMetaId: 'idq-user',
        providerGlobalMetaId: 'idq-provider',
        orderCorrelationId: 'abc',
      }),
    ).toBe('idq-user:idq-provider:abc')
  })

  it('builds deterministic order ids from wallet, provider, and order correlation', () => {
    expect(buildOrderId('idq-user', 'idq-provider', 'abc')).toBe(
      'idq-user:idq-provider:abc',
    )
  })

  it('builds deterministic asset ids from session and uri', () => {
    expect(buildAssetId('idq-user:idq-provider:abc', 'metafile://pin.png')).toBe(
      'idq-user:idq-provider:abc:metafile://pin.png',
    )
  })

  it('normalizes order correlation ids by trimming user and protocol values', () => {
    expect(normalizeOrderCorrelationId('  abc  ')).toBe('abc')
  })

  it('uses a stable fallback for empty or nullish order correlation ids', () => {
    expect(normalizeOrderCorrelationId('   ')).toBe('uncorrelated')
    expect(normalizeOrderCorrelationId(null)).toBe('uncorrelated')
    expect(normalizeOrderCorrelationId(undefined)).toBe('uncorrelated')
  })
})
