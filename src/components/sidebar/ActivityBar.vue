<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useUiStore, type SidebarSection } from '../../stores/ui'

const { t } = useI18n()
const uiStore = useUiStore()

const sections = computed<{ key: SidebarSection; icon: string; label: string }[]>(() => [
  { key: 'collections', icon: 'mdi-folder-multiple-outline', label: t('sidebar.collections') },
  { key: 'apis', icon: 'mdi-sitemap-outline', label: t('sidebar.apis') },
  { key: 'environments', icon: 'mdi-layers-triple-outline', label: t('sidebar.environments') },
  { key: 'mockServers', icon: 'mdi-server-network-outline', label: t('sidebar.mockServers') },
  { key: 'monitors', icon: 'mdi-monitor-eye', label: t('sidebar.monitors') },
  { key: 'history', icon: 'mdi-history', label: t('sidebar.history') }
])
</script>

<template>
  <div class="antiphon-activity-bar">
    <v-tooltip
      v-for="section in sections"
      :key="section.key"
      :text="section.label"
      location="right"
      open-delay="300"
    >
      <template #activator="{ props: tooltipProps }">
        <button
          v-bind="tooltipProps"
          type="button"
          class="antiphon-activity-item"
          :class="{ 'antiphon-activity-item--active': uiStore.activeSidebarSection === section.key }"
          :aria-label="section.label"
          @click="uiStore.setSidebarSection(section.key)"
        >
          <v-icon :icon="section.icon" size="22" />
        </button>
      </template>
    </v-tooltip>
  </div>
</template>

<style scoped>
.antiphon-activity-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 48px;
  flex: 0 0 48px;
  height: 100%;
  padding-top: 4px;
  background: rgba(var(--v-theme-surface), 1);
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow-y: auto;
}
.antiphon-activity-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  cursor: pointer;
  border-left: 2px solid transparent;
  background: transparent;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
.antiphon-activity-item:hover {
  opacity: 0.9;
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.antiphon-activity-item--active {
  opacity: 1;
  border-left-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
</style>
