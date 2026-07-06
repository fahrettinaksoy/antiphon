<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { useTabsStore, type TabProtocol } from '../../stores/tabs'
import { useEnvironmentsStore } from '../../stores/environments'
import { useUiStore } from '../../stores/ui'
import NewItemDialog from './NewItemDialog.vue'

const emit = defineEmits<{ 'new-http': []; 'new-collection': [] }>()

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()
const environmentsStore = useEnvironmentsStore()
const uiStore = useUiStore()

interface MenuItem {
  id: string
  label: string
  icon: string
  disabled: boolean
  comingSoon?: boolean
  action?: () => void
}

function openTab(name: string, protocol: TabProtocol) {
  tabsStore.openNewTab(name, protocol)
}

async function importSpec() {
  if (!workspaceStore.rootPath) return
  await ipc.importOpenapiSpec(workspaceStore.rootPath)
}

const envDialogOpen = ref(false)

async function createEnvironment(name: string) {
  if (!workspaceStore.rootPath) return
  await environmentsStore.createEnvironment(workspaceStore.rootPath, name)
}

const groupAi = computed<MenuItem[]>(() => [
  { id: 'ask-ai', label: t('sidebar.newMenu.askAi'), icon: 'mdi-creation', disabled: true, comingSoon: true }
])

const groupRequests = computed<MenuItem[]>(() => [
  { id: 'http', label: t('sidebar.newMenu.http'), icon: 'mdi-lightning-bolt-outline', disabled: false, action: () => emit('new-http') },
  {
    id: 'graphql',
    label: t('sidebar.newMenu.graphql'),
    icon: 'mdi-graphql',
    disabled: false,
    action: () => openTab(t('sidebar.newMenu.graphqlName'), 'graphql')
  },
  { id: 'ai', label: t('sidebar.newMenu.ai'), icon: 'mdi-robot-outline', disabled: true, comingSoon: true },
  {
    id: 'mcp',
    label: t('sidebar.newMenu.mcp'),
    icon: 'mdi-hexagon-multiple-outline',
    disabled: false,
    action: () => openTab(t('sidebar.newMenu.mcpName'), 'mcp')
  },
  { id: 'grpc', label: t('sidebar.newMenu.grpc'), icon: 'mdi-connection', disabled: true, comingSoon: true },
  {
    id: 'websocket',
    label: t('sidebar.newMenu.websocket'),
    icon: 'mdi-swap-vertical-bold',
    disabled: false,
    action: () => openTab(t('sidebar.newMenu.wsName'), 'ws')
  },
  { id: 'socketio', label: t('sidebar.newMenu.socketio'), icon: 'mdi-transit-connection-variant', disabled: true, comingSoon: true },
  { id: 'mqtt', label: t('sidebar.newMenu.mqtt'), icon: 'mdi-rss', disabled: true, comingSoon: true }
])

const groupOther = computed<MenuItem[]>(() => [
  {
    id: 'collection',
    label: t('sidebar.newMenu.collection'),
    icon: 'mdi-folder-outline',
    disabled: false,
    action: () => emit('new-collection')
  },
  {
    id: 'environment',
    label: t('sidebar.newMenu.environment'),
    icon: 'mdi-layers-outline',
    disabled: false,
    action: () => (envDialogOpen.value = true)
  },
  { id: 'spec', label: t('sidebar.newMenu.spec'), icon: 'mdi-file-code-outline', disabled: false, action: importSpec },
  { id: 'mock', label: t('sidebar.newMenu.mock'), icon: 'mdi-server-network', disabled: false, action: () => uiStore.openMockServerDialog() },
  { id: 'monitor', label: t('sidebar.newMenu.monitor'), icon: 'mdi-chart-line', disabled: true, comingSoon: true },
  { id: 'webhook', label: t('sidebar.newMenu.webhook'), icon: 'mdi-webhook', disabled: true, comingSoon: true },
  { id: 'flow', label: t('sidebar.newMenu.flow'), icon: 'mdi-sitemap', disabled: true, comingSoon: true }
])
</script>

<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" icon="mdi-plus" size="x-small" variant="text" :disabled="!workspaceStore.isOpen" />
    </template>
    <v-list density="compact" min-width="240">
      <v-list-subheader>{{ t('sidebar.newMenu.groupAi') }}</v-list-subheader>
      <v-list-item v-for="item in groupAi" :key="item.id" :prepend-icon="item.icon" :disabled="item.disabled" @click="item.action?.()">
        <v-list-item-title class="d-flex align-center justify-space-between">
          {{ item.label }}
          <v-chip v-if="item.comingSoon" size="x-small" variant="tonal" class="ml-2">{{ t('common.comingSoon') }}</v-chip>
        </v-list-item-title>
      </v-list-item>

      <v-divider class="my-1" />
      <v-list-subheader>{{ t('sidebar.newMenu.groupRequests') }}</v-list-subheader>
      <v-list-item v-for="item in groupRequests" :key="item.id" :prepend-icon="item.icon" :disabled="item.disabled" @click="item.action?.()">
        <v-list-item-title class="d-flex align-center justify-space-between">
          {{ item.label }}
          <v-chip v-if="item.comingSoon" size="x-small" variant="tonal" class="ml-2">{{ t('common.comingSoon') }}</v-chip>
        </v-list-item-title>
      </v-list-item>

      <v-divider class="my-1" />
      <v-list-subheader>{{ t('sidebar.newMenu.groupOther') }}</v-list-subheader>
      <v-list-item v-for="item in groupOther" :key="item.id" :prepend-icon="item.icon" :disabled="item.disabled" @click="item.action?.()">
        <v-list-item-title class="d-flex align-center justify-space-between">
          {{ item.label }}
          <v-chip v-if="item.comingSoon" size="x-small" variant="tonal" class="ml-2">{{ t('common.comingSoon') }}</v-chip>
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>

  <NewItemDialog v-model="envDialogOpen" :title="t('sidebar.newMenu.newEnvironmentTitle')" @confirm="createEnvironment" />
</template>
