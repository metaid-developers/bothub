import { beforeEach, describe, expect, it } from 'vitest'
import { getLanguage, resetLanguageForTests, setLanguage, t } from '@/i18n'

describe('i18n', () => {
  beforeEach(() => {
    resetLanguageForTests()
  })

  it('resolves nested keys from the default English map', () => {
    expect(getLanguage()).toBe('en-US')
    expect(t('nav.botHub')).toBe('Bot Hub')
    expect(t('wallet.connect')).toBe('Connect wallet')
    expect(t('hub.noServicesTitle')).toBe('No services found')
  })

  it('switches to zh-CN and persists the selection', () => {
    setLanguage('zh-CN')

    expect(getLanguage()).toBe('zh-CN')
    expect(t('nav.botHub')).toBe('服务广场')
    expect(t('wallet.connect')).toBe('连接钱包')
    expect(localStorage.getItem('bothub.language')).toBe('zh-CN')
  })

  it('returns key path for missing entries', () => {
    expect(t('missing.key' as 'nav.botHub')).toBe('missing.key')
  })
})
