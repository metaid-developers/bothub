import type { GlobalMetaidResult } from './types'

type ChainBlock = {
  address?: string
  globalMetaId?: string
}

/** Metalet extension returns nested `{ mvc, btc, doge }`; some builds use a flat shape. */
export function normalizeGlobalMetaidResponse(raw: unknown): GlobalMetaidResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid getGlobalMetaid response')
  }

  const o = raw as Record<string, unknown>

  if (o.mvc && typeof o.mvc === 'object') {
    const mvc = o.mvc as ChainBlock
    const btc = (o.btc ?? {}) as ChainBlock
    const doge = (o.doge ?? {}) as ChainBlock
    const globalMetaId = String(mvc.globalMetaId ?? '').trim()
    if (!globalMetaId) {
      throw new Error('Metalet did not return a valid globalMetaId')
    }
    return {
      globalMetaId,
      mvcAddress: String(mvc.address ?? ''),
      btcAddress: String(btc.address ?? ''),
      dogeAddress: String(doge.address ?? ''),
    }
  }

  const globalMetaId = String(o.globalMetaId ?? o.globalMetaid ?? '').trim()
  if (!globalMetaId) {
    throw new Error('Metalet did not return a valid globalMetaId')
  }

  return {
    globalMetaId,
    mvcAddress: String(o.mvcAddress ?? o.mvc ?? ''),
    btcAddress: String(o.btcAddress ?? o.btc ?? ''),
    dogeAddress: String(o.dogeAddress ?? o.doge ?? ''),
  }
}
