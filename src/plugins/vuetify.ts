import 'vuetify/styles'
import '../styles/mdi.scss' // MDI ikon fontu — yalnızca woff2 (bkz. mdi.scss)
import { createVuetify, type ThemeDefinition } from 'vuetify'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { useI18n } from 'vue-i18n'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
// Bileşen ve direktifler artık "vite-plugin-vuetify" (autoImport) tarafından yalnızca
// kullanıldıkları yerde içe aktarılır (tree-shaking) — bkz. electron.vite.config.ts.
import { i18n } from './i18n'

// Material Design 3 tabanlı özgün tema: koyu "obsidian" ana renk + amber accent.
// on-*: okuma yüzeylerinin metin/ikon rengi (kontrast kontrolü). surface-bright/light: yükseltilmiş
// yüzeyler (yeni Vuetify bileşenleri kullanır). Accent on-renkleri (on-primary vb.) Vuetify'ye
// otomatik hesaplatılır (buton/çip metni regresyonunu önlemek için).
const antiphonLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F7F7FA',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#F0F0F5',
    'surface-variant': '#E8E8EF',
    'on-background': '#0E0E14',
    'on-surface': '#0E0E14',
    'on-surface-variant': '#55555F',
    primary: '#4F46E5',
    'primary-darken-1': '#3730A3',
    secondary: '#0EA5A4',
    'secondary-darken-1': '#0B7F7E',
    error: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
    success: '#16A34A',
    'method-get': '#16A34A',
    'method-post': '#D97706',
    'method-put': '#2563EB',
    'method-delete': '#DC2626',
    'method-patch': '#7C3AED'
  },
  variables: {
    'border-color': '#000000',
    'border-opacity': 0.08
  }
}

const antiphonDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#131318',
    surface: '#1C1C24',
    'surface-bright': '#2A2A34',
    'surface-light': '#26262F',
    'surface-variant': '#26262F',
    'on-background': '#FFFFFF',
    'on-surface': '#FFFFFF',
    'on-surface-variant': '#B4B4C0',
    primary: '#818CF8',
    'primary-darken-1': '#6366F1',
    secondary: '#2DD4BF',
    'secondary-darken-1': '#14B8A6',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    success: '#4ADE80',
    'method-get': '#4ADE80',
    'method-post': '#FBBF24',
    'method-put': '#60A5FA',
    'method-delete': '#F87171',
    'method-patch': '#C4B5FD'
  },
  variables: {
    'border-color': '#FFFFFF',
    'border-opacity': 0.1
  }
}

// Yüksek kontrast (WCAG) varyantları: saf siyah/beyaz zeminler, maksimum kontrast metin,
// güçlü kenarlıklar ve daha doygun/erişilebilir accent renkleri. OS "prefers-contrast: more"
// veya Ayarlar'dan seçilir (açık/koyu ekseninden bağımsız).
const antiphonHcDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#000000',
    surface: '#000000',
    'surface-bright': '#1A1A1A',
    'surface-light': '#141414',
    'surface-variant': '#161616',
    'on-background': '#FFFFFF',
    'on-surface': '#FFFFFF',
    'on-surface-variant': '#EDEDED',
    primary: '#B8C0FF',
    'primary-darken-1': '#9AA5FF',
    secondary: '#5EEAD4',
    'secondary-darken-1': '#2DD4BF',
    error: '#FF9A9A',
    warning: '#FFD24D',
    info: '#93C5FD',
    success: '#86EFAC',
    'method-get': '#86EFAC',
    'method-post': '#FFD24D',
    'method-put': '#93C5FD',
    'method-delete': '#FF9A9A',
    'method-patch': '#D8CCFF'
  },
  variables: {
    'border-color': '#FFFFFF',
    'border-opacity': 0.55,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 0.87,
    'disabled-opacity': 0.55
  }
}

const antiphonHcLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#F2F2F2',
    'surface-variant': '#EAEAEA',
    'on-background': '#000000',
    'on-surface': '#000000',
    'on-surface-variant': '#1A1A1A',
    primary: '#2C22B8',
    'primary-darken-1': '#1E1580',
    secondary: '#046B6A',
    'secondary-darken-1': '#034E4D',
    error: '#B91C1C',
    warning: '#92540A',
    info: '#1D4ED8',
    success: '#15803D',
    'method-get': '#15803D',
    'method-post': '#92540A',
    'method-put': '#1D4ED8',
    'method-delete': '#B91C1C',
    'method-patch': '#5B21B6'
  },
  variables: {
    'border-color': '#000000',
    'border-opacity': 0.55,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 0.87,
    'disabled-opacity': 0.55
  }
}

