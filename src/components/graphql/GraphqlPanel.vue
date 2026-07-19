<script setup lang="ts">
import type { GraphqlSubscriptionEvent, HttpResponsePayload } from '@shared/ipc-contract'
import type { GraphQLSchema, IntrospectionQuery } from 'graphql'
import type { RequestTab } from '../../stores/tabs'
import { buildClientSchema, getIntrospectionQuery } from 'graphql'
import { nanoid } from 'nanoid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ipc } from '@/lib/ipc'
import { useFormat } from '../../composables/useFormat'
import { useEnvironmentsStore } from '../../stores/environments'
import AppEmptyState from '../common/AppEmptyState.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import KeyValueEditor from '../request/KeyValueEditor.vue'
import ResponseViewer from '../response/ResponseViewer.vue'
import SchemaExplorer from './SchemaExplorer.vue'

const tab = defineModel<RequestTab>({ required: true })
const fmt = useFormat()
const environmentsStore = useEnvironmentsStore()

const schema = ref<GraphQLSchema | null>(null)
const isSchemaLoading = ref(false)
const isExecuting = ref(false)
const response = ref<HttpResponsePayload | null>(null)
const executionError = ref<string | null>(null)

const subscriptionConnectionId = nanoid(10)
const isSubscribed = ref(false)
const subscriptionEvents = ref<{ id: string; data: string; timestamp: number }[]>([])
let unsubscribeEvents: (() => void) | null = null

const isSubscriptionQuery = computed(() => tab.value.graphqlQuery.trim().startsWith('subscription'))
const leftPanelView = ref<'schema' | 'headers'>('schema')

async function fetchSchema() {
  if (!tab.value.url) return
  isSchemaLoading.value = true
  try {
    const result = await ipc.sendRequest({
      id: nanoid(8),
      name: `${tab.value.name}__introspection`,
      method: 'POST',
      url: tab.value.url,
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        ...tab.value.headers
      ],
      params: [],
      body: { mode: 'json', content: JSON.stringify({ query: getIntrospectionQuery() }) },
      auth: tab.value.auth,
      environmentVariables: environmentsStore.activeVariables
    })
    const parsed = JSON.parse(result.body) as { data: IntrospectionQuery }
    schema.value = buildClientSchema(parsed.data)
  } catch (error) {
    executionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSchemaLoading.value = false
  }
}

async function executeQuery() {
  if (!tab.value.url || !tab.value.graphqlQuery) return
  isExecuting.value = true
  executionError.value = null
  try {
    let variables: Record<string, unknown> = {}
    if (tab.value.graphqlVariables.trim()) variables = JSON.parse(tab.value.graphqlVariables)

    response.value = await ipc.sendRequest({
      id: nanoid(8),
      name: tab.value.name,
      method: 'POST',
      url: tab.value.url,
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        ...tab.value.headers
      ],
      params: [],
      body: { mode: 'json', content: JSON.stringify({ query: tab.value.graphqlQuery, variables }) },
      auth: tab.value.auth,
      environmentVariables: environmentsStore.activeVariables
    })
  } catch (error) {
    executionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isExecuting.value = false
  }
}

