import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'

// Kod stili kuralları @antfu'dan; BİÇİMLENDİRME Prettier'e devredildi
// (`stylistic: false`). ESLint = kod kalitesi/kurallar, Prettier = biçim.
// `eslint-config-prettier` en sonda çakışan tüm biçim kurallarını kapatır.
export default antfu({
  vue: true,
  typescript: true,

  // Biçimlendirmeyi Prettier yapar; antfu'nun stylistic kurallarını kapat.
  stylistic: false,

  // Biçimlendiriciler kapalı: markdown/toml/yaml dosyaları bu kuralların dışında.
  markdown: false,
  yaml: false,
  toml: false,
  jsonc: false,

  ignores: ['dist', 'out', 'coverage', 'src-tauri/target', 'src-tauri/gen', '**/*.d.ts']
})
  .append(prettier)
  .append({
    rules: {
      // Bileşenler arası olay adları BİLİNÇLİ kebab-case (@new-http, @new-collection…);
      // camelCase'e çevirmek tüm ebeveyn dinleyicilerini kırardı — kural kapatıldı.
      'vue/custom-event-name-casing': 'off'
    }
  })
