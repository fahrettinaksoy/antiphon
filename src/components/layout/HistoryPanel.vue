<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useHistoryStore, type HistoryEntry } from '../../stores/history'
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

// Kayıtları güne göre grupla: Bugün / Dün / tarih
const groupedEntries = computed(() => {
  const startOfDay = (ts: number) => new Date(new Date(ts).setHours(0, 0, 0, 0)).getTime()
  const todayStart = startOfDay(Date.now())
  const dayMs = 86_400_000

  const groups: { label: string; entries: HistoryEntry[] }[] = []
  for (const entry of filteredEntries.value) {
    const entryDay = startOfDay(entry.sentAt)
    const label =
      entryDay === todayStart ? t('sidebar.today') : entryDay === todayStart - dayMs ? t('sidebar.yesterday') : fmt.date(entry.sentAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
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

    <div v-else class="flex-grow-1 overflow-y-auto pb-2">
      <template v-for="group in groupedEntries" :key="group.label">
        <div class="px-3 py-1 d-flex align-center mt-1">
          <span class="antiphon-history-group">{{ group.label }}</span>
          <v-chip size="x-small" variant="tonal" class="ml-2">{{ group.entries.length }}</v-chip>
        </div>
        <div
          v-for="entry in group.entries"
          :key="entry.id"
          class="d-flex align-center ga-2 px-3 py-1 antiphon-history-row"
          @click="emit('replay', entry.id)"
        >
          <v-chip
            size="x-small"
            :color="statusColor(entry.status)"
            variant="tonal"
            class="antiphon-mono justify-center flex-shrink-0"
            style="min-width: 44px"
          >
            {{ entry.status ?? 'ERR' }}
          </v-chip>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-body-2 d-flex ga-2 align-center">
              <span class="antiphon-mono font-weight-bold text-caption flex-shrink-0">{{ entry.method }}</span>
              <span class="text-truncate">{{ entry.url }}</span>
            </div>
            <div class="text-caption text-medium-emphasis antiphon-mono">
              {{ fmt.time(entry.sentAt) }} · {{ fmt.ms(entry.durationMs) }}
            </div>
          </div>
          <v-btn
            icon="mdi-close"
            size="x-small"
            variant="text"
            class="antiphon-history-row__delete flex-shrink-0"
            :title="t('actions.clear')"
            @click.stop="historyStore.remove(entry.id)"
          />
        </div>
      </template>
    </div>

    <template v-if="historyStore.entries.length > 0" #footer>
      <div class="d-flex align-center ga-2">
        <span class="text-caption text-medium-emphasis">{{ t('sidebar.entryCount', { n: historyStore.entries.length }) }}</span>
        <v-spacer />
        <v-btn size="x-small" variant="text" prepend-icon="mdi-delete-sweep-outline" class="text-none" @click="historyStore.clear">
          {{ t('actions.clear') }}
        </v-btn>
      </div>
    </template>
  </SidebarSection>
</template>

<style scoped>
.antiphon-history-group {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.antiphon-history-row {
  cursor: pointer;
  border-radius: 8px;
  margin-inline: 4px;
}
.antiphon-history-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
/* Silme butonu yalnızca satır üzerine gelince görünür. */
.antiphon-history-row__delete {
  opacity: 0;
}
.antiphon-history-row:hover .antiphon-history-row__delete {
  opacity: 1;
}
</style>
