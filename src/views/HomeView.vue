<script setup lang="ts">
import type { WorkspaceMetaDto } from '@shared/ipc-contract'
// Ana Sayfa — genel sayfa (sol panel yok): son etkinlik, favoriler ve son kullanılan
// çalışma alanlarına hızlı erişim.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import { useFormat } from '../composables/useFormat'
import { useHistoryStore } from '../stores/history'
import { useTabsStore } from '../stores/tabs'
import { useUiStore } from '../stores/ui'
import { useWorkspacesStore } from '../stores/workspaces'

const router = useRouter()
const { t } = useI18n()
const workspacesStore = useWorkspacesStore()
const historyStore = useHistoryStore()
const tabsStore = useTabsStore()
const uiStore = useUiStore()
const fmt = useFormat()

const favoriteWorkspaces = computed(() =>
  workspacesStore.list.filter((w) => uiStore.favoriteWorkspaceIds.includes(w.id))
)
const recentWorkspaces = computed(() =>
  [...workspacesStore.list].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 5)
)
const latestActivity = computed(() => historyStore.entries.slice(0, 8))

function visibilityIcon(meta: WorkspaceMetaDto): string {
  switch (meta.type) {
    case 'internal':
      return 'mdi-account-multiple-outline'
    case 'public':
      return 'mdi-web'
    default:
      return 'mdi-lock-outline'
  }
}

async function openWorkspace(id: string) {
  await workspacesStore.open(id)
  router.push('/')
}

// Geçmiş kaydını yeni sekmede tekrar aç ve çalışma alanına dön.
function replay(entryId: string) {
  const entry = historyStore.entries.find((e) => e.id === entryId)
  if (!entry) return
  const tab = tabsStore.openNewTab(entry.requestName)
  tab.method = entry.method as typeof tab.method
  tab.url = entry.url
  tab.headers = entry.headers
  tab.params = entry.params
  if (entry.body) tab.body = entry.body
  if (entry.auth) tab.auth = entry.auth
  router.push('/')
}

const statusColor = (status: number | null) => {
  if (status === null) return 'error'
  if (status >= 500) return 'error'
  if (status >= 400) return 'warning'
  if (status >= 200) return 'success'
  return 'medium-emphasis'
}
</script>

<template>
  <v-container fluid class="pa-6">
    <h1 class="text-h4 font-weight-bold mb-6">{{ t('home.title') }}</h1>

    <v-row>
      <!-- Son etkinlik -->
      <v-col cols="12" md="7">
        <v-card variant="tonal" class="pa-4 h-100">
          <div class="d-flex align-center mb-3">
            <div class="text-subtitle-2">{{ t('home.latestActivity') }}</div>
            <v-chip v-if="historyStore.entries.length" size="x-small" variant="tonal" class="ml-2">
              {{ historyStore.entries.length }}
            </v-chip>
            <v-spacer />
            <v-btn
              size="x-small"
              variant="text"
              class="text-none"
              @click="uiStore.toggleHistoryDrawer"
            >
              {{ t('home.viewAll') }}
            </v-btn>
          </div>

          <AppEmptyState
            v-if="latestActivity.length === 0"
            size="compact"
            icon="mdi-history"
            :title="t('home.noActivity')"
            :text="t('home.noActivityHint')"
          />
          <div
            v-for="entry in latestActivity"
            :key="entry.id"
            class="d-flex align-center ga-2 px-2 py-1 antiphon-home-row"
            @click="replay(entry.id)"
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
            <span class="antiphon-mono font-weight-bold text-caption flex-shrink-0">{{
              entry.method
            }}</span>
            <span class="text-body-2 text-truncate flex-grow-1">{{ entry.url }}</span>
            <span class="text-caption text-medium-emphasis flex-shrink-0">{{
              fmt.relative(entry.sentAt)
            }}</span>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" md="5" class="d-flex flex-column ga-4">
        <!-- Favoriler -->
        <v-card variant="tonal" class="pa-4">
          <div class="d-flex align-center mb-3">
            <div class="text-subtitle-2">{{ t('home.favorites') }}</div>
            <v-spacer />
            <v-btn
              size="x-small"
              variant="text"
              class="text-none"
              @click="router.push('/workspaces')"
            >
              {{ t('home.viewAll') }}
            </v-btn>
          </div>
          <AppEmptyState
            v-if="favoriteWorkspaces.length === 0"
            size="compact"
            icon="mdi-star-outline"
            :title="t('home.noFavorites')"
            :text="t('home.noFavoritesHint')"
          />
          <div
            v-for="meta in favoriteWorkspaces"
            :key="meta.id"
            class="d-flex align-center ga-3 px-2 py-2 antiphon-home-row"
            @click="openWorkspace(meta.id)"
          >
            <v-icon icon="mdi-star" size="18" color="warning" />
            <div class="flex-grow-1" style="min-width: 0">
              <div class="text-body-2 font-weight-medium text-truncate">{{ meta.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ fmt.relative(meta.lastOpenedAt) }}
              </div>
            </div>
            <v-chip
              v-if="meta.id === workspacesStore.activeId"
              size="x-small"
              color="primary"
              variant="tonal"
            >
              {{ t('workspace.activeBadge') }}
            </v-chip>
          </div>
        </v-card>

        <!-- Son kullanılanlar -->
        <v-card variant="tonal" class="pa-4 flex-grow-1">
          <div class="d-flex align-center mb-3">
            <div class="text-subtitle-2">{{ t('home.recentWorkspaces') }}</div>
            <v-spacer />
            <v-btn
              size="x-small"
              variant="text"
              class="text-none"
              @click="router.push('/workspaces')"
            >
              {{ t('home.viewAll') }}
            </v-btn>
          </div>
          <div
            v-for="meta in recentWorkspaces"
            :key="meta.id"
            class="d-flex align-center ga-3 px-2 py-2 antiphon-home-row"
            @click="openWorkspace(meta.id)"
          >
            <v-icon :icon="visibilityIcon(meta)" size="18" class="text-medium-emphasis" />
            <div class="flex-grow-1" style="min-width: 0">
              <div class="text-body-2 font-weight-medium text-truncate">{{ meta.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ fmt.relative(meta.lastOpenedAt) }}
              </div>
            </div>
            <v-chip
              v-if="meta.id === workspacesStore.activeId"
              size="x-small"
              color="primary"
              variant="tonal"
            >
              {{ t('workspace.activeBadge') }}
            </v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.antiphon-home-row {
  cursor: pointer;
  border-radius: 8px;
}
.antiphon-home-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
</style>
