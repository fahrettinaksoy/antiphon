<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useFormat } from '../../composables/useFormat'
import { nanoid } from 'nanoid'
import KeyValueEditor from '../request/KeyValueEditor.vue'
import AuthPanel from '../request/AuthPanel.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEnvironmentsStore } from '../../stores/environments'
import type { RequestTab } from '../../stores/tabs'
import type { CollectionRunProgressEvent, CollectionRunResultDto } from '@shared/ipc-contract'

const tab = defineModel<RequestTab>({ required: true })
const { t } = useI18n()
const fmt = useFormat()
const workspaceStore = useWorkspaceStore()
const environmentsStore = useEnvironmentsStore()

const activeSection = ref('overview')
// Scripts bölümündeki dikey mini-nav: Pre-request / Post-response
const activeScript = ref<'pre' | 'post'>('pre')

// Yol segmentlerinden breadcrumb + koleksiyon/klasör ayrımı.
// Koleksiyon = çalışma alanı kökünün doğrudan çocuğu (tek segment); daha derini = klasör.
const segments = computed<string[]>(() => {
  const root = workspaceStore.rootPath
  const p = tab.value.requestPath
  if (!root || !p) return [tab.value.name]
  const rel = p.startsWith(root) ? p.slice(root.length) : p
  const parts = rel.split(/[\\/]/).filter(Boolean)
  return parts.length ? parts : [tab.value.name]
})
const isCollection = computed(() => segments.value.length <= 1)

// --- Runs (yerel çalıştırma) ---
const isRunning = ref(false)
const progress = ref({ index: 0, total: 0 })
const results = ref<CollectionRunResultDto[]>([])
const runId = ref<string | null>(null)
let unsubscribe: (() => void) | null = null

function handleProgress(event: CollectionRunProgressEvent) {
  if (event.runId !== runId.value) return
  results.value.push(event.result)
  progress.value = { index: event.index + 1, total: event.total }
}

async function runCollection() {
  if (!tab.value.requestPath || !workspaceStore.rootPath || isRunning.value) return
  activeSection.value = 'runs'
  results.value = []
  progress.value = { index: 0, total: 0 }
  isRunning.value = true
  runId.value = nanoid(8)
  try {
    await ipc.runCollection(runId.value, tab.value.requestPath, workspaceStore.rootPath, environmentsStore.activeVariables)
  } finally {
    isRunning.value = false
  }
}

function statusColor(result: CollectionRunResultDto): string {
  if (result.error || result.status === null) return 'error'
  if (result.tests.length > 0 && result.tests.some((r) => !r.passed)) return 'error'
  if (result.status >= 400) return 'warning'
  return 'success'
}
const passCount = () => results.value.filter((r) => statusColor(r) === 'success').length

