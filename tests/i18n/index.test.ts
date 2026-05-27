import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'

describe('i18n', () => {
  it('resolves nested keys from zh-CN map', () => {
    expect(t('nav.botHub')).toBe('Bot Hub')
    expect(t('wallet.connect')).toBe('连接钱包')
    expect(t('hub.noServicesTitle')).toBe('No services found')
  })

  it('returns key path for missing entries', () => {
    expect(t('missing.key' as 'nav.botHub')).toBe('missing.key')
  })
})
