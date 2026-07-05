import { describe, it, expect } from 'vitest'
import tr from './tr'
import en from './en'

// Bir mesaj nesnesinin tüm yaprak anahtarlarını "a.b.c" biçiminde düz listeye çevirir.
function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

// Enterprise güvence: iki dil AYNI anahtar kümesine sahip olmalı — eksik/fazla çeviri CI'da yakalanır.
describe('locale key parity (tr ⇄ en)', () => {
  const trKeys = new Set(flatKeys(tr))
  const enKeys = new Set(flatKeys(en))

  it('has no keys present in tr but missing in en', () => {
    const missingInEn = [...trKeys].filter((k) => !enKeys.has(k)).sort()
    expect(missingInEn, `en'de eksik: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('has no keys present in en but missing in tr', () => {
    const missingInTr = [...enKeys].filter((k) => !trKeys.has(k)).sort()
    expect(missingInTr, `tr'de eksik: ${missingInTr.join(', ')}`).toEqual([])
  })
})
