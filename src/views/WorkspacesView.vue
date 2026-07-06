<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useRouter } from 'vue-router'
import type { WorkspaceMetaDto, WorkspaceSyncDirection } from '@shared/ipc-contract'
import { useWorkspacesStore } from '../stores/workspaces'
import { useUiStore } from '../stores/ui'
import { useFormat } from '../composables/useFormat'

const { t } = useI18n()
const fmt = useFormat()
const router = useRouter()
const workspacesStore = useWorkspacesStore()
const uiStore = useUiStore()

type Tab = 'all' | 'local' | 'remote'
const tab = ref<Tab>('all')
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return workspacesStore.list.filter((w) => {
    if (tab.value === 'local' && w.storage.kind !== 'local') return false
    if (tab.value === 'remote' && w.storage.kind === 'local') return false
    if (q && !w.name.toLowerCase().includes(q)) return false
    return true
  })
})

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

function visibilityLabel(meta: WorkspaceMetaDto): string {
  return t(`workspace.visibility.${meta.type}`)
}

function accessLabel(meta: WorkspaceMetaDto): string {
  return t(`workspace.access.${meta.type}`)
}

function storageLabel(meta: WorkspaceMetaDto): string {
  if (meta.storage.kind === 'gist') return 'GitHub Gist'
  if (meta.storage.kind === 'webdav') return 'WebDAV'
  return t('workspace.storage.local')
}

function isFavorite(id: string): boolean {
  return uiStore.favoriteWorkspaceIds.includes(id)
}

async function openWorkspace(meta: WorkspaceMetaDto) {
  await workspacesStore.open(meta.id)
  router.push('/')
}

async function sync(id: string, direction: WorkspaceSyncDirection) {
  try {
    await workspacesStore.sync(id, direction)
  } catch {
    /* store.error */
  }
}

async function remove(meta: WorkspaceMetaDto) {
  if (meta.isDefault) return
  await workspacesStore.remove(meta.id)
}

// Yeniden adlandırma
const renameDialog = ref<{ open: boolean; id: string | null; value: string }>({ open: false, id: null, value: '' })
function openRename(meta: WorkspaceMetaDto) {
  renameDialog.value = { open: true, id: meta.id, value: meta.name }
}
async function confirmRename() {
  const { id, value } = renameDialog.value
  if (id && value.trim()) await workspacesStore.rename(id, value.trim())
  renameDialog.value = { open: false, id: null, value: '' }
}
</script>

