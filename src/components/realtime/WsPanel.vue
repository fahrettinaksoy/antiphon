<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { nanoid } from 'nanoid'
import KeyValueEditor from '../request/KeyValueEditor.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import type { RequestTab } from '../../stores/tabs'
import type { WsEvent } from '@shared/ipc-contract'

const tab = defineModel<RequestTab>({ required: true })

interface TimelineEntry {
  id: string
  direction: 'in' | 'out' | 'system'
  data: string
  timestamp: number
}

const connectionId = nanoid(10)
const isConnected = ref(false)
const isConnecting = ref(false)
const messages = ref<TimelineEntry[]>([])
const draft = ref('')
let unsubscribe: (() => void) | null = null

function pushEntry(direction: TimelineEntry['direction'], data: string) {
  messages.value.push({ id: nanoid(6), direction, data, timestamp: Date.now() })
}

function handleEvent(event: WsEvent) {
  if (event.connectionId !== connectionId) return
  if (event.type === 'open') {
    isConnected.value = true
    isConnecting.value = false
    pushEntry('system', 'Bağlantı kuruldu')
  } else if (event.type === 'message') {
    pushEntry('in', event.data ?? '')
  } else if (event.type === 'close') {
    isConnected.value = false
    isConnecting.value = false
    pushEntry('system', `Bağlantı kapandı (${event.code ?? ''} ${event.reason ?? ''})`.trim())
  } else if (event.type === 'error') {
    isConnecting.value = false
    pushEntry('system', `Hata: ${event.message}`)
  }
}

async function connect() {
  if (!tab.value.url) return
  isConnecting.value = true
  await ipc.connectWebSocket(connectionId, tab.value.url, tab.value.headers)
}

async function disconnect() {
  await ipc.closeWebSocket(connectionId)
}

async function sendMessage() {
  if (!draft.value || !isConnected.value) return
  await ipc.sendWebSocketMessage(connectionId, draft.value, false)
  pushEntry('out', draft.value)
  draft.value = ''
}

onMounted(() => {
  unsubscribe = ipc.onWebSocketEvent(handleEvent)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  if (isConnected.value) ipc.closeWebSocket(connectionId)
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center ga-2 pa-3">
      <v-chip size="small" :color="isConnected ? 'success' : 'medium-emphasis'" variant="tonal" class="antiphon-mono">
        {{ isConnected ? 'BAĞLI' : 'BAĞLI DEĞİL' }}
      </v-chip>
      <v-text-field
        v-model="tab.url"
        placeholder="wss://example.com/socket"
        class="antiphon-mono"
        density="comfortable"
        hide-details
        :disabled="isConnected"
      />
      <v-btn
        v-if="!isConnected"
        color="primary"
        :loading="isConnecting"
        prepend-icon="mdi-connection"
        class="text-none"
        @click="connect"
      >
        Bağlan
      </v-btn>
      <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-close-circle-outline" class="text-none" @click="disconnect">
        Kes
      </v-btn>
    </div>
    <v-divider />

    <v-row no-gutters class="flex-grow-1 overflow-hidden">
      <v-col cols="4" class="h-100 overflow-y-auto pa-3">
        <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold mb-2">Header'lar</div>
        <KeyValueEditor v-model="tab.headers" />
      </v-col>
      <v-divider vertical />
      <v-col cols="8" class="h-100 d-flex flex-column">
        <div class="flex-grow-1 overflow-y-auto pa-3">
          <div
            v-for="entry in messages"
            :key="entry.id"
            class="d-flex ga-2 py-1 text-body-2"
            :class="{ 'text-medium-emphasis': entry.direction === 'system' }"
          >
            <v-icon
              :icon="entry.direction === 'out' ? 'mdi-arrow-up-bold' : entry.direction === 'in' ? 'mdi-arrow-down-bold' : 'mdi-information-outline'"
              size="14"
              :color="entry.direction === 'out' ? 'primary' : entry.direction === 'in' ? 'secondary' : undefined"
            />
            <span class="antiphon-mono text-truncate" style="white-space: pre-wrap">{{ entry.data }}</span>
          </div>
          <AppEmptyState v-if="messages.length === 0" size="compact" icon="mdi-message-outline" title="Henüz mesaj yok" />
        </div>
        <v-divider />
        <div class="d-flex ga-2 pa-3">
          <v-text-field
            v-model="draft"
            placeholder="Gönderilecek mesaj"
            class="antiphon-mono"
            density="comfortable"
            hide-details
            :disabled="!isConnected"
            @keydown.enter="sendMessage"
          />
          <v-btn color="primary" :disabled="!isConnected" class="text-none" @click="sendMessage">Gönder</v-btn>
        </div>
      </v-col>
    </v-row>
  </div>
</template>
