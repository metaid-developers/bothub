import { describe, expect, it } from 'vitest'
import { truncateGlobalMetaId } from '@/wallet/format'

describe('truncateGlobalMetaId', () => {
  it('truncates long gmids', () => {
    expect(truncateGlobalMetaId('idq1abcdefghijklmnop')).toBe('idq1ab…mnop')
  })

  it('returns short strings unchanged', () => {
    expect(truncateGlobalMetaId('short')).toBe('short')
  })

  it('returns em dash for empty input', () => {
    expect(truncateGlobalMetaId(undefined)).toBe('—')
  })
})
