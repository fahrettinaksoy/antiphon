import { useI18n } from 'vue-i18n'

// Locale-duyarlı biçimlendirme yardımcıları — tüm sayı/süre/tarih çıktıları uygulama diline uyar.
// vue-i18n'in n()/d()'sini (i18n.ts'teki numberFormats/datetimeFormats) merkezi bir yerde sarar,
// böylece bileşenlerde ham .toFixed()/.toLocale*String() tekrarları kalmaz.
export function useFormat() {
  const { n, d, locale } = useI18n()

  // Göreli zaman (locale-duyarlı): "5 saniye önce" / "5 seconds ago", "dün" / "yesterday".
  function relative(ts: number): string {
    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
    const diffSec = Math.round((ts - Date.now()) / 1000)
    const abs = Math.abs(diffSec)
    if (abs < 60) return rtf.format(diffSec, 'second')
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
    if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
    if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
    return rtf.format(Math.round(diffSec / 31536000), 'year')
  }

  return {
    relative,
    // Tam sayı ms süre (binlik ayraçlı): TR "1.234" / EN "1,234"
    ms: (value: number) => `${n(Math.round(value), 'integer')} ms`,
    // 1 ondalıklı ms: TR "12,5" / EN "12.5"
    msDecimal: (value: number) => `${n(value, 'decimal')} ms`,
    // Boyut (KB, 1 ondalık): TR "1,5 KB" / EN "1.5 KB"
    kb: (bytes: number) => `${n(bytes / 1024, 'decimal')} KB`,
    // Saat (locale-duyarlı): epoch ms veya Date
    time: (ts: number | Date) => d(ts, 'time'),
    // Tarih (locale-duyarlı)
    date: (ts: number | Date) => d(ts, 'date'),
    // Tarih + saat
    datetime: (ts: number | Date) => d(ts, 'datetime')
  }
}
