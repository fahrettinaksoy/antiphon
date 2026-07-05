<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useMagicKeys } from '@vueuse/core'
import { useUiStore } from '../../stores/ui'
import { useTabsStore } from '../../stores/tabs'
import { useWorkspaceStore } from '../../stores/workspace'

const { t } = useI18n()
const uiStore = useUiStore()
const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()

const query = ref('')

interface Command {
  id: string
  title: string
  icon: string
  run: () => void
}

const commands = computed<Command[]>(() => [
  { id: 'new-request', title: t('actions.newRequest'), icon: 'mdi-plus-circle-outline', run: () => tabsStore.openNewTab() },
  { id: 'new-ws', title: 'Yeni WebSocket Bağlantısı', icon: 'mdi-swap-vertical-bold', run: () => tabsStore.openNewTab('Yeni WebSocket', 'ws') },
  { id: 'new-sse', title: 'Yeni SSE Akışı', icon: 'mdi-access-point', run: () => tabsStore.openNewTab('Yeni SSE', 'sse') },
  { id: 'new-graphql', title: 'Yeni GraphQL İsteği', icon: 'mdi-graphql', run: () => tabsStore.openNewTab('Yeni GraphQL', 'graphql') },
  { id: 'new-mcp', title: 'Yeni MCP Bağlantısı', icon: 'mdi-hexagon-multiple-outline', run: () => tabsStore.openNewTab('Yeni MCP', 'mcp') },
  { id: 'open-workspace', title: t('actions.openWorkspace'), icon: 'mdi-folder-open-outline', run: () => workspaceStore.openWorkspace() },
  { id: 'toggle-theme', title: uiStore.themeName === 'antiphonDark' ? t('settings.light') : t('settings.dark'), icon: 'mdi-theme-light-dark', run: () => uiStore.toggleTheme() }
])

const filtered = computed(() =>
  commands.value.filter((command) => command.title.toLowerCase().includes(query.value.toLowerCase()))
)

function runCommand(command: Command) {
  command.run()
  uiStore.closeCommandPalette()
  query.value = ''
}

const { Meta_K, Ctrl_K } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && e.type === 'keydown') {
      e.preventDefault()
      uiStore.commandPaletteOpen ? uiStore.closeCommandPalette() : uiStore.openCommandPalette()
    }
  }
})
void Meta_K
void Ctrl_K
</script>

<template>
  <v-dialog v-model="uiStore.commandPaletteOpen" max-width="560" scrollable>
    <v-card rounded="lg">
      <v-text-field
        v-model="query"
        autofocus
        variant="plain"
        density="comfortable"
        :placeholder="t('palette.placeholder')"
        prepend-inner-icon="mdi-magnify"
        class="px-3 pt-2"
        hide-details
      />
      <v-divider />
      <v-list density="compact" class="py-1">
        <v-list-item v-for="command in filtered" :key="command.id" :prepend-icon="command.icon" @click="runCommand(command)">
          <v-list-item-title>{{ command.title }}</v-list-item-title>
        </v-list-item>
        <v-list-item v-if="filtered.length === 0">
          <v-list-item-title class="text-medium-emphasis">—</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </v-dialog>
</template>
