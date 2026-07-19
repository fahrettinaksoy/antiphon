import { resolve } from 'node:path'
import process from 'node:process'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    // autoImport: yalnızca şablonlarda kullanılan Vuetify bileşen/direktiflerini içe aktarır;
    // her bileşen kendi DERLENMİŞ CSS'ini getirir (CSS tree-shaking korunur).
    vuetify({ autoImport: true })
  ],

  resolve: {
    alias: {
      '@': resolve('src'),
      '@shared': resolve('shared'),
      '@schema': resolve('packages/schema/src'),
      '@runtime': resolve('packages/runtime/src')
    }
  },

  // MDI'nın eski SCSS'i (@import + global built-in) kaçınılmaz deprecation uyarıları üretir;
  // bunları susturarak build çıktısını temiz tutar (davranış değişmez).
  css: {
    preprocessorOptions: {
      scss: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin'] }
    }
  },

  /**
   * Tauri hedefi SABİT bir WebView'dir — tarayıcı pazarı değil.
   *   - macOS/iOS : WKWebView   (tauri.conf minimumSystemVersion 10.15 → Safari 13)
   *   - Windows   : WebView2    (Chromium; Tauri asgarisi Chrome 105)
   *   - Linux     : WebKitGTK
   * Tauri'nin resmî vite şablonuyla aynı değerler. TAURI_ENV_* değişkenlerini Tauri CLI enjekte eder.
   */
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  },

  // Tauri geliştirmesi için ayarlar (yalnız `tauri dev`/`tauri build` sırasında geçerli)
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
}))
