<script setup lang="ts">
import { useTheme } from 'vuetify'
import { onMounted, watch } from 'vue'
import { usePreferredDark, usePreferredContrast } from '@vueuse/core'
import { useI18n } from '@/composables/i18n'
import { setAppLocale } from './plugins/i18n'
import { useUiStore } from './stores/ui'
import { useWorkspacesStore } from './stores/workspaces'
import CommandPalette from './components/palette/CommandPalette.vue'
import CreateWorkspaceDialog from './components/workspace/CreateWorkspaceDialog.vue'

const theme = useTheme()
const uiStore = useUiStore()
const workspacesStore = useWorkspacesStore()
const { t, locale } = useI18n()

// Dil tek kaynak: uiStore.locale → (gerekiyorsa lazy yükle) → i18n. Başlangıçta persist edilen
// dil (varsayılan dışındaysa) burada yüklenir.
watch(
  () => uiStore.locale,
  (loc) => {
    void setAppLocale(loc)
  },
  { immediate: true }
)

// Aktif i18n dilini <html lang> ile senkronla — erişilebilirlik/SEO ve doğru Intl/okuyucu davranışı için.
// (tr/en LTR; RTL diller Vuetify tarafından v-application seviyesinde yönetilir.)
watch(
  locale,
  (loc) => {
    document.documentElement.lang = loc
  },
  { immediate: true }
)

// OS koyu tema + yüksek kontrast tercihlerini canlı izle → 'system' modunda tema anında güncellenir.
const prefersDark = usePreferredDark()
watch(prefersDark, (v) => uiStore.setSystemPrefersDark(v), { immediate: true })
const prefersContrast = usePreferredContrast()
watch(prefersContrast, (v) => uiStore.setSystemPrefersMoreContrast(v === 'more'), { immediate: true })

// Efektif tema (themeName getter'ı; tercih + OS'e göre çözülür) → Vuetify'e uygula.
let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => uiStore.themeName,
  (name, previous) => {
    // İlk uygulamada (previous yok) animasyon yok; yalnızca gerçek geçişlerde yumuşat.
    if (previous) {
      const root = document.documentElement
      root.classList.add('antiphon-theme-transition')
      clearTimeout(themeTransitionTimer)
      themeTransitionTimer = setTimeout(() => root.classList.remove('antiphon-theme-transition'), 240)
    }
    theme.change(name)
  },
  { immediate: true }
)

onMounted(async () => {
  const info = await window.antiphon.getAppInfo()
  uiStore.setPlatform(info.platform)
  // Her zaman bir çalışma alanı açık olsun: varsayılan "My Workspace" yoksa oluşturulur.
  await workspacesStore.init()
})
</script>

<template>
  <v-app>
    <!-- macOS'ta trafik ışıkları (kırmızı/sarı/yeşil) kendi ince şeridinde durur; asıl araç
         çubukları bunun altında ayrı bir satır olarak yer alır, Vuetify'nin app-bar yığınlama
         sistemi sayesinde her rota kendi v-main dolgusunu otomatik alır. -->
    <v-app-bar
      v-if="uiStore.needsTrafficLightInset"
      :elevation="0"
      height="36"
      class="antiphon-native-titlebar"
    >
      <span class="antiphon-native-titlebar__title">{{ t('app.name') }}</span>
    </v-app-bar>

    <router-view />
    <CommandPalette />
    <CreateWorkspaceDialog v-model="uiStore.createWorkspaceDialogOpen" />
  </v-app>
</template>

<style scoped>
.antiphon-native-titlebar {
  -webkit-app-region: drag;
}
.antiphon-native-titlebar :deep(.v-toolbar__content) {
  padding-left: 78px;
}
.antiphon-native-titlebar__title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 0.6;
}
</style>
