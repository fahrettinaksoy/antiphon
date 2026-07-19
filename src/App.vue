<script setup lang="ts">
import { usePreferredContrast, usePreferredDark } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useI18n } from '@/composables/i18n'
import { ipc } from '@/lib/ipc'
import GitPanel from './components/layout/GitPanel.vue'
import HistoryPanel from './components/layout/HistoryPanel.vue'
import MockServerDialog from './components/layout/MockServerDialog.vue'
import TopAppBar from './components/layout/TopAppBar.vue'
import CommandPalette from './components/palette/CommandPalette.vue'
import ActivityBar from './components/sidebar/ActivityBar.vue'
import SidebarPanel from './components/sidebar/SidebarPanel.vue'
import CreateWorkspaceDialog from './components/workspace/CreateWorkspaceDialog.vue'
import SaveRequestDrawer from './components/workspace/SaveRequestDrawer.vue'
import { setAppLocale } from './plugins/i18n'
import { useHistoryStore } from './stores/history'
import { useTabsStore } from './stores/tabs'
import { useUiStore } from './stores/ui'
import { useWorkspacesStore } from './stores/workspaces'

const theme = useTheme()
const router = useRouter()
const uiStore = useUiStore()
const workspacesStore = useWorkspacesStore()
const tabsStore = useTabsStore()
const historyStore = useHistoryStore()
const { locale } = useI18n()

// Kalıcı uygulama kabuğu: app bar her rotada; sol gezinme YALNIZCA çalışma alanı
// rotasında. "Çalışma Alanları" ve "Ayarlar" genel sayfalardır — sol panel taşımaz.
const drawerAllowed = computed(() => router.currentRoute.value.path === '/')
const drawerVisible = computed(() => drawerAllowed.value && uiStore.sidebarVisible)

// Geçmişten bir isteği yeni sekmede aç; başka bir sayfadaysak çalışma alanına dön.
function replayHistoryEntry(entryId: string) {
  const entry = historyStore.entries.find((e) => e.id === entryId)
  if (!entry) return
  const newTab = tabsStore.openNewTab(entry.requestName)
  newTab.method = entry.method as typeof newTab.method
  newTab.url = entry.url
  newTab.headers = entry.headers
  newTab.params = entry.params
  if (entry.body) newTab.body = entry.body
  if (entry.auth) newTab.auth = entry.auth
  if (router.currentRoute.value.path !== '/') router.push('/')
}

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
watch(prefersContrast, (v) => uiStore.setSystemPrefersMoreContrast(v === 'more'), {
  immediate: true
})

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
      themeTransitionTimer = setTimeout(
        () => root.classList.remove('antiphon-theme-transition'),
        240
      )
    }
    theme.change(name)
  },
  { immediate: true }
)

onMounted(async () => {
  const info = await ipc.getAppInfo()
  uiStore.setPlatform(info.platform)
  // Her zaman bir çalışma alanı açık olsun: varsayılan "My Workspace" yoksa oluşturulur.
  await workspacesStore.init()
})
</script>

<template>
  <v-app>
    <!-- Kalıcı kabuk: üst bar ve sol gezinme her rotada (Ayarlar, Çalışma Alanları…) görünür.
         macOS trafik ışıkları ayrı bir şerit yerine app bar'ın sol boşluğuna oturur. -->
    <TopAppBar />
    <!-- MD3: kenar çubuğu border ile değil tonal yüzey (surface-light) ile ayrılır.
         v-if: hamburger ile gizlenebilir; Çalışma Alanları sayfasında hiç yer almaz. -->
    <v-navigation-drawer
      v-if="drawerVisible"
      permanent
      width="348"
      color="surface-light"
      class="antiphon-sidebar-drawer"
    >
      <div class="d-flex h-100">
        <ActivityBar />
        <SidebarPanel @replay="replayHistoryEntry" />
      </div>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>

    <v-navigation-drawer v-model="uiStore.historyDrawerOpen" location="right" width="440" temporary>
      <HistoryPanel @replay="replayHistoryEntry" />
    </v-navigation-drawer>

    <v-navigation-drawer v-model="uiStore.gitDrawerOpen" location="right" width="440" temporary>
      <GitPanel />
    </v-navigation-drawer>

    <MockServerDialog v-model="uiStore.mockServerDialogOpen" />
    <SaveRequestDrawer />
    <CommandPalette />
    <CreateWorkspaceDialog v-model="uiStore.createWorkspaceDialogOpen" />
  </v-app>
</template>
