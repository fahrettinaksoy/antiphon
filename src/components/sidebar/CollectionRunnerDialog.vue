<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEnvironmentsStore } from '../../stores/environments'
import { useFormat } from '../../composables/useFormat'
import type { CollectionRunProgressEvent, CollectionRunResultDto } from '@shared/ipc-contract'

const open = defineModel<boolean>({ required: true })
const fmt = useFormat()
const props = defineProps<{ folderPath: string | null; folderName: string }>()

const workspaceStore = useWorkspaceStore()
const environmentsStore = useEnvironmentsStore()

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

async function run() {
  if (!props.folderPath || !workspaceStore.rootPath) return
  results.value = []
  progress.value = { index: 0, total: 0 }
  isRunning.value = true
  runId.value = nanoid(8)
  try {
    await ipc.runCollection(runId.value, props.folderPath, workspaceStore.rootPath, environmentsStore.activeVariables)
  } finally {
    isRunning.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    results.value = []
    progress.value = { index: 0, total: 0 }
  }
})

onMounted(() => {
  unsubscribe = ipc.onCollectionRunProgress(handleProgress)
})
onBeforeUnmount(() => unsubscribe?.())

function statusColor(result: CollectionRunResultDto): string {
  if (result.error || result.status === null) return 'error'
  if (result.tests.length > 0 && result.tests.some((t) => !t.passed)) return 'error'
  if (result.status >= 400) return 'warning'
  return 'success'
}

const passCount = () => results.value.filter((r) => statusColor(r) === 'success').length
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card :title="`Koleksiyonu Çalıştır — ${folderName}`" rounded="lg">
      <v-card-text>
        <div class="d-flex align-center ga-3 mb-3">
          <v-btn color="primary" variant="flat" :loading="isRunning" prepend-icon="mdi-play" class="text-none" @click="run">
            Çalıştır
          </v-btn>
          <span v-if="progress.total > 0" class="text-caption text-medium-emphasis">
            {{ progress.index }} / {{ progress.total }}
          </span>
          <v-spacer />
          <v-chip v-if="results.length > 0" size="small" variant="tonal" :color="passCount() === results.length ? 'success' : 'warning'">
            {{ passCount() }}/{{ results.length }} başarılı
          </v-chip>
        </div>

        <v-progress-linear v-if="isRunning" :model-value="(progress.index / Math.max(progress.total, 1)) * 100" color="primary" class="mb-3" />

        <v-list density="compact">
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
              <span v-if="result.tests.length"> · {{ result.tests.filter((t) => t.passed).length }}/{{ result.tests.length }} test</span>
              <span v-if="result.error" class="text-error"> · {{ result.error }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <p v-if="!isRunning && results.length === 0" class="text-caption text-medium-emphasis">
          Bu klasördeki tüm istekler sırayla çalıştırılacak.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="open = false">Kapat</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
