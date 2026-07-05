<script setup lang="ts">
import { useTabsStore, type TabProtocol } from '../../stores/tabs'

const tabsStore = useTabsStore()

const protocolIcon: Record<TabProtocol, string> = {
  http: '',
  ws: 'mdi-swap-vertical-bold',
  sse: 'mdi-access-point',
  graphql: 'mdi-graphql',
  mcp: 'mdi-hexagon-multiple-outline'
}
</script>

<template>
  <div class="d-flex align-center antiphon-tabbar">
    <div
      v-for="tab in tabsStore.tabs"
      :key="tab.id"
      class="d-flex align-center ga-2 px-3 antiphon-tab"
      :class="{ 'antiphon-tab--active': tab.id === tabsStore.activeTabId }"
      @click="tabsStore.setActiveTab(tab.id)"
    >
      <v-icon v-if="tab.kind === 'collection'" icon="mdi-folder-outline" size="14" color="warning" />
      <v-icon v-else-if="tab.protocol !== 'http'" :icon="protocolIcon[tab.protocol]" size="14" color="secondary" />
      <span v-else class="text-caption antiphon-mono font-weight-bold" :class="`text-method-${tab.method.toLowerCase()}`">
        {{ tab.method }}
      </span>
      <span class="text-body-2 text-truncate" style="max-width: 140px">{{ tab.name }}</span>
      <span v-if="tab.isDirty" class="antiphon-dirty-dot" />
      <v-btn icon="mdi-close" size="x-small" variant="text" density="compact" @click.stop="tabsStore.closeTab(tab.id)" />
    </div>

    <v-menu>
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" icon="mdi-plus" size="small" variant="text" class="ml-1" />
      </template>
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-send-variant-outline" @click="tabsStore.openNewTab('Yeni İstek', 'http')">
          <v-list-item-title>HTTP İsteği</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-swap-vertical-bold" @click="tabsStore.openNewTab('Yeni WebSocket', 'ws')">
          <v-list-item-title>WebSocket Bağlantısı</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-access-point" @click="tabsStore.openNewTab('Yeni SSE', 'sse')">
          <v-list-item-title>SSE Akışı</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-graphql" @click="tabsStore.openNewTab('Yeni GraphQL', 'graphql')">
          <v-list-item-title>GraphQL İsteği</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-hexagon-multiple-outline" @click="tabsStore.openNewTab('Yeni MCP', 'mcp')">
          <v-list-item-title>MCP Bağlantısı</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-spacer />

    <v-btn
      icon="mdi-view-split-vertical"
      size="small"
      variant="text"
      :color="tabsStore.splitViewEnabled ? 'primary' : undefined"
      title="Bölünmüş Görünüm"
      :disabled="tabsStore.tabs.length < 2"
      @click="tabsStore.toggleSplitView"
    />
  </div>
</template>

<style scoped>
.antiphon-tabbar {
  height: 40px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.antiphon-tab {
  height: 100%;
  cursor: pointer;
  border-right: 1px solid rgba(128, 128, 128, 0.1);
  opacity: 0.7;
}
.antiphon-tab--active {
  opacity: 1;
  background-color: rgba(128, 128, 128, 0.08);
  border-bottom: 2px solid rgb(var(--v-theme-primary));
}
.antiphon-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-warning));
}
</style>
