<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useHistoryStore } from '../../stores/history'
import { useFormat } from '../../composables/useFormat'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from '../sidebar/SidebarSection.vue'

const { t } = useI18n()
const fmt = useFormat()
const historyStore = useHistoryStore()
const emit = defineEmits<{ replay: [string] }>()

const statusColor = (status: number | null) => {
  if (status === null) return 'error'
  if (status >= 500) return 'error'
  if (status >= 400) return 'warning'
  if (status >= 200) return 'success'
  return 'medium-emphasis'
}

// Standart bölüm araması + HTTP method filtresi
const search = ref('')
const methodFilter = ref<string[]>([])
const methodFilterOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => ({
  title: m,
  value: m
}))

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase()
  const methods = methodFilter.value
  return historyStore.entries.filter((entry) => {
    if (methods.length > 0 && !methods.includes(entry.method.toUpperCase())) return false
    if (q && !entry.url.toLowerCase().includes(q) && !entry.requestName.toLowerCase().includes(q)) return false
    return true
  })
})
</script>

<template>
  <SidebarSection
    :title="t('sidebar.history')"
    :count="historyStore.entries.length || undefined"
    searchable
    :search-placeholder="t('sidebar.searchHistory')"
    :filter-options="methodFilterOptions"
    v-model:search="search"
    v-model:filter="methodFilter"
  >
    <AppEmptyState
      v-if="historyStore.entries.length === 0"
      size="compact"
      icon="mdi-history"
      :title="t('empty.noHistory')"
      :text="t('empty.noHistoryHint')"
    />

    <AppEmptyState v-else-if="filteredEntries.length === 0" size="compact" icon="mdi-magnify" :title="t('sidebar.noMatches')" />

    <v-list v-else density="compact" class="overflow-y-auto flex-grow-1">
      <v-list-item
        v-for="entry in filteredEntries"
        :key="entry.id"
        @click="emit('replay', entry.id)"
      >
        <template #prepend>
          <v-chip size="x-small" :color="statusColor(entry.status)" variant="tonal" class="antiphon-mono mr-2" style="min-width: 46px; justify-content: center">
            {{ entry.status ?? 'ERR' }}
          </v-chip>
        </template>
        <v-list-item-title class="text-body-2 d-flex ga-2 align-center">
          <span class="antiphon-mono font-weight-bold text-caption">{{ entry.method }}</span>
          <span class="text-truncate">{{ entry.url }}</span>
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">
          {{ fmt.time(entry.sentAt) }} · {{ fmt.ms(entry.durationMs) }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn icon="mdi-close" size="x-small" variant="text" @click.stop="historyStore.remove(entry.id)" />
        </template>
      </v-list-item>
    </v-list>

    <template v-if="historyStore.entries.length > 0" #footer>
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-delete-sweep-outline"
        class="text-none"
        block
        @click="historyStore.clear"
      >
        {{ t('actions.clear') }}
      </v-btn>
    </template>
  </SidebarSection>
</template>