onMounted(() => {
  unsubscribe = ipc.onCollectionRunProgress(handleProgress)
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <div class="d-flex flex-column h-100">
    <!-- Başlık -->
    <div class="d-flex align-center ga-3 px-4 py-3">
      <v-icon icon="mdi-folder-outline" color="warning" size="22" />
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex align-center ga-1 text-body-2 text-truncate">
          <template v-for="(seg, i) in segments" :key="i">
            <v-icon v-if="i > 0" icon="mdi-chevron-right" size="16" class="text-medium-emphasis" />
            <span :class="i === segments.length - 1 ? 'font-weight-bold' : 'text-medium-emphasis'">{{ seg }}</span>
          </template>
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ isCollection ? t('collection.subtitle') : t('collection.folderSubtitle') }}
        </div>
      </div>
      <v-btn
        v-if="isCollection"
        color="primary"
        variant="flat"
        size="small"
        prepend-icon="mdi-play"
        class="text-none"
        :loading="isRunning"
        @click="runCollection"
      >
        {{ t('collection.run') }}
      </v-btn>
    </div>

    <v-tabs v-model="activeSection" density="compact" class="px-2">
      <v-tab value="overview">{{ t('collection.tabs.overview') }}</v-tab>
      <v-tab value="auth">{{ t('collection.tabs.authorization') }}</v-tab>
      <v-tab value="scripts">{{ t('collection.tabs.scripts') }}</v-tab>
      <v-tab v-if="isCollection" value="variables">{{ t('collection.tabs.variables') }}</v-tab>
      <v-tab v-if="isCollection" value="runs">{{ t('collection.tabs.runs') }}</v-tab>
    </v-tabs>

    <!-- v-window yerine v-if: aktif olmayan CodeMirror'ın diğer sekmelere sızmasını önler.
         MD3: bölüm içerikleri çerçevesiz tonal kartlarda gruplanır. -->
    <div class="flex-grow-1 overflow-y-auto d-flex flex-column">
      <!-- Overview -->
      <div v-if="activeSection === 'overview'" class="pa-4">
        <v-card variant="tonal" class="pa-4">
          <div class="text-subtitle-2 mb-1">{{ t('collection.descriptionLabel') }}</div>
          <v-textarea
            v-model="tab.description"
            :placeholder="t('collection.descriptionPlaceholder')"
            density="comfortable"
            rows="8"
            auto-grow
            hide-details
          />
        </v-card>
      </div>

      <!-- Authorization -->
      <div v-else-if="activeSection === 'auth'" class="pa-4 d-flex flex-column ga-4">
        <v-card variant="tonal" class="pa-4">
          <p class="text-caption text-medium-emphasis mb-3">
            {{ isCollection ? t('collection.authHint') : t('collection.folderAuthHint') }}
          </p>
          <AuthPanel
            v-model="tab.auth"
            :none-label="isCollection ? t('collection.noAuth') : t('collection.inheritAuth')"
            :none-hint="isCollection ? t('collection.noAuthHint') : t('collection.inheritAuthHint')"
          />
        </v-card>
        <v-card variant="tonal" class="pa-4">
          <div class="text-subtitle-2 mb-2">{{ t('collection.commonHeaders') }}</div>
          <KeyValueEditor v-model="tab.headers" />
        </v-card>
      </div>

      <!-- Scripts: solda dikey nav, sağda seçili script'in tam yükseklik editörü (Postman düzeni) -->
      <div v-else-if="activeSection === 'scripts'" class="flex-grow-1 d-flex overflow-hidden">
        <div class="antiphon-script-nav flex-shrink-0 bg-surface-light h-100">
          <v-list density="compact" bg-color="transparent" class="py-1">
            <v-list-item :active="activeScript === 'pre'" rounded="lg" class="mx-1" @click="activeScript = 'pre'">
              <v-list-item-title class="text-body-2">{{ t('collection.preRequest') }}</v-list-item-title>
            </v-list-item>
            <v-list-item :active="activeScript === 'post'" rounded="lg" class="mx-1" @click="activeScript = 'post'">
              <v-list-item-title class="text-body-2">{{ t('collection.postResponse') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>
        <div class="flex-grow-1 overflow-hidden">
          <CodeMirrorEditor
            v-if="activeScript === 'pre'"
            v-model="tab.preRequestScript"
            language="javascript"
            placeholder="İstek gönderilmeden önce çalışır — ör. pm.environment.set('token', 'abc')"
            class="h-100"
          />
          <CodeMirrorEditor
            v-else
            v-model="tab.testScript"
            language="javascript"
            placeholder="Yanıt geldikten sonra çalışır — ör. pm.test('durum 200', () => pm.expect(pm.response.code).to.equal(200))"
            class="h-100"
          />
        </div>
      </div>

      <!-- Variables -->
      <div v-else-if="activeSection === 'variables'" class="pa-4">
        <v-card variant="tonal" class="pa-4">
          <p class="text-caption text-medium-emphasis mb-3">{{ t('collection.variablesHint') }}</p>
          <KeyValueEditor v-model="tab.variables" />
        </v-card>
      </div>

      <!-- Runs -->
      <div v-else-if="activeSection === 'runs'" class="pa-4">
        <div class="d-flex align-center ga-3 mb-3">
          <v-btn color="primary" variant="flat" size="small" :loading="isRunning" prepend-icon="mdi-play" class="text-none" @click="runCollection">
            {{ t('collection.run') }}
          </v-btn>
          <span v-if="progress.total > 0" class="text-caption text-medium-emphasis">{{ progress.index }} / {{ progress.total }}</span>
          <v-spacer />
          <v-chip v-if="results.length > 0" size="small" variant="tonal" :color="passCount() === results.length ? 'success' : 'warning'">
            {{ passCount() }}/{{ results.length }} {{ t('collection.passed') }}
          </v-chip>
        </div>

        <v-progress-linear v-if="isRunning" :model-value="(progress.index / Math.max(progress.total, 1)) * 100" color="primary" rounded class="mb-3" />

        <v-card v-if="results.length > 0" variant="tonal" class="py-1">
        <v-list density="compact" bg-color="transparent">
          <v-list-item v-for="result in results" :key="result.path">
            <template #prepend>
              <v-chip size="x-small" :color="statusColor(result)" variant="tonal" class="antiphon-mono mr-2" style="min-width: 46px; justify-content: center">
                {{ result.status ?? 'ERR' }}
              </v-chip>
            </template>
            <v-list-item-title class="text-body-2 d-flex ga-2 align-center">
              <span class="antiphon-mono font-weight-bold text-caption">{{ result.method }}</span>
              <span class="text-truncate">{{ result.name }}</span>
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ fmt.ms(result.durationMs) }}
              <span v-if="result.tests.length"> · {{ result.tests.filter((r) => r.passed).length }}/{{ result.tests.length }} test</span>
              <span v-if="result.error" class="text-error"> · {{ result.error }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        </v-card>

        <AppEmptyState
          v-else-if="!isRunning"
          size="compact"
          icon="mdi-play-circle-outline"
          :title="t('collection.noRuns')"
          :text="t('collection.noRunsHint')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.antiphon-script-nav {
  width: 170px;
}
</style>
