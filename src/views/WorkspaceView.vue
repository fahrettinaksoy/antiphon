<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import TopAppBar from '../components/layout/TopAppBar.vue'
import TabBar from '../components/layout/TabBar.vue'
import HistoryPanel from '../components/layout/HistoryPanel.vue'
import GitPanel from '../components/layout/GitPanel.vue'
import TabContentView from '../components/layout/TabContentView.vue'
import ActivityBar from '../components/sidebar/ActivityBar.vue'
import SidebarPanel from '../components/sidebar/SidebarPanel.vue'
import MockServerDialog from '../components/layout/MockServerDialog.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import { useTabsStore } from '../stores/tabs'
import { useWorkspaceStore } from '../stores/workspace'
import { useHistoryStore } from '../stores/history'
import { useUiStore } from '../stores/ui'

const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()
const historyStore = useHistoryStore()
const uiStore = useUiStore()
const drawer = ref(true)

const otherOpenTabs = computed(() => tabsStore.tabs.filter((t) => t.id !== tabsStore.activeTabId))

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
}

async function createFirstRequest() {
  if (workspaceStore.rootPath) {
    const node = await workspaceStore.createRequest(workspaceStore.rootPath, 'Yeni İstek')
    await tabsStore.openRequestFile(node.path)
  } else {
    tabsStore.openNewTab()
  }
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    const active = tabsStore.activeTab
    if (active) {
      tabsStore.markDirty(active.id)
      tabsStore.saveTab(active.id)
    }
  }
})
</script>

<template>
  <TopAppBar />
  <v-navigation-drawer v-model="drawer" permanent width="348">
    <div class="d-flex h-100">
      <ActivityBar />
      <SidebarPanel @replay="replayHistoryEntry" />
    </div>
  </v-navigation-drawer>

  <v-main>
    <div class="d-flex flex-column" style="height: calc(100vh - 48px)">
      <TabBar />

      <v-row v-if="tabsStore.activeTab" no-gutters class="flex-grow-1 overflow-hidden">
        <v-col :cols="tabsStore.splitViewEnabled ? 6 : 12" class="h-100 overflow-hidden">
          <TabContentView :tab-id="tabsStore.activeTabId" />
        </v-col>

        <template v-if="tabsStore.splitViewEnabled">
          <v-divider vertical />
          <v-col cols="6" class="h-100 d-flex flex-column overflow-hidden">
            <div class="d-flex align-center px-2 antiphon-split-selector">
              <v-select
                :model-value="tabsStore.secondaryTabId"
                :items="otherOpenTabs.map((t) => ({ title: t.name, value: t.id }))"
                density="compact"
                hide-details
                variant="plain"
                placeholder="İkinci pane için tab seçin"
                @update:model-value="tabsStore.setSecondaryTab($event)"
              />
            </div>
            <v-divider />
            <div class="flex-grow-1 overflow-hidden">
              <TabContentView :tab-id="tabsStore.secondaryTabId" />
            </div>
          </v-col>
        </template>
      </v-row>

      <AppEmptyState
        v-else
        icon="mdi-send-outline"
        title="Açık istek yok"
        text="Başlamak için yeni bir istek oluşturun veya kenar çubuğundan bir istek seçin"
        action-text="Yeni İstek"
        action-icon="mdi-plus"
        @action="createFirstRequest"
      />
    </div>
  </v-main>

  <v-navigation-drawer v-model="uiStore.historyDrawerOpen" location="right" width="320" temporary>
    <HistoryPanel @replay="replayHistoryEntry" />
  </v-navigation-drawer>

  <v-navigation-drawer v-model="uiStore.gitDrawerOpen" location="right" width="360" temporary>
    <GitPanel />
  </v-navigation-drawer>

  <MockServerDialog v-model="uiStore.mockServerDialogOpen" />
</template>

<style scoped>
.antiphon-split-selector {
  height: 40px;
}
</style>
