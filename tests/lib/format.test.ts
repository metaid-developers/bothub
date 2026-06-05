import { describe, expect, it } from 'vitest'
import { formatPrice } from '@/lib/format'
import { resetLanguageForTests } from '@/i18n'

describe('formatPrice', () => {
  it('labels zero-value prices as free in the active language without a currency', () => {
    resetLanguageForTests('zh-CN')
    expect(formatPrice('0', 'SPACE')).toEqual({ amount: '免费', currency: '' })
    expect(formatPrice(' 0.00 ', 'BTC')).toEqual({ amount: '免费', currency: '' })

    resetLanguageForTests('en-US')
    expect(formatPrice('0', 'DEMO-MRC20')).toEqual({ amount: 'Free', currency: '' })
  })

  it('keeps non-zero price amounts and normalizes MVC to SPACE', () => {
    resetLanguageForTests('en-US')
    expect(formatPrice('1.25', 'mvc')).toEqual({ amount: '1.25', currency: 'SPACE' })
  })
})
