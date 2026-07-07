<script setup lang="ts">
// Çalışma alanı araç çubuğu — çalışma alanına ÖZEL kimlik ve eylemler burada yaşar
// (app bar globaldir): solda alan adı + görünürlük, sağda İçe Aktar, ortam seçici, Git, Geçmiş.
import { computed, ref } from 'vue'
import { ipc } from '@/lib/ipc'
import { useI18n } from '@/composables/i18n'
import { useRouter } from 'vue-router'
import { useUiStore } from '../../stores/ui'
import { useWorkspaceStore } from '../../stores/workspace'
import { useWorkspacesStore } from '../../stores/workspaces'
import EnvSelector from '../sidebar/EnvSelector.vue'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()
const workspacesStore = useWorkspacesStore()

const activeMeta = computed(() => workspacesStore.active)

function visibilityIcon(): string {
  switch (activeMeta.value?.type) {
    case 'internal':
      return 'mdi-account-multiple-outline'
    case 'public':
      return 'mdi-web'
    default:
      return 'mdi-lock-outline'
  }
}

const snackbar = ref<{ open: boolean; text: string }>({ open: false, text: '' })

function showResult(kind: string, result: { importedCount: number; skipped: string[] }) {
  const skippedText = result.skipped.length > 0 ? `, ${result.skipped.length} atlandı` : ''
  snackbar.value = { open: true, text: `${kind}: ${result.importedCount} istek içe aktarıldı${skippedText}` }
}

async function importPostman() {
  if (!workspaceStore.rootPath) return
  const result = await ipc.importPostmanCollection(workspaceStore.rootPath)
  showResult('Postman', result)
}

async function importOpenapi() {
  if (!workspaceStore.rootPath) return
  const result = await ipc.importOpenapiSpec(workspaceStore.rootPath)
  showResult('OpenAPI', result)
}
</script>

<template>
  <div class="antiphon-ws-toolbar d-flex align-center ga-2 px-3">
    <!-- Çalışma alanı kimliği: görünürlük ikonu + ad (tıklayınca alan listesi) -->
    <button type="button" class="antiphon-ws-toolbar__identity d-flex align-center ga-2" @click="router.push('/workspaces')">
      <v-icon :icon="visibilityIcon()" size="16" class="text-medium-emphasis" />
      <span class="text-body-2 font-weight-medium text-truncate">{{ activeMeta?.name ?? '—' }}</span>
      <v-icon icon="mdi-chevron-down" size="14" class="text-medium-emphasis" />
    </button>

    <v-spacer />

    <!-- Bağlam eylemleri -->
    <v-menu>
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" variant="text" size="small" prepend-icon="mdi-tray-arrow-down" class="text-none">
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

    <EnvSelector />

    <div class="antiphon-icon-group">
      <v-btn icon="mdi-source-branch" variant="text" density="comfortable" size="small" title="Git" @click="uiStore.toggleGitDrawer" />
      <v-btn
        icon="mdi-history"
        variant="text"
        density="comfortable"
        size="small"
        :title="t('sidebar.history')"
        @click="uiStore.toggleHistoryDrawer"
      />
    </div>
  </div>

  <v-snackbar v-model="snackbar.open" :timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>

<style scoped>
/* TabBar ile aynı tonal yüzeyi paylaşır — çalışma alanı bölgesi tek blok okunur. */
.antiphon-ws-toolbar {
  height: 44px;
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface-light));
}
.antiphon-ws-toolbar__identity {
  min-width: 0;
  padding: 4px 8px;
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.15s ease;
}
.antiphon-ws-toolbar__identity:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
/* İlişkili ikon butonlarını tek pill konteynerde gruplar (app bar ile aynı desen). */
.antiphon-icon-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
</style>
