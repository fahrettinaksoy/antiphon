import { createI18n } from 'vue-i18n'
// Vuetify'nin dahili bileşen metinleri `$vuetify` altında birleşir (createVueI18nAdapter).
import * as vuetifyLocales from 'vuetify/locale'
// Varsayılan (tr) EAGER yüklenir; diğer diller talep üzerine (lazy) yüklenir — bkz. loadLocaleMessages.
import tr from '../locales/tr'

export type AppLocale = 'tr' | 'en'
export const SUPPORTED_LOCALES: AppLocale[] = ['tr', 'en']
export const DEFAULT_LOCALE: AppLocale = 'tr'

// VARSAYILAN DIŞI dillerin lazy yükleyicileri — her biri ayrı bir chunk olur (başlangıç bundle'ı küçülür).
// tr (varsayılan) eager yüklendiği için burada yer almaz.
const messageLoaders: Partial<Record<AppLocale, () => Promise<{ default: typeof tr }>>> = {
  en: () => import('../locales/en')
}

// Locale-duyarlı SAYI biçimleri (küçük olduğu için statik). n('...', 'decimal') → TR "1,5" / EN "1.5".
const numberFormats = {
  tr: {
    integer: { style: 'decimal', maximumFractionDigits: 0 },
    decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }
  },
  en: {
    integer: { style: 'decimal', maximumFractionDigits: 0 },
    decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }
  }
} as const

// Locale-duyarlı TARİH/SAAT biçimleri — OS locale'i yerine UYGULAMA dilini kullanır.
const datetimeFormats = {
  tr: {
    time: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    date: { year: 'numeric', month: 'short', day: 'numeric' },
    datetime: { dateStyle: 'medium', timeStyle: 'short' }
  },
  en: {
    time: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    date: { year: 'numeric', month: 'short', day: 'numeric' },
    datetime: { dateStyle: 'medium', timeStyle: 'short' }
  }
} as const

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  // Fallback her zaman yüklü olan varsayılan dile — lazy dil yüklenene kadar eksik anahtar olmaz.
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    tr: { ...tr, $vuetify: vuetifyLocales.tr }
  },
  numberFormats,
  datetimeFormats,
  // Eksik çeviri anahtarlarını geliştirme sırasında bildir (enterprise sağlamlık).
  missing: (locale, key) => {
    if (import.meta.env.DEV) console.warn(`[i18n] Eksik çeviri: "${String(locale)}" → "${key}"`)
  }
})

const loaded = new Set<AppLocale>([DEFAULT_LOCALE])

// Bir dilin mesajlarını (uygulama + $vuetify) talep üzerine yükler ve i18n'e ekler.
export async function loadLocaleMessages(locale: AppLocale): Promise<void> {
  if (loaded.has(locale)) return
  const loader = messageLoaders[locale]
  if (!loader) return // yükleyici yoksa (ör. varsayılan dil) atla
  const mod = await loader()
  i18n.global.setLocaleMessage(locale, { ...mod.default, $vuetify: vuetifyLocales[locale] as typeof vuetifyLocales.tr })
  loaded.add(locale)
}

// Dili değiştir: gerekiyorsa lazy yükle, sonra aktif dili ata. Tek giriş noktası.
export async function setAppLocale(locale: AppLocale): Promise<void> {
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
}