<template>
  <!-- Kabuk (app bar + sol gezinme) App.vue'da; sayfa başlığı içerikte yer alır. -->
  <v-container fluid class="pa-6">
      <div class="d-flex align-center justify-space-between mb-4">
        <div class="d-flex align-center ga-2">
          <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" @click="router.push('/')" />
          <h1 class="text-h4 font-weight-bold">{{ t('header.workspaces') }}</h1>
        </div>
        <v-btn color="primary" variant="flat" class="text-none" @click="uiStore.openCreateWorkspaceDialog()">
          {{ t('workspace.createButton') }}
        </v-btn>
      </div>

      <v-tabs v-model="tab" density="compact" class="mb-3" slider-color="primary">
        <v-tab value="all" class="text-none">{{ t('workspace.tabs.all') }}</v-tab>
        <v-tab value="local" class="text-none">{{ t('workspace.tabs.local') }}</v-tab>
        <v-tab value="remote" class="text-none">{{ t('workspace.tabs.remote') }}</v-tab>
      </v-tabs>

      <v-text-field
        v-model="search"
        :placeholder="t('workspace.searchPlaceholder')"
        density="compact"
        hide-details
        prepend-inner-icon="mdi-magnify"
        max-width="360"
        class="mb-4"
      />

      <v-table class="antiphon-ws-table">
        <thead>
          <tr>
            <th>{{ t('workspace.table.name') }}</th>
            <th>{{ t('workspace.table.creator') }}</th>
            <th>{{ t('workspace.table.contributors') }}</th>
            <th>{{ t('workspace.table.lastActivity') }}</th>
            <th>{{ t('workspace.table.access') }}</th>
            <th>{{ t('workspace.table.role') }}</th>
            <th class="text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="meta in filtered"
            :key="meta.id"
            class="antiphon-ws-row"
            :class="{ 'antiphon-ws-row--active': meta.id === workspacesStore.activeId }"
            @click="openWorkspace(meta)"
          >
            <td>
              <div class="d-flex align-center ga-3 py-2">
                <div class="antiphon-ws-avatar">
                  <v-icon :icon="visibilityIcon(meta)" size="18" />
                </div>
                <div>
                  <div class="text-body-2 font-weight-medium d-flex align-center ga-2">
                    {{ meta.name }}
                    <v-chip v-if="meta.id === workspacesStore.activeId" size="x-small" color="primary" variant="tonal">
                      {{ t('workspace.activeBadge') }}
                    </v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis">{{ visibilityLabel(meta) }} · {{ storageLabel(meta) }}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="d-flex align-center ga-2">
                <v-avatar size="22" color="primary" variant="tonal"><span class="text-caption">{{ t('workspace.you').charAt(0) }}</span></v-avatar>
                {{ t('workspace.you') }}
              </div>
            </td>
            <td>1</td>
            <td class="text-medium-emphasis">{{ fmt.relative(meta.lastOpenedAt) }}</td>
            <td class="text-medium-emphasis">{{ accessLabel(meta) }}</td>
            <td class="text-medium-emphasis">Admin</td>
            <td class="text-right" @click.stop>
              <v-btn
                :icon="isFavorite(meta.id) ? 'mdi-star' : 'mdi-star-outline'"
                :color="isFavorite(meta.id) ? 'amber' : undefined"
                size="small"
                variant="text"
                @click="uiStore.toggleFavoriteWorkspace(meta.id)"
              />
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn v-bind="menuProps" icon="mdi-dots-horizontal" size="small" variant="text" />
                </template>
                <v-list density="compact">
                  <v-list-item prepend-icon="mdi-open-in-app" @click="openWorkspace(meta)">
                    <v-list-item-title>{{ t('workspace.open') }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item prepend-icon="mdi-pencil-outline" @click="openRename(meta)">
                    <v-list-item-title>{{ t('workspace.rename') }}</v-list-item-title>
                  </v-list-item>
                  <template v-if="meta.storage.kind !== 'local'">
                    <v-list-item prepend-icon="mdi-cloud-download-outline" @click="sync(meta.id, 'pull')">
                      <v-list-item-title>{{ t('workspace.pull') }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item prepend-icon="mdi-cloud-upload-outline" @click="sync(meta.id, 'push')">
                      <v-list-item-title>{{ t('workspace.push') }}</v-list-item-title>
                    </v-list-item>
                  </template>
                  <v-list-item v-if="!meta.isDefault" prepend-icon="mdi-delete-outline" @click="remove(meta)">
                    <v-list-item-title class="text-error">{{ t('workspace.delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="filtered.length === 0" class="text-center text-medium-emphasis text-body-2 py-10">
        {{ t('workspace.noResults') }}
      </div>

      <v-alert v-if="workspacesStore.error" type="error" variant="tonal" density="compact" class="mt-4" closable>
        {{ workspacesStore.error }}
      </v-alert>
  </v-container>

  <v-dialog v-model="renameDialog.open" max-width="420">
    <v-card class="pa-2">
      <v-card-title class="text-h6">{{ t('workspace.rename') }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="renameDialog.value" :placeholder="t('workspace.namePlaceholder')" density="comfortable" hide-details autofocus @keyup.enter="confirmRename" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="renameDialog.open = false">{{ t('actions.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" class="text-none" @click="confirmRename">{{ t('actions.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.antiphon-ws-table :deep(th) {
  font-size: 12px !important;
  font-weight: 600;
  text-transform: none;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
}
.antiphon-ws-row {
  cursor: pointer;
}
.antiphon-ws-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.antiphon-ws-row--active {
  background: rgba(var(--v-theme-primary), 0.05);
}
.antiphon-ws-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  flex: 0 0 34px;
}
</style>
