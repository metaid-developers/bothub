import { describe, expect, it } from 'vitest'
import { normalizeGlobalMetaidResponse } from '@/wallet/normalizeGlobalMetaid'

describe('normalizeGlobalMetaidResponse', () => {
  it('normalizes Metalet nested mvc/btc/doge shape', () => {
    expect(
      normalizeGlobalMetaidResponse({
        mvc: { address: '1MvcAddr', globalMetaId: 'idq1mvcglobal' },
        btc: { address: 'bc1qtest', globalMetaId: 'idq1btcglobal' },
        doge: { address: 'Ddoge', globalMetaId: 'idq1dogeglobal' },
      }),
    ).toEqual({
      globalMetaId: 'idq1mvcglobal',
      mvcAddress: '1MvcAddr',
      btcAddress: 'bc1qtest',
      dogeAddress: 'Ddoge',
    })
  })

  it('normalizes flat legacy shape', () => {
    expect(
      normalizeGlobalMetaidResponse({
        globalMetaId: 'idq1flat',
        mvcAddress: '1Mvc',
        btcAddress: 'bc1',
        dogeAddress: 'D',
      }),
    ).toEqual({
      globalMetaId: 'idq1flat',
      mvcAddress: '1Mvc',
      btcAddress: 'bc1',
      dogeAddress: 'D',
    })
  })

  it('throws when globalMetaId missing', () => {
    expect(() =>
      normalizeGlobalMetaidResponse({ mvc: { address: '1' } }),
    ).toThrow(/globalMetaId/)
  })
})
