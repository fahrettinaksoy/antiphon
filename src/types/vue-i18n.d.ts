// vue-i18n global mesaj şeması — RAW vue-i18n kullanan yerlerde (ör. adapter) IDE otomatik
// tamamlama/çıkarım sağlar. Uygulama bileşenlerinde SERT compile-time anahtar denetimi
// `@/composables/i18n`'deki tip-güvenli useI18n sarmalayıcısı ile yapılır (geçersiz anahtar
// = derleme hatası). Diller arası eksik anahtar denetimi ise parity.test.ts + `missing` handler.
import 'vue-i18n'
import type trMessages from '../locales/tr'

type MessageSchema = typeof trMessages

declare module 'vue-i18n' {
  // Global mesaj şeması — useI18n() içindeki t() bunu kullanır.
  export interface DefineLocaleMessage extends MessageSchema {}
}
