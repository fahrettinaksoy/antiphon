<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { computed } from 'vue'
import { watchDebounced } from '@vueuse/core'
import UrlBar from '../request/UrlBar.vue'
import RequestPanel from '../request/RequestPanel.vue'
import ResponseViewer from '../response/ResponseViewer.vue'
import WsPanel from '../realtime/WsPanel.vue'
import SsePanel from '../realtime/SsePanel.vue'
import GraphqlPanel from '../graphql/GraphqlPanel.vue'
import McpPanel from '../mcp/McpPanel.vue'
import CollectionEditor from '../collection/CollectionEditor.vue'
import { useTabsStore } from '../../stores/tabs'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEnvironmentsStore } from '../../stores/environments'
import { useHistoryStore } from '../../stores/history'
import { useResponsesStore } from '../../stores/responses'

const props = defineProps<{ tabId: string | null }>()

const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()
const environmentsStore = useEnvironmentsStore()
const historyStore = useHistoryStore()
const responsesStore = useResponsesStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId) ?? null)
const responseState = computed(() => (props.tabId ? responsesStore.forTab(props.tabId) : { response: null, error: null, isLoading: false }))

async function sendActiveRequest() {
  const current = tab.value
  if (!current || !current.url) return
  responsesStore.setLoading(current.id)
  const startedAt = Date.now()
  try {
    const result = await ipc.sendRequest({
      id: current.id,
      name: current.name,
      method: current.method,
      url: current.url,
      headers: current.headers,
      params: current.params,
      body: current.body,
      auth: current.auth,
      settings: current.settings,
      environmentVariables: environmentsStore.activeVariables,
      requestPath: current.requestPath ?? undefined,
      workspaceRoot: workspaceStore.rootPath ?? undefined,
      preRequestScript: current.preRequestScript,
      testScript: current.testScript
    })
    responsesStore.setResult(current.id, result)
    historyStore.record({
      requestName: current.name,
      method: current.method,
      url: current.url,
      headers: current.headers,
      params: current.params,
      body: current.body,
      auth: current.auth,
      status: result.status,
      durationMs: result.timing.total,
      sentAt: startedAt
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    responsesStore.setError(current.id, message)
    historyStore.record({
      requestName: current.name,
      method: current.method,
      url: current.url,
      headers: current.headers,
      params: current.params,
      body: current.body,
      auth: current.auth,
      status: null,
      durationMs: Date.now() - startedAt,
      sentAt: startedAt
    })
  }
}

async function saveActiveTab() {
  if (tab.value) {
    tabsStore.markDirty(tab.value.id)
    await tabsStore.saveTab(tab.value.id)
  }
}

watchDebounced(
  tab,
  (current, previous) => {
    if (current && previous && current.id === previous.id && current.requestPath) {
      tabsStore.markDirty(current.id)
      tabsStore.saveTab(current.id)
    }
  },
  { deep: true, debounce: 600 }
)

defineExpose({ saveActiveTab })
</script>

<template>
  <div v-if="tab" class="d-flex flex-column h-100">
    <template v-if="tab.kind === 'collection'">
      <CollectionEditor v-model="tab" />
    </template>

    <template v-else-if="tab.protocol === 'ws'">
      <WsPanel v-model="tab" />
    </template>

    <template v-else-if="tab.protocol === 'sse'">
      <SsePanel v-model="tab" />
    </template>

    <template v-else-if="tab.protocol === 'graphql'">
      <GraphqlPanel v-model="tab" />
    </template>

    <template v-else-if="tab.protocol === 'mcp'">
      <McpPanel v-model="tab" />
    </template>

    <template v-else>
      <UrlBar
        v-model:method="tab.method"
        v-model:url="tab.url"
        v-model:headers="tab.headers"
        @send="sendActiveRequest"
        @save="saveActiveTab"
      />
      <v-row no-gutters class="flex-grow-1 overflow-hidden">
        <v-col cols="6" class="h-100 overflow-hidden">
          <RequestPanel v-model="tab" />
        </v-col>
        <!-- MD3: istek/yanıt ayrımı çizgiyle değil yanıt panelinin tonal yüzeyiyle yapılır. -->
        <v-col cols="6" class="h-100 overflow-hidden bg-surface-light">
          <ResponseViewer :response="responseState.response" :is-loading="responseState.isLoading" :error="responseState.error" />
        </v-col>
      </v-row>
    </template>
  </div>

  <div v-else class="d-flex align-center justify-center h-100 text-medium-emphasis text-body-2">
    Görüntülenecek bir tab seçin
  </div>
</template>
