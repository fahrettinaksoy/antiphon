<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { nanoid } from 'nanoid'
import KeyValueEditor from '../request/KeyValueEditor.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import { useFormat } from '../../composables/useFormat'
import type { RequestTab } from '../../stores/tabs'
import type { SseEvent } from '@shared/ipc-contract'

const tab = defineModel<RequestTab>({ required: true })
const fmt = useFormat()

interface TimelineEntry {
  id: string
  eventName: string
  data: string
  timestamp: number
  isSystem: boolean
}

const connectionId = nanoid(10)
const isConnected = ref(false)
const isConnecting = ref(false)
const messages = ref<TimelineEntry[]>([])
let unsubscribe: (() => void) | null = null

function pushEntry(eventName: string, data: string, isSystem = false) {
  messages.value.push({ id: nanoid(6), eventName, data, timestamp: Date.now(), isSystem })
}

function handleEvent(event: SseEvent) {
  if (event.connectionId !== connectionId) return
  if (event.type === 'open') {
    isConnected.value = true
    isConnecting.value = false
    pushEntry('system', 'Akış açıldı', true)
  } else if (event.type === 'message') {
    pushEntry(event.eventName ?? 'message', event.data ?? '')
  } else if (event.type === 'close') {
    isConnected.value = false
    isConnecting.value = false
    pushEntry('system', 'Akış kapandı', true)
  } else if (event.type === 'error') {
    isConnecting.value = false
    isConnected.value = false
    pushEntry('system', `Hata: ${event.message}`, true)
  }
}

async function connect() {
  if (!tab.value.url) return
  isConnecting.value = true
  messages.value = []
  await ipc.connectSse(connectionId, tab.value.url, tab.value.headers)
}

async function disconnect() {
  await ipc.closeSse(connectionId)
}

onMounted(() => {
  unsubscribe = ipc.onSseEvent(handleEvent)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  if (isConnected.value) ipc.closeSse(connectionId)
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center ga-2 pa-3">
      <v-chip size="small" :color="isConnected ? 'success' : 'medium-emphasis'" variant="tonal" class="antiphon-mono">
        {{ isConnected ? 'AÇIK' : 'KAPALI' }}
      </v-chip>
      <v-text-field
        v-model="tab.url"
        placeholder="https://example.com/events"
        class="antiphon-mono"
        density="comfortable"
        hide-details
        :disabled="isConnected"
      />
      <v-btn
        v-if="!isConnected"
        color="primary"
        :loading="isConnecting"
        prepend-icon="mdi-access-point"
        class="text-none"
        @click="connect"
      >
        Dinle
      </v-btn>
      <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-close-circle-outline" class="text-none" @click="disconnect">
        Durdur
      </v-btn>
    </div>
    <v-divider />

    <v-row no-gutters class="flex-grow-1 overflow-hidden">
      <v-col cols="4" class="h-100 overflow-y-auto pa-3">
        <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold mb-2">Header'lar</div>
        <KeyValueEditor v-model="tab.headers" />
      </v-col>
      <v-divider vertical />
      <v-col cols="8" class="h-100 overflow-y-auto pa-3">
        <div v-for="entry in messages" :key="entry.id" class="py-1">
          <div class="d-flex ga-2 align-center">
            <v-chip size="x-small" variant="tonal" :color="entry.isSystem ? undefined : 'secondary'" class="antiphon-mono">
              {{ entry.eventName }}
            </v-chip>
            <span class="text-caption text-medium-emphasis">{{ fmt.time(entry.timestamp) }}</span>
          </div>
          <pre v-if="!entry.isSystem" class="antiphon-mono text-body-2 mt-1">{{ entry.data }}</pre>
        </div>
        <AppEmptyState v-if="messages.length === 0" size="compact" icon="mdi-lightning-bolt-outline" title="Henüz event yok" />
      </v-col>
    </v-row>
  </div>
</template>