// Tüm buton varyantlarının paylaştığı taban görünüm (yuvarlaklık + text-none).
const BTN_BASE = { rounded: 'lg', class: 'text-none' } as const

export const vuetify = createVuetify({
  // Vuetify'nin dahili bileşen metinlerini uygulama diline (vue-i18n) bağlar.
  // numberFormats/datetimeFormats i18n'in generic tipini daraltır; adapter gevşek bir
  // I18n tipi beklediğinden burada tip köprüsü (cast) gerekir — çalışma davranışı aynıdır.
  locale: {
    adapter: createVueI18nAdapter({ i18n: i18n as Parameters<typeof createVueI18nAdapter>[0]['i18n'], useI18n })
  },
  // Açık ikon yapılandırması (varsayılana güvenmek yerine): MDI font seti + Vuetify'nin dahili
  // bileşen ikon takma adları ($dropdown, $next…) + uygulamaya özgü semantik takma adlar.
  // Semantik ad kullanımı (icon="$collection") ikonu tek yerden değiştirilebilir kılar.
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      collection: 'mdi-folder-multiple-outline',
      folder: 'mdi-folder-outline',
      request: 'mdi-file-code-outline',
      send: 'mdi-send-variant-outline',
      environment: 'mdi-layers-triple-outline',
      history: 'mdi-history'
    },
    sets: { mdi }
  },
  theme: {
    defaultTheme: 'antiphonDark',
    themes: {
      antiphonLight,
      antiphonDark,
      antiphonHcLight,
      antiphonHcDark
    }
  },
  // Component aliases: sık tekrar eden buton/kart varyantlarını ön-ayarlı bileşenler olarak sunar.
  // Kullanım: <VBtnPrimary>Kaydet</VBtnPrimary> — color/variant prop'larını tekrar etmeden.
  aliases: {
    VBtnPrimary: VBtn,
    VBtnText: VBtn,
    VBtnTonal: VBtn,
    VCardTonal: VCard
  },
  // Kurumsal tutarlılık için global bileşen varsayılanları — bileşenlerdeki tekrarları azaltır.
  defaults: {
    global: { ripple: true },
    VBtn: BTN_BASE,
    // Alias'lar taban VBtn görünümünü (rounded/text-none) devralsın diye BTN_BASE yayılır.
    VBtnPrimary: { ...BTN_BASE, color: 'primary', variant: 'flat' },
    VBtnText: { ...BTN_BASE, variant: 'text' },
    VBtnTonal: { ...BTN_BASE, variant: 'tonal' },
    VCard: { rounded: 'lg', elevation: 0 },
    VCardTonal: { rounded: 'lg', elevation: 0, variant: 'tonal' },
    // MD3: standart metin alanı "filled" — çerçeve yerine tonal dolgu + focus'ta primary alt gösterge.
    VTextField: { variant: 'filled', density: 'compact', hideDetails: 'auto' },
    VTextarea: { variant: 'filled', density: 'compact', hideDetails: 'auto' },
    VSelect: { variant: 'filled', density: 'compact', hideDetails: 'auto' },
    VAutocomplete: { variant: 'filled', density: 'compact', hideDetails: 'auto' },
    VCombobox: { variant: 'filled', density: 'compact', hideDetails: 'auto' },
    // MD3 segmented button: çerçevesiz tonal segmentler, aralarında ince ayraç.
    VBtnToggle: { variant: 'tonal', divided: true, rounded: 'lg' },
    // MD3 seçim kontrolleri: standart vurgu rengi PRIMARY (bileşen başına tekrar gerekmez).
    VSwitch: { color: 'primary' },
    VCheckbox: { color: 'primary' },
    VCheckboxBtn: { color: 'primary' },
    VRadioGroup: { color: 'primary' },
    VRadio: { color: 'primary' },
    VSlider: { color: 'primary' },
    // MD3 primary tabs: aktif sekme primary renkte metin + gösterge.
    VTabs: { density: 'compact', color: 'primary' },
    // Tüm tablolar: sıkışık yoğunluk + satır hover geri bildirimi.
    VTable: { density: 'compact', hover: true },
    VList: { density: 'compact' },
    VChip: { size: 'small' },
    VTooltip: { location: 'top' },
    VMenu: { location: 'bottom' },
    VProgressCircular: { color: 'primary' },
    VProgressLinear: { color: 'primary' },
    VAlert: { variant: 'tonal' }
  }
})
