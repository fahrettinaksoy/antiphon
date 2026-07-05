<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useRouter } from 'vue-router'
import { useUiStore } from '../../stores/ui'
import { useWorkspaceStore } from '../../stores/workspace'
import EnvSelector from '../sidebar/EnvSelector.vue'
import WorkspaceMenu from '../workspace/WorkspaceMenu.vue'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()

const snackbar = ref<{ open: boolean; text: string }>({ open: false, text: '' })

// Dil tek kaynak: uiStore.locale. App.vue izleyicisi lazy yükleyip i18n'e uygular.
function toggleLocale() {
  uiStore.setLocale(uiStore.locale === 'tr' ? 'en' : 'tr')
}

function goHome() {
  uiStore.setSidebarSection('collections')
  if (router.currentRoute.value.path !== '/') router.push('/')
}

function showResult(kind: string, result: { importedCount: number; skipped: string[] }) {
  const skippedText = result.skipped.length > 0 ? `, ${result.skipped.length} atlandı` : ''
  snackbar.value = { open: true, text: `${kind}: ${result.importedCount} istek içe aktarıldı${skippedText}` }
}

async function importPostman() {
  if (!workspaceStore.rootPath) return
  const result = await window.antiphon.importPostmanCollection(workspaceStore.rootPath)
  showResult('Postman', result)
}

async function importOpenapi() {
  if (!workspaceStore.rootPath) return
  const result = await window.antiphon.importOpenapiSpec(workspaceStore.rootPath)
  showResult('OpenAPI', result)
}
</script>

<template>
  <v-app-bar :elevation="0" density="compact" height="52" class="px-2 antiphon-app-bar">
    <template #prepend>
      <v-icon icon="mdi-vector-triangle" size="22" class="mx-2" color="primary" />
      <span class="text-subtitle-1 font-weight-bold mr-4 text-uppercase antiphon-brand">{{ t('app.name') }}</span>
    </template>

    <!-- Sol gezinme bağlantıları (Postman: Home / Workspaces / API Network / Explore) -->
    <nav class="antiphon-nav">
      <v-btn variant="text" size="small" class="text-none antiphon-nav__link" @click="goHome">
        {{ t('header.home') }}
      </v-btn>

      <WorkspaceMenu />

      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            size="small"
            append-icon="mdi-chevron-down"
            class="text-none antiphon-nav__link"
            :disabled="!workspaceStore.isOpen"
          >
            {{ t('header.import') }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item prepend-icon="mdi-application-braces-outline" @click="importPostman">
            <v-list-item-title>Postman Collection (v2.1)</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-file-code-outline" @click="importOpenapi">
            <v-list-item-title>OpenAPI 3.x Spec</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-btn variant="text" size="small" class="text-none antiphon-nav__link" @click="uiStore.openCommandPalette">
        {{ t('header.explore') }}
      </v-btn>
    </nav>

    <v-spacer />

    <!-- Ortada belirgin arama kutusu (komut paletini açar) -->
    <button type="button" class="antiphon-search" @click="uiStore.openCommandPalette">
      <v-icon icon="mdi-magnify" size="18" class="antiphon-search__icon" />
      <span class="antiphon-search__placeholder">{{ t('header.searchPlaceholder') }}</span>
      <kbd class="antiphon-kbd">⌘K</kbd>
    </button>

    <v-spacer />

    <!-- Sağ eylem kümesi -->
    <EnvSelector v-if="workspaceStore.isOpen" class="mr-2" />

    <div class="antiphon-icon-group mr-2">
      <v-btn v-if="workspaceStore.isOpen" icon="mdi-source-branch" variant="text" density="comfortable" size="small" title="Git" @click="uiStore.toggleGitDrawer" />
      <v-btn icon="mdi-history" variant="text" density="comfortable" size="small" :title="t('sidebar.history')" @click="uiStore.toggleHistoryDrawer" />
    </div>

    <v-divider vertical inset class="mx-1" />

    <div class="antiphon-icon-group ml-1">
      <v-btn
        :icon="uiStore.themeName === 'antiphonDark' ? 'mdi-weather-night' : 'mdi-weather-sunny'"
        variant="text"
        density="comfortable"
        size="small"
        title="Tema"
        @click="uiStore.toggleTheme"
      />
      <v-btn variant="text" density="comfortable" size="small" title="Dil" @click="toggleLocale">{{ uiStore.locale.toUpperCase() }}</v-btn>
      <v-btn icon="mdi-cog-outline" variant="text" density="comfortable" size="small" :title="t('settings.title')" @click="router.push('/settings')" />
    </div>
  </v-app-bar>

  <v-snackbar v-model="snackbar.open" :timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>

<style scoped>
/* Pencereyi bu bar üzerinden sürüklenebilir yap; tıklanabilir öğeler no-drag olarak işaretlenir. */
.antiphon-app-bar {
  -webkit-app-region: drag;
}
.antiphon-app-bar :deep(button),
.antiphon-app-bar :deep(input),
.antiphon-app-bar :deep(a) {
  -webkit-app-region: no-drag;
}
.antiphon-brand {
  letter-spacing: 0.04em;
}

/* Sol metin gezinme bağlantıları */
.antiphon-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.antiphon-nav__link {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Ortadaki arama kutusu (Postman "Search" alanı) */
.antiphon-search {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: min(420px, 34vw);
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: text;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.antiphon-search:hover {
  background: rgba(var(--v-theme-on-surface), 0.09);
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.antiphon-search__icon {
  opacity: 0.6;
}
.antiphon-search__placeholder {
  flex: 1 1 auto;
  text-align: left;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.55;
}

/* İlişkili ikon butonlarını tek bir "hap" (pill) konteynerde gruplar. */
.antiphon-icon-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.antiphon-icon-group :deep(.v-btn) {
  -webkit-app-region: no-drag;
}
.antiphon-kbd {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  opacity: 0.7;
}
</style>
