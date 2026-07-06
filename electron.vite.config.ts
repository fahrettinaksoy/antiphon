import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@schema': resolve('packages/schema/src'),
        '@runtime': resolve('packages/runtime/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve('electron/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@schema': resolve('packages/schema/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve('electron/preload/index.ts')
      }
    }
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('shared'),
        '@schema': resolve('packages/schema/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    // MDI'nın eski SCSS'i (@import + global built-in) kaçınılmaz deprecation uyarıları üretir;
    // bunları susturarak build çıktısını temiz tutar (davranış değişmez).
    css: {
      preprocessorOptions: {
        scss: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin'] }
      }
    },
    // autoImport: yalnızca şablonlarda kullanılan Vuetify bileşen/direktiflerini içe aktarır;
    // her bileşen kendi DERLENMİŞ CSS'ini getirir (CSS tree-shaking korunur).
    // NOT: styles.configFile (SASS kaynağından derleme) BİLİNÇLİ olarak kullanılmıyor —
    // sanal .sass modülleri Vite'ın bağımlılık önbelleğiyle kronik 404 üretiyordu
    // ("VBtn.sass 404" vb.); tek kazanımı $color-pack eleme optimizasyonuydu.
    plugins: [
      vue(),
      vuetify({ autoImport: true })
    ]
  }
})
