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
    // autoImport: yalnızca şablonlarda kullanılan Vuetify bileşen/direktiflerini içe aktarır
    // (JS tree-shaking). styles.configFile: stilleri SASS kaynağından derleyerek kullanılmayan
    // bileşen stillerini de tree-shake eder + SASS değişken özelleştirmesi sağlar.
    plugins: [
      vue(),
      vuetify({ autoImport: true, styles: { configFile: resolve('src/styles/vuetify-settings.scss') } })
    ]
  }
})
