import { useI18n as useVueI18n } from 'vue-i18n'
import type trMessages from '../locales/tr'

// tr mesaj şemasının tüm nokta-yollarının union'ı: "app.name" | "settings.theme" | "workspace.visibility.personal" | …
type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<typeof trMessages>

type BaseI18n = ReturnType<typeof useVueI18n>
// Aynı Composer; yalnızca t()'nin anahtar parametresi şema anahtarlarına daraltılır.
type TypedI18n = Omit<BaseI18n, 't'> & { t: (key: TranslationKey) => string }

// Tip-güvenli useI18n: t() yalnızca GEÇERLİ mesaj anahtarlarını kabul eder — geçersiz/typo
// anahtar artık gerçek bir DERLEME hatasıdır (vue-i18n'in izin veren string overload'unu kapatır).
// Çalışma zamanında aynı Composer nesnesi döner (spread yok → reaktivite/özellikler korunur);
// yalnızca t'nin TİPİ daraltılır. Bileşenler yalnızca import yolunu değiştirir; çağrı aynı kalır.
export function useI18n(): TypedI18n {
  return useVueI18n() as unknown as TypedI18n
}
