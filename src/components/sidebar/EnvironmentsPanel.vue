<script setup lang="ts">
import { ref } from 'vue'
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
</script>

<template>
  <SidebarSection :title="t('sidebar.environments')">
    <template #actions>
      <v-btn
        icon="mdi-cog-outline"
        size="x-small"
        variant="text"
        :title="t('sidebar.environments')"
        @click="managerOpen = true"
      />
    </template>

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
        v-for="env in environmentsStore.list"
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

    <EnvironmentManagerDialog v-model="managerOpen" />
  </SidebarSection>
</template>
