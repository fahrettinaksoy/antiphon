<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useEnvironmentsStore } from '../../stores/environments'
import { useWorkspaceStore } from '../../stores/workspace'
import { useTabsStore } from '../../stores/tabs'
import NewItemDialog from './NewItemDialog.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from './SidebarSection.vue'
import type { EnvironmentSummary } from '@shared/ipc-contract'

const { t } = useI18n()
const environmentsStore = useEnvironmentsStore()
const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

// Standart bölüm araması
const search = ref('')
const filteredEnvs = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return environmentsStore.list
  return environmentsStore.list.filter((env) => env.name.toLowerCase().includes(q))
})

const activeEnvName = computed(
  () => environmentsStore.list.find((env) => env.path === environmentsStore.activeEnvironmentPath)?.name ?? null
)

// Satıra tıklamak ortamı SEKME olarak açar (çalışma alanı mantığı);
// aktifleştirme satır sonundaki onay butonuyla yapılır.
function openEnvironment(env: EnvironmentSummary) {
  tabsStore.openEnvironment(env.path, env.name)
}

function toggleActive(path: string) {
  environmentsStore.selectEnvironment(environmentsStore.activeEnvironmentPath === path ? null : path)
}

// Yeni ortam: ad diyaloğu → oluştur → düzenleyici sekmesinde aç
const newDialogOpen = ref(false)
async function handleCreate(name: string) {
  if (!workspaceStore.rootPath) return
  const summary = await environmentsStore.createEnvironment(workspaceStore.rootPath, name)
  await tabsStore.openEnvironment(summary.path, summary.name)
}

async function removeEnvironment(env: EnvironmentSummary) {
  if (!workspaceStore.rootPath) return
  const openTab = tabsStore.tabByPath(env.path)
  if (openTab) tabsStore.closeTab(openTab.id)
  await environmentsStore.deleteEnvironment(workspaceStore.rootPath, env.path)
}
</script>

<template>
  <SidebarSection
    :title="t('sidebar.environments')"
    :count="environmentsStore.list.length || undefined"
    searchable
    :search-placeholder="t('sidebar.searchEnvironments')"
    v-model:search="search"
    addable
    :add-tooltip="t('environment.newTitle')"
    @add="newDialogOpen = true"
  >
    <AppEmptyState
      v-if="!workspaceStore.isOpen"
      size="compact"
      icon="mdi-folder-open-outline"
      :title="t('empty.noWorkspace')"
      :text="t('empty.noWorkspaceHint')"
    />

    <AppEmptyState
      v-else-if="environmentsStore.list.length === 0"
      size="compact"
      icon="mdi-layers-triple-outline"
      :title="t('empty.noEnvironments')"
      :text="t('empty.noEnvironmentsHint')"
      :action-text="t('environment.newTitle')"
      action-icon="mdi-plus"
      @action="newDialogOpen = true"
    />

    <AppEmptyState v-else-if="filteredEnvs.length === 0" size="compact" icon="mdi-magnify" :title="t('sidebar.noMatches')" />

    <v-list v-else density="compact" class="flex-grow-1 overflow-y-auto">
      <v-list-item
        v-for="env in filteredEnvs"
        :key="env.path"
        class="antiphon-env-row"
        @click="openEnvironment(env)"
      >
        <template #prepend>
          <v-icon icon="mdi-layers-triple-outline" size="18" class="mr-2" color="primary" />
        </template>
        <v-list-item-title class="text-body-2 text-truncate">{{ env.name }}</v-list-item-title>
        <template #append>
          <v-btn
            :icon="environmentsStore.activeEnvironmentPath === env.path ? 'mdi-check-circle' : 'mdi-check-circle-outline'"
            :color="environmentsStore.activeEnvironmentPath === env.path ? 'primary' : undefined"
            size="x-small"
            variant="text"
            :title="t('environment.makeActive')"
            @click.stop="toggleActive(env.path)"
          />
          <v-btn
            icon="mdi-delete-outline"
            size="x-small"
            variant="text"
            class="antiphon-env-row__delete"
            :title="t('environment.delete')"
            @click.stop="removeEnvironment(env)"
          />
        </template>
      </v-list-item>
    </v-list>

    <template #footer>
      <div class="d-flex align-center ga-2">
        <span class="text-caption text-medium-emphasis text-truncate">
          {{ t('sidebar.activeEnvironment') }}: {{ activeEnvName ?? '—' }}
        </span>
        <v-btn
          v-if="activeEnvName"
          icon="mdi-close"
          size="x-small"
          variant="text"
          :title="t('actions.clear')"
          @click="environmentsStore.selectEnvironment(null)"
        />
      </div>
    </template>

    <NewItemDialog v-model="newDialogOpen" :title="t('environment.newTitle')" @confirm="handleCreate" />
  </SidebarSection>
</template>

<style scoped>
/* Silme butonu yalnızca satır üzerine gelince görünür (kazara silmeye karşı görsel sadelik). */
.antiphon-env-row__delete {
  opacity: 0;
}
.antiphon-env-row:hover .antiphon-env-row__delete {
  opacity: 1;
}
</style>
