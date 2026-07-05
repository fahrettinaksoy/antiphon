<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useUiStore } from '../../stores/ui'
import CollectionTree from './CollectionTree.vue'
import EnvironmentsPanel from './EnvironmentsPanel.vue'
import HistoryPanel from '../layout/HistoryPanel.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from './SidebarSection.vue'

defineEmits<{ replay: [string] }>()

const { t } = useI18n()
const uiStore = useUiStore()

const placeholder = computed<{ icon: string; label: string } | null>(() => {
  switch (uiStore.activeSidebarSection) {
    case 'apis':
      return { icon: 'mdi-sitemap-outline', label: t('sidebar.apis') }
    case 'mockServers':
      return { icon: 'mdi-server-network-outline', label: t('sidebar.mockServers') }
    case 'monitors':
      return { icon: 'mdi-monitor-eye', label: t('sidebar.monitors') }
    default:
      return null
  }
})
</script>

<template>
  <div class="antiphon-sidebar-panel">
    <CollectionTree v-if="uiStore.activeSidebarSection === 'collections'" />
    <EnvironmentsPanel v-else-if="uiStore.activeSidebarSection === 'environments'" />
    <HistoryPanel v-else-if="uiStore.activeSidebarSection === 'history'" @replay="$emit('replay', $event)" />

    <SidebarSection v-else-if="placeholder" :title="placeholder.label">
      <AppEmptyState size="compact" :icon="placeholder.icon" :text="t('sidebar.comingSoon')" />
    </SidebarSection>
  </div>
</template>

<style scoped>
.antiphon-sidebar-panel {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
.antiphon-sidebar-panel > * {
  height: 100%;
}
</style>
