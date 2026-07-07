<script setup lang="ts">
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import TabBar from '../components/layout/TabBar.vue'
import WorkspaceToolbar from '../components/layout/WorkspaceToolbar.vue'
import TabContentView from '../components/layout/TabContentView.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import { useTabsStore } from '../stores/tabs'
import { useWorkspaceStore } from '../stores/workspace'
import { useUiStore } from '../stores/ui'

const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore()

const otherOpenTabs = computed(() => tabsStore.tabs.filter((t) => t.id !== tabsStore.activeTabId))

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
    if (!active) return
    // Dosyası olmayan (boşta) istek: konum seçtiren "İsteği Kaydet" çekmecesini aç.
    if (!active.requestPath && active.kind === 'request') {
      uiStore.openSaveRequest(active.id)
      return
    }
    tabsStore.markDirty(active.id)
    tabsStore.saveTab(active.id)
  }
})
</script>

<template>
  <!-- Kabuk (app bar + sol gezinme) App.vue'da; burada yalnızca sekmeler ve içerik var.
       Yükseklik, Vuetify layout değişkeniyle üst barlara otomatik uyum sağlar. -->
  <div class="d-flex flex-column antiphon-workspace-page">
      <WorkspaceToolbar />
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

      <!-- Sarmalayıcı: boş durum kalan alanı kullanır, üstteki şeritleri (toolbar/tab) ezmez. -->
      <div v-else class="flex-grow-1 d-flex overflow-hidden" style="min-height: 0">
        <AppEmptyState
          class="flex-grow-1"
          icon="mdi-send-outline"
          title="Açık istek yok"
          text="Başlamak için yeni bir istek oluşturun veya kenar çubuğundan bir istek seçin"
          action-text="Yeni İstek"
          action-icon="mdi-plus"
          @action="createFirstRequest"
        />
      </div>
  </div>
</template>

<style scoped>
.antiphon-split-selector {
  height: 40px;
}
/* v-main içinde tam yükseklik: 100vh eksi üst barlar (Vuetify layout değişkeni). */
.antiphon-workspace-page {
  height: calc(100vh - var(--v-layout-top, 0px));
}
</style>
