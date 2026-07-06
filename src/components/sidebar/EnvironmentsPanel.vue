<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useEnvironmentsStore } from '../../stores/environments'
import { useWorkspaceStore } from '../../stores/workspace'
import EnvironmentManagerDialog from './EnvironmentManagerDialog.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from './SidebarSection.vue'

const { t } = useI18n()
const environmentsStore = useEnvironmentsStore()
const workspaceStore = useWorkspaceStore()
const managerOpen = ref(false)

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
</script>

<template>
  <SidebarSection
    :title="t('sidebar.environments')"
    :count="environmentsStore.list.length || undefined"
    searchable
    :search-placeholder="t('sidebar.searchEnvironments')"
    v-model:search="search"
    addable
    @add="managerOpen = true"
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
      :action-text="t('sidebar.environments')"
      action-icon="mdi-cog-outline"
      @action="managerOpen = true"
    />

    <AppEmptyState v-else-if="filteredEnvs.length === 0" size="compact" icon="mdi-magnify" :title="t('sidebar.noMatches')" />

    <v-list v-else density="compact" class="flex-grow-1 overflow-y-auto">
      <v-list-item
        :active="environmentsStore.activeEnvironmentPath === null"
        @click="environmentsStore.selectEnvironment(null)"
      >
        <template #prepend>
          <v-icon icon="mdi-earth-off" size="18" class="mr-2 text-medium-emphasis" />
        </template>
        <v-list-item-title class="text-body-2">Ortam yok</v-list-item-title>
      </v-list-item>
      <v-list-item
        v-for="env in filteredEnvs"
        :key="env.path"
        :active="environmentsStore.activeEnvironmentPath === env.path"
        @click="environmentsStore.selectEnvironment(env.path)"
      >
        <template #prepend>
          <v-icon icon="mdi-layers-triple-outline" size="18" class="mr-2" color="primary" />
        </template>
        <v-list-item-title class="text-body-2 text-truncate">{{ env.name }}</v-list-item-title>
      </v-list-item>
    </v-list>

    <template #footer>
      <div class="d-flex align-center ga-2">
        <span class="text-caption text-medium-emphasis text-truncate">
          {{ t('sidebar.activeEnvironment') }}: {{ activeEnvName ?? '—' }}
        </span>
        <v-spacer />
        <v-btn size="x-small" variant="text" prepend-icon="mdi-cog-outline" class="text-none" @click="managerOpen = true">
          {{ t('sidebar.environments') }}
        </v-btn>
      </div>
    </template>

    <EnvironmentManagerDialog v-model="managerOpen" />
  </SidebarSection>
</template>
