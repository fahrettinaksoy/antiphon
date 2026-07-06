<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { onBeforeUnmount, ref } from 'vue'
import { nanoid } from 'nanoid'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import type { RequestTab } from '../../stores/tabs'
import type { McpPromptSummaryDto, McpResourceSummaryDto, McpToolSummaryDto } from '@shared/ipc-contract'

const tab = defineModel<RequestTab>({ required: true })

const connectionId = nanoid(10)
const isConnected = ref(false)
const isConnecting = ref(false)
const connectError = ref<string | null>(null)

const activeSection = ref('tools')
const tools = ref<McpToolSummaryDto[]>([])
const resources = ref<McpResourceSummaryDto[]>([])
const prompts = ref<McpPromptSummaryDto[]>([])

const selectedTool = ref<McpToolSummaryDto | null>(null)
const toolArgsJson = ref('{}')
const toolResult = ref('')
const isCallingTool = ref(false)

const selectedResourceUri = ref<string | null>(null)
const resourceResult = ref('')

async function connect() {
  connectError.value = null
  isConnecting.value = true
  try {
    if (tab.value.mcpTransport === 'stdio') {
      const [command, ...args] = tab.value.mcpCommand.trim().split(/\s+/)
      await ipc.connectMcp(connectionId, { transport: 'stdio', command, args })
    } else {
      await ipc.connectMcp(connectionId, { transport: 'http', url: tab.value.url })
    }
    isConnected.value = true
    await refreshAll()
  } catch (error) {
    connectError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isConnecting.value = false
  }
}

async function disconnect() {
  await ipc.disconnectMcp(connectionId)
  isConnected.value = false
  tools.value = []
  resources.value = []
  prompts.value = []
}

async function refreshAll() {
  const [t, r, p] = await Promise.all([
    ipc.listMcpTools(connectionId).catch(() => []),
    ipc.listMcpResources(connectionId).catch(() => []),
    ipc.listMcpPrompts(connectionId).catch(() => [])
  ])
  tools.value = t
  resources.value = r
  prompts.value = p
}

function selectTool(tool: McpToolSummaryDto) {
  selectedTool.value = tool
  toolArgsJson.value = '{}'
  toolResult.value = ''
}

