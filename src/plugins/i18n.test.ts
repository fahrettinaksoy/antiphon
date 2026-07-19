import { afterAll, describe, expect, it } from 'vitest'
import { i18n } from './i18n'

// Locale-duyarlı sayı biçimlendirmesinin (Intl) doğru ayraçları kullandığını doğrular.
describe('i18n locale-aware number formatting', () => {
  afterAll(() => {
    i18n.global.locale.value = 'tr'
  })

  it('uses Turkish separators (comma decimal, dot thousands) in tr', () => {
    i18n.global.locale.value = 'tr'
    expect(i18n.global.n(12.5, 'decimal')).toBe('12,5')
    expect(i18n.global.n(1234, 'integer')).toBe('1.234')
  })

  it('uses English separators (dot decimal, comma thousands) in en', () => {
    i18n.global.locale.value = 'en'
    expect(i18n.global.n(12.5, 'decimal')).toBe('12.5')
    expect(i18n.global.n(1234, 'integer')).toBe('1,234')
  })

  it('pads decimal to one fraction digit regardless of locale', () => {
    i18n.global.locale.value = 'en'
    expect(i18n.global.n(2, 'decimal')).toBe('2.0')
    i18n.global.locale.value = 'tr'
    expect(i18n.global.n(2, 'decimal')).toBe('2,0')
  })
})
