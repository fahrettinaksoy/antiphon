// Bölge-bazlı Vuetify default "preset"leri — <v-defaults-provider> ile alt-ağaçlara uygulanır.
// Bunlar createVuetify'daki GLOBAL defaults ile BİRLEŞİR (merge); yalnızca override edilen
// alanları belirtmek yeterlidir (ör. variant/hideDetails global'den gelmeye devam eder).
//
// Kullanım: <AppDefaults preset="dialogForm"> … </AppDefaults>  (bkz. AppDefaults.vue)
import type { DefaultsInstance } from 'vuetify'

// Modal/dialog formları: yoğun inline UI'ın aksine daha ferah (comfortable) alanlar.
const dialogForm: DefaultsInstance = {
  VTextField: { density: 'comfortable' },
  VTextarea: { density: 'comfortable' },
  VSelect: { density: 'comfortable' },
  VAutocomplete: { density: 'comfortable' },
  VCombobox: { density: 'comfortable' },
  VFileInput: { density: 'comfortable' }
}

// Başlık/araç çubuğu bölgeleri: küçük, düz (text) ikon butonları.
const toolbar: DefaultsInstance = {
  VBtn: { size: 'small', variant: 'text' }
}

// Yoğun listeler/paneller: daha da sıkışık.
const dense: DefaultsInstance = {
  VBtn: { size: 'x-small', variant: 'text' },
  VList: { density: 'compact' },
  VListItem: { minHeight: 28 }
}

export const defaultsPresets = { dialogForm, toolbar, dense }
export type DefaultsPresetName = keyof typeof defaultsPresets
