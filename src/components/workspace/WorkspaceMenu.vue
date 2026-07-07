<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useRouter } from 'vue-router'
import type { WorkspaceMetaDto, WorkspaceSyncDirection } from '@shared/ipc-contract'
import { useWorkspacesStore } from '../../stores/workspaces'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const router = useRouter()
const workspacesStore = useWorkspacesStore()
const uiStore = useUiStore()

const menuOpen = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return workspacesStore.list
  return workspacesStore.list.filter((w) => w.name.toLowerCase().includes(q))
})

// Görünürlüğe göre ikon: kişisel = kilit, ekip = kişiler, herkese açık = küre.
function visibilityIcon(meta: WorkspaceMetaDto): string {
  switch (meta.type) {
    case 'internal':
      return 'mdi-account-multiple-outline'
    case 'public':
      return 'mdi-web'
    default:
      return 'mdi-lock-outline'
  }
}

function storageLabel(meta: WorkspaceMetaDto): string | null {
  if (meta.storage.kind === 'gist') return 'GitHub Gist'
  if (meta.storage.kind === 'webdav') return 'WebDAV'
  return null
}

async function switchTo(id: string) {
  if (id !== workspacesStore.activeId) await workspacesStore.open(id)
  menuOpen.value = false
  // Seçim hangi sayfada yapılırsa yapılsın çalışma alanı görünümüne git.
  if (router.currentRoute.value.path !== '/') router.push('/')
}

function openCreate() {
  menuOpen.value = false
  uiStore.openCreateWorkspaceDialog()
}

function viewAll() {
  menuOpen.value = false
  router.push('/workspaces')
}

async function sync(id: string, direction: WorkspaceSyncDirection) {
  try {
    await workspacesStore.sync(id, direction)
  } catch {
    /* hata store.error'a yazılır */
  }
}

async function remove(meta: WorkspaceMetaDto) {
  if (meta.isDefault) return
  await workspacesStore.remove(meta.id)
}
</script>

<template>
  <v-menu v-model="menuOpen" :close-on-content-click="false" @update:model-value="search = ''">
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" variant="text" size="small" append-icon="mdi-chevron-down" class="text-none antiphon-nav__link">
        {{ t('header.workspaces') }}
      </v-btn>
    </template>

    <v-card min-width="420" max-width="480" class="antiphon-ws-menu">
      <!-- Arama + Oluştur -->
      <div class="d-flex align-center ga-2 pa-3">
        <v-text-field
          v-model="search"
          :placeholder="t('workspace.searchPlaceholder')"
          density="compact"
          hide-details
          autofocus
          class="flex-grow-1"
        />
        <v-btn variant="tonal" size="small" class="text-none" @click="openCreate">
          {{ t('workspace.create') }}
        </v-btn>
      </div>

      <v-divider />

      <v-list density="comfortable" class="antiphon-ws-list py-1">
        <v-list-item
          v-for="meta in filtered"
          :key="meta.id"
          :active="meta.id === workspacesStore.activeId"
          class="antiphon-ws-item"
          @click="switchTo(meta.id)"
        >
          <template #prepend>
            <v-icon :icon="visibilityIcon(meta)" size="20" class="mr-3" />
          </template>
          <v-list-item-title class="text-body-1">{{ meta.name }}</v-list-item-title>
          <v-list-item-subtitle v-if="storageLabel(meta)" class="text-caption">{{ storageLabel(meta) }}</v-list-item-subtitle>

          <template #append>
            <div class="antiphon-ws-actions d-flex align-center">
              <template v-if="meta.storage.kind !== 'local'">
                <v-btn
                  icon="mdi-cloud-download-outline"
                  size="x-small"
                  variant="text"
                  :title="t('workspace.pull')"
                  :loading="workspacesStore.isSyncing"
                  @click.stop="sync(meta.id, 'pull')"
                />
                <v-btn
                  icon="mdi-cloud-upload-outline"
                  size="x-small"
                  variant="text"
                  :title="t('workspace.push')"
                  :loading="workspacesStore.isSyncing"
                  @click.stop="sync(meta.id, 'push')"
                />
              </template>
              <v-btn
                v-if="!meta.isDefault"
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                color="error"
                :title="t('workspace.delete')"
                @click.stop="remove(meta)"
              />
            </div>
          </template>
        </v-list-item>

        <div v-if="filtered.length === 0" class="text-center text-medium-emphasis text-body-2 py-6">
          {{ t('workspace.noResults') }}
        </div>
      </v-list>

      <v-divider />

      <v-list density="comfortable" class="py-1">
        <v-list-item prepend-icon="mdi-view-grid-outline" @click="viewAll">
          <v-list-item-title class="text-body-2">{{ t('workspace.viewAll') }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <v-alert v-if="workspacesStore.error" type="error" variant="tonal" density="compact" class="ma-2">
        {{ workspacesStore.error }}
      </v-alert>
    </v-card>
  </v-menu>
</template>

<style scoped>
.antiphon-ws-list {
  max-height: 320px;
  overflow-y: auto;
}
/* Senkron/sil butonları yalnızca satır üzerine gelince görünür — Postman'deki temiz görünüm. */
.antiphon-ws-actions {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.antiphon-ws-item:hover .antiphon-ws-actions {
  opacity: 1;
}
</style>