async function callTool() {
  if (!selectedTool.value) return
  isCallingTool.value = true
  try {
    const args = toolArgsJson.value.trim() ? JSON.parse(toolArgsJson.value) : {}
    const result = await ipc.callMcpTool(connectionId, selectedTool.value.name, args)
    toolResult.value = JSON.stringify(result, null, 2)
  } catch (error) {
    toolResult.value = `Hata: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isCallingTool.value = false
  }
}

async function readResource(uri: string) {
  selectedResourceUri.value = uri
  try {
    const result = await ipc.readMcpResource(connectionId, uri)
    resourceResult.value = JSON.stringify(result, null, 2)
  } catch (error) {
    resourceResult.value = `Hata: ${error instanceof Error ? error.message : String(error)}`
  }
}

onBeforeUnmount(() => {
  if (isConnected.value) ipc.disconnectMcp(connectionId)
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center ga-2 pa-3">
      <v-chip size="small" :color="isConnected ? 'success' : 'medium-emphasis'" variant="tonal">
        {{ isConnected ? 'BAĞLI' : 'BAĞLI DEĞİL' }}
      </v-chip>
      <v-btn-toggle
        v-model="tab.mcpTransport"
        density="comfortable"
        color="primary"
        mandatory
        :disabled="isConnected"
      >
        <v-btn value="stdio" size="small">stdio</v-btn>
        <v-btn value="http" size="small">HTTP</v-btn>
      </v-btn-toggle>
      <v-text-field
        v-if="tab.mcpTransport === 'stdio'"
        v-model="tab.mcpCommand"
        placeholder="npx -y @modelcontextprotocol/server-example"
        class="antiphon-mono"
        density="comfortable"
        hide-details
        :disabled="isConnected"
      />
      <v-text-field
        v-else
        v-model="tab.url"
        placeholder="https://example.com/mcp"
        class="antiphon-mono"
        density="comfortable"
        hide-details
        :disabled="isConnected"
      />
      <v-btn v-if="!isConnected" color="primary" :loading="isConnecting" prepend-icon="mdi-connection" class="text-none" @click="connect">
        Bağlan
      </v-btn>
      <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-close-circle-outline" class="text-none" @click="disconnect">
        Kes
      </v-btn>
    </div>
    <p v-if="connectError" class="text-error text-caption px-3">{{ connectError }}</p>
    <v-divider />

    <AppEmptyState
      v-if="!isConnected"
      icon="mdi-connection"
      title="Bağlantı bekleniyor"
      text="MCP sunucusuna bağlanınca tool/resource/prompt listesi burada görünecek"
    />

    <template v-else>
      <v-tabs v-model="activeSection" density="compact">
        <v-tab value="tools">Tools ({{ tools.length }})</v-tab>
        <v-tab value="resources">Resources ({{ resources.length }})</v-tab>
        <v-tab value="prompts">Prompts ({{ prompts.length }})</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="activeSection" class="flex-grow-1 overflow-hidden">
        <v-window-item value="tools" class="h-100">
          <v-row no-gutters class="h-100 overflow-hidden">
            <v-col cols="4" class="h-100 overflow-y-auto">
              <v-list density="compact">
                <v-list-item
                  v-for="toolItem in tools"
                  :key="toolItem.name"
                  :active="selectedTool?.name === toolItem.name"
                  @click="selectTool(toolItem)"
                >
                  <v-list-item-title class="antiphon-mono text-body-2">{{ toolItem.name }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption">{{ toolItem.description }}</v-list-item-subtitle>
                </v-list-item>
                <p v-if="tools.length === 0" class="text-caption text-disabled pa-3">Bu sunucu tool sunmuyor</p>
              </v-list>
            </v-col>
            <v-divider vertical />
            <v-col cols="8" class="h-100 d-flex flex-column overflow-hidden">
              <template v-if="selectedTool">
                <div class="text-caption text-medium-emphasis px-3 py-1">Argümanlar (JSON)</div>
                <CodeMirrorEditor v-model="toolArgsJson" language="json" style="height: 35%" />
                <div class="px-3 py-2">
                  <v-btn color="primary" size="small" :loading="isCallingTool" class="text-none" @click="callTool">Çağır</v-btn>
                </div>
                <v-divider />
                <div class="flex-grow-1 overflow-y-auto pa-3">
                  <pre class="antiphon-mono text-body-2">{{ toolResult }}</pre>
                </div>
              </template>
              <div v-else class="d-flex align-center justify-center flex-grow-1 text-medium-emphasis text-body-2">
                Bir tool seçin
              </div>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="resources" class="h-100">
          <v-row no-gutters class="h-100 overflow-hidden">
            <v-col cols="4" class="h-100 overflow-y-auto">
              <v-list density="compact">
                <v-list-item
                  v-for="resource in resources"
                  :key="resource.uri"
                  :active="selectedResourceUri === resource.uri"
                  @click="readResource(resource.uri)"
                >
                  <v-list-item-title class="text-body-2">{{ resource.name ?? resource.uri }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption antiphon-mono">{{ resource.uri }}</v-list-item-subtitle>
                </v-list-item>
                <p v-if="resources.length === 0" class="text-caption text-disabled pa-3">Bu sunucu resource sunmuyor</p>
              </v-list>
            </v-col>
            <v-divider vertical />
            <v-col cols="8" class="h-100 overflow-y-auto pa-3">
              <pre class="antiphon-mono text-body-2">{{ resourceResult }}</pre>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="prompts" class="h-100 overflow-y-auto">
          <v-list density="compact">
            <v-list-item v-for="prompt in prompts" :key="prompt.name">
              <v-list-item-title class="antiphon-mono text-body-2">{{ prompt.name }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ prompt.description }}</v-list-item-subtitle>
            </v-list-item>
            <p v-if="prompts.length === 0" class="text-caption text-disabled pa-3">Bu sunucu prompt sunmuyor</p>
          </v-list>
        </v-window-item>
      </v-window>
    </template>
  </div>
</template>