function deriveWsUrl(httpUrl: string): string {
  try {
    const url = new URL(httpUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  } catch {
    return httpUrl
  }
}

function handleSubscriptionEvent(event: GraphqlSubscriptionEvent) {
  if (event.connectionId !== subscriptionConnectionId) return
  if (event.type === 'next' && event.data) {
    subscriptionEvents.value.push({ id: nanoid(6), data: event.data, timestamp: event.timestamp })
  } else if (event.type === 'error') {
    executionError.value = event.message ?? 'Subscription hatası'
    isSubscribed.value = false
  } else if (event.type === 'complete') {
    isSubscribed.value = false
  } else if (event.type === 'open') {
    isSubscribed.value = true
  }
}

async function startSubscription() {
  subscriptionEvents.value = []
  let variables: Record<string, unknown> = {}
  if (tab.value.graphqlVariables.trim()) variables = JSON.parse(tab.value.graphqlVariables)
  await ipc.subscribeGraphql(
    subscriptionConnectionId,
    deriveWsUrl(tab.value.url),
    tab.value.graphqlQuery,
    variables,
    tab.value.headers
  )
}

async function stopSubscription() {
  await ipc.unsubscribeGraphql(subscriptionConnectionId)
  isSubscribed.value = false
}

async function execute() {
  if (isSubscriptionQuery.value) {
    if (isSubscribed.value) await stopSubscription()
    else await startSubscription()
  } else {
    await executeQuery()
  }
}

onMounted(() => {
  unsubscribeEvents = ipc.onGraphqlSubscriptionEvent(handleSubscriptionEvent)
})

onBeforeUnmount(() => {
  unsubscribeEvents?.()
  if (isSubscribed.value) ipc.unsubscribeGraphql(subscriptionConnectionId)
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center ga-2 pa-3">
      <v-text-field
        v-model="tab.url"
        placeholder="https://api.example.com/graphql"
        class="antiphon-mono"
        density="comfortable"
        hide-details
      />
      <v-btn
        variant="tonal"
        :loading="isSchemaLoading"
        prepend-icon="mdi-file-tree-outline"
        class="text-none"
        @click="fetchSchema"
      >
        Şemayı Getir
      </v-btn>
      <v-btn
        color="primary"
        :loading="isExecuting"
        :prepend-icon="
          isSubscriptionQuery ? (isSubscribed ? 'mdi-stop' : 'mdi-access-point') : 'mdi-play'
        "
        class="text-none"
        @click="execute"
      >
        {{ isSubscriptionQuery ? (isSubscribed ? 'Durdur' : 'Abone Ol') : 'Çalıştır' }}
      </v-btn>
    </div>
    <v-divider />

    <v-row no-gutters class="flex-grow-1 overflow-hidden">
      <v-col cols="3" class="h-100 d-flex flex-column overflow-hidden">
        <v-tabs v-model="leftPanelView" density="compact">
          <v-tab value="schema">Şema</v-tab>
          <v-tab value="headers">Header'lar</v-tab>
        </v-tabs>
        <v-divider />
        <div class="flex-grow-1 overflow-hidden">
          <SchemaExplorer
            v-if="leftPanelView === 'schema'"
            :schema="schema"
            :is-loading="isSchemaLoading"
          />
          <div v-else class="h-100 overflow-y-auto pa-3">
            <KeyValueEditor v-model="tab.headers" />
          </div>
        </div>
      </v-col>
      <v-divider vertical />

      <v-col cols="4" class="h-100 d-flex flex-column overflow-hidden">
        <div
          lang="en"
          class="text-caption text-medium-emphasis text-uppercase font-weight-bold px-3 py-1"
        >
          Query
        </div>
        <CodeMirrorEditor
          v-model="tab.graphqlQuery"
          language="graphql"
          :graphql-schema="schema ?? undefined"
          style="height: 60%"
        />
        <v-divider />
        <!-- lang="en": "Variables" VARİABLES değil VARIABLES olarak büyür. -->
        <div
          lang="en"
          class="text-caption text-medium-emphasis text-uppercase font-weight-bold px-3 py-1"
        >
          Variables
        </div>
        <CodeMirrorEditor v-model="tab.graphqlVariables" language="json" style="height: 30%" />
      </v-col>
      <v-divider vertical />

      <v-col cols="5" class="h-100 overflow-hidden">
        <ResponseViewer
          v-if="!isSubscriptionQuery"
          :response="response"
          :is-loading="isExecuting"
          :error="executionError"
        />
        <div v-else class="h-100 overflow-y-auto pa-3">
          <v-chip
            size="small"
            :color="isSubscribed ? 'success' : 'medium-emphasis'"
            variant="tonal"
            class="mb-2"
          >
            {{ isSubscribed ? 'DİNLENİYOR' : 'DURDU' }}
          </v-chip>
          <p v-if="executionError" class="text-error text-body-2">{{ executionError }}</p>
          <div v-for="event in subscriptionEvents" :key="event.id" class="py-1">
            <span class="text-caption text-medium-emphasis">{{ fmt.time(event.timestamp) }}</span>
            <pre class="antiphon-mono text-body-2">{{ event.data }}</pre>
          </div>
          <AppEmptyState
            v-if="subscriptionEvents.length === 0"
            size="compact"
            icon="mdi-lightning-bolt-outline"
            title="Henüz event yok"
          />
        </div>
      </v-col>
    </v-row>
  </div>
</template>
