<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { openSearchPanel } from '@codemirror/search'
import type { EditorView } from 'codemirror'
import { JSONPath } from 'jsonpath-plus'
import { useI18n } from '@/composables/i18n'
import type { HttpResponsePayload } from '@shared/ipc-contract'
import { useFormat } from '../../composables/useFormat'
import AppEmptyState from '../common/AppEmptyState.vue'
import AppLtr from '../common/AppLtr.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'

const props = defineProps<{ response: HttpResponsePayload | null; isLoading: boolean; error?: string | null }>()

const { t } = useI18n()
const fmt = useFormat()
const activeTab = ref('body')

const statusColor = computed(() => {
  const status = props.response?.status ?? 0
  if (status >= 500) return 'error'
  if (status >= 400) return 'warning'
  if (status >= 300) return 'info'
  if (status >= 200) return 'success'
  return 'medium-emphasis'
})

// Durum sınıfına göre kısa açıklama (hover kartı)
const statusHint = computed(() => {
  const status = props.response?.status ?? 0
  if (status >= 500) return t('response.status5xx')
  if (status >= 400) return t('response.status4xx')
  if (status >= 300) return t('response.status3xx')
  return t('response.status2xx')
})

// Zamanlama dökümü (hover kartı): şelale çubukları için oran + kümülatif ofset
const timingPhases = computed(() => {
  const timing = props.response?.timing
  if (!timing) return []
  const total = Math.max(timing.total, 1)
  const phases = [
    { label: t('response.timingPrepare'), value: timing.prepare ?? 0, color: 'secondary' },
    { label: t('response.timingSocket'), value: timing.socketInit ?? 0, color: 'warning' },
    { label: t('response.timingDns'), value: timing.dns, color: 'info' },
    { label: t('response.timingTcp'), value: timing.tcp, color: 'secondary' },
    { label: t('response.timingTls'), value: timing.tls, color: 'warning' },
    { label: t('response.timingTtfb'), value: timing.ttfb, color: 'error' },
    { label: t('response.timingDownload'), value: timing.download, color: 'success' },
    { label: t('response.timingProcess'), value: timing.process ?? 0, color: 'secondary' }
  ]
  let offset = 0
  return phases.map((phase) => {
    const start = (offset / total) * 100
    const width = Math.max((phase.value / total) * 100, phase.value > 0 ? 1 : 0)
    offset += phase.value
    return { ...phase, start, width }
  })
})

// Başlıkların yaklaşık boyutu ("k: v\r\n" baytları)
const headersSizeBytes = computed(() =>
  Object.entries(props.response?.headers ?? {}).reduce((sum, [key, value]) => sum + key.length + String(value).length + 4, 0)
)

// Ağ kartı satırları (yalnızca dolu alanlar)
const networkRows = computed(() => {
  const net = props.response?.network
  if (!net) return []
  const rows: { label: string; value: string }[] = []
  if (net.httpVersion) rows.push({ label: t('response.httpVersion'), value: net.httpVersion })
  if (net.localAddress) rows.push({ label: t('response.localAddress'), value: net.localAddress })
  if (net.remoteAddress) rows.push({ label: t('response.remoteAddress'), value: net.remoteAddress })
  if (net.tlsProtocol) rows.push({ label: t('response.tlsProtocol'), value: net.tlsProtocol })
  if (net.cipherName) rows.push({ label: t('response.cipherName'), value: net.cipherName })
  if (net.certCn) rows.push({ label: t('response.certCn'), value: net.certCn })
  if (net.certIssuerCn) rows.push({ label: t('response.certIssuerCn'), value: net.certIssuerCn })
  if (net.certValidUntil) rows.push({ label: t('response.certValidUntil'), value: net.certValidUntil })
  return rows
})

// --- Gövde görüntüleme ---
const contentType = computed(() => {
  const headers = props.response?.headers ?? {}
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
  return key ? headers[key] : ''
})

// İçerik türünden vurgulama dili (rozet olarak da gösterilir).
const bodyLanguage = computed<'json' | 'html' | 'xml' | 'javascript' | 'text'>(() => {
  const type = contentType.value
  if (/json/i.test(type)) return 'json'
  if (/html/i.test(type)) return 'html'
  if (/xml/i.test(type)) return 'xml'
  if (/javascript/i.test(type)) return 'javascript'
  return 'text'
})

const isBinary = computed(() => props.response?.bodyEncoding === 'base64')

// JSON gövdeler otomatik biçimlendirilir (pretty-print); geçersizse ham gösterilir.
const parsedJson = computed<unknown>(() => {
  if (bodyLanguage.value !== 'json' || !props.response) return undefined
  try {
    return JSON.parse(props.response.body)
  } catch {
    return undefined
  }
})

// JSONPath filtresi (Postman'deki "Filter using JSONPath" karşılığı) — ör. $.result.head
const filterBarOpen = ref(false)
const filterPath = ref('')
const filteredJson = computed<unknown>(() => {
  if (parsedJson.value === undefined || !filterBarOpen.value || !filterPath.value.trim()) return parsedJson.value
  try {
    const results = JSONPath({ path: filterPath.value.trim(), json: parsedJson.value as never, wrap: true }) as unknown[]
    if (results.length === 0) return undefined
    return results.length === 1 ? results[0] : results
  } catch {
    return undefined
  }
})
const filterHasNoMatch = computed(
  () => filterBarOpen.value && filterPath.value.trim() !== '' && parsedJson.value !== undefined && filteredJson.value === undefined
)

const displayBody = computed(() => {
  if (!props.response) return ''
  if (parsedJson.value !== undefined) {
    if (filterHasNoMatch.value) return ''
    const source = filteredJson.value !== undefined ? filteredJson.value : parsedJson.value
    return JSON.stringify(source, null, 2)
  }
  return props.response.body
})

// Metin görünümünde CodeMirror'ın bul panelini açar (⌘F ile de erişilir).
const editorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)
function openSearch() {
  const view = editorRef.value?.view as EditorView | null | undefined
  if (!view) return
  openSearchPanel(view)
  view.focus()
}

// Metin / Ağaç görünümü (ağaç yalnızca geçerli JSON'da)
const viewMode = ref<'text' | 'tree'>('text')
const wrapLines = ref(false)

// TEMBEL ağaç: büyük yanıtlarda takılmayı önlemek için yalnızca görünen seviye
// kurulur; dal açıldığında çocuklar o anda üretilir (v-treeview load-children).
interface JsonTreeItem {
  id: string
  /** Erişilebilirlik/yedek başlık; görsel render #title slotundaki parçalarla yapılır. */
  title: string
  keyLabel: string
  kind: 'object' | 'array' | 'leaf' | 'slice'
  count?: number
  valueText?: string
  valueKind?: 'string' | 'number' | 'boolean' | 'null'
  children?: JsonTreeItem[]
}
// Dizi çocukları CHUNK'lık aralıklara bölünür ("[0 … 99]") — tek açılımda yüzlerce
// satırdan fazlası hiç çizilmez, dev yanıtlarda bile akıcı kalır.
const TREE_CHUNK = 100
interface TreeNodeSource {
  value: unknown
  /** Dizi dilimlerinde mutlak başlangıç indeksi (etiketler için). */
  offset: number
}
const treeNodeValues = new Map<string, TreeNodeSource>()
let treeNodeId = 0

function makeTreeItem(value: unknown, key: string): JsonTreeItem {
  const id = `n${treeNodeId++}`
  if (Array.isArray(value)) {
    treeNodeValues.set(id, { value, offset: 0 })
    return { id, title: `${key} [${value.length}]`, keyLabel: key, kind: 'array', count: value.length, children: [] }
  }
  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value).length
    treeNodeValues.set(id, { value, offset: 0 })
    return { id, title: `${key} {${count}}`, keyLabel: key, kind: 'object', count, children: [] }
  }
  const valueKind = value === null ? 'null' : (typeof value as 'string' | 'number' | 'boolean')
  const valueText = value === null ? 'null' : typeof value === 'string' ? value : String(value)
  return { id, title: `${key}: ${valueText}`, keyLabel: key, kind: 'leaf', valueText, valueKind }
}

function buildChildren(source: TreeNodeSource): JsonTreeItem[] {
  const { value, offset } = source
  if (Array.isArray(value)) {
    if (value.length > TREE_CHUNK) {
      const slices: JsonTreeItem[] = []
      for (let start = 0; start < value.length; start += TREE_CHUNK) {
        const end = Math.min(start + TREE_CHUNK - 1, value.length - 1)
        const id = `n${treeNodeId++}`
        treeNodeValues.set(id, { value: value.slice(start, end + 1), offset: offset + start })
        const label = `[${offset + start} … ${offset + end}]`
        slices.push({ id, title: label, keyLabel: label, kind: 'slice', children: [] })
      }
      return slices
    }
    return value.map((item, index) => makeTreeItem(item, String(offset + index)))
  }
  return Object.entries(value as Record<string, unknown>).map(([key, child]) => makeTreeItem(child, key))
}

async function loadTreeChildren(rawItem: unknown) {
  const item = rawItem as JsonTreeItem
  const source = treeNodeValues.get(item.id)
  if (source === undefined || !item.children || item.children.length > 0) return
  item.children.push(...buildChildren(source))
}

const treeSource = computed<unknown>(() => {
  if (parsedJson.value === undefined || filterHasNoMatch.value) return undefined
  return filteredJson.value !== undefined ? filteredJson.value : parsedJson.value
})
const jsonTreeItems = ref<JsonTreeItem[]>([])
watch(
  treeSource,
  (source) => {
    treeNodeValues.clear()
    treeNodeId = 0
    if (source === undefined) {
      jsonTreeItems.value = []
      return
    }
    // İlk seviye hemen; gerisi açıldıkça.
    jsonTreeItems.value =
      source !== null && typeof source === 'object' ? buildChildren({ value: source, offset: 0 }) : [makeTreeItem(source, '$')]
  },
  { immediate: true }
)

// Yanıtın set-cookie başlığından çerezler (Expires içindeki virgüle takılmayan bölme).
const responseCookies = computed(() => {
  const headers = props.response?.headers ?? {}
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'set-cookie')
  if (!key || !headers[key]) return []
  return headers[key]
    .split(/,(?=\s*[^;,\s]+?=)/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const [pair, ...attrs] = raw.split(';')
      const eq = pair.indexOf('=')
      return {
        name: eq === -1 ? pair.trim() : pair.slice(0, eq).trim(),
        value: eq === -1 ? '' : pair.slice(eq + 1).trim(),
        attributes: attrs.map((a) => a.trim()).join('; ')
      }
    })
})

const copied = ref(false)
async function copyBody() {
  await navigator.clipboard.writeText(displayBody.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <!-- Sekmeler solda; durum/süre/boyut sağda (Postman düzeni) -->
    <div v-if="response" class="d-flex align-center pr-3">
      <v-tabs v-model="activeTab" density="compact" class="flex-grow-1" style="min-width: 0">
        <v-tab value="body">{{ t('response.tabs.body') }}</v-tab>
        <v-tab value="headers">
          {{ t('response.tabs.headers') }}
          <span v-if="Object.keys(response.headers).length" class="antiphon-tab-count">
            {{ Object.keys(response.headers).length }}
          </span>
        </v-tab>
        <v-tab value="cookies">{{ t('response.tabs.cookies') }}</v-tab>
        <v-tab value="tests">
          {{ t('response.tabs.tests') }}
          <v-chip
            v-if="response.testResults?.length"
            size="x-small"
            class="ml-2"
            :color="response.testResults.every((r) => r.passed) ? 'success' : 'error'"
            variant="tonal"
          >
            {{ response.testResults.filter((r) => r.passed).length }}/{{ response.testResults.length }}
          </v-chip>
        </v-tab>
      </v-tabs>
      <div class="d-flex align-center ga-3 flex-shrink-0 ml-2">
        <!-- Durum: hover kartında kısa açıklama -->
        <v-menu open-on-hover :open-delay="150" location="bottom end" :close-on-content-click="false">
          <template #activator="{ props: hoverProps }">
            <v-chip v-bind="hoverProps" :color="statusColor" variant="tonal" size="small" class="antiphon-mono font-weight-bold">
              {{ response.status }} {{ response.statusText }}
            </v-chip>
          </template>
          <v-card min-width="280" max-width="340" class="pa-3">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-check-circle" size="16" :color="statusColor" />
              <span class="text-subtitle-2 antiphon-mono">{{ response.status }} {{ response.statusText }}</span>
            </div>
            <p class="text-caption text-medium-emphasis mb-0">{{ statusHint }}</p>
          </v-card>
        </v-menu>

        <!-- Süre: hover kartında şelale dökümü -->
        <v-menu open-on-hover :open-delay="150" location="bottom end" :close-on-content-click="false">
          <template #activator="{ props: hoverProps }">
            <span v-bind="hoverProps" class="text-caption text-medium-emphasis antiphon-mono antiphon-meta-hover">
              {{ fmt.ms(response.timing.total) }}
            </span>
          </template>
          <v-card min-width="340" class="pa-3">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">{{ t('response.responseTime') }}</span>
              <span class="text-caption antiphon-mono font-weight-bold">{{ fmt.msDecimal(response.timing.total) }}</span>
            </div>
            <div v-for="phase in timingPhases" :key="phase.label" class="d-flex align-center ga-2 py-1">
              <span class="text-caption text-medium-emphasis antiphon-timing-label">{{ phase.label }}</span>
              <div class="antiphon-timing-track flex-grow-1">
                <div
                  class="antiphon-timing-bar"
                  :style="{ marginLeft: phase.start + '%', width: phase.width + '%', background: `rgb(var(--v-theme-${phase.color}))` }"
                />
              </div>
              <span class="text-caption antiphon-mono antiphon-timing-value">{{ fmt.msDecimal(phase.value) }}</span>
            </div>
          </v-card>
        </v-menu>

        <!-- Boyut: hover kartında başlık/gövde dökümü -->
        <v-menu open-on-hover :open-delay="150" location="bottom end" :close-on-content-click="false">
          <template #activator="{ props: hoverProps }">
            <span v-bind="hoverProps" class="text-caption text-medium-emphasis antiphon-mono antiphon-meta-hover">
              {{ fmt.kb(response.sizeBytes) }}
            </span>
          </template>
          <v-card min-width="280" class="pa-3">
            <!-- Yanıt boyutu -->
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon icon="mdi-arrow-down-circle" size="16" color="info" />
              <span class="text-subtitle-2">{{ t('response.responseSize') }}</span>
              <v-spacer />
              <span class="text-caption antiphon-mono font-weight-bold">{{ fmt.kb(headersSizeBytes + response.sizeBytes) }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption py-1 pl-6">
              <span class="text-medium-emphasis">{{ t('response.sizeHeaders') }}</span>
              <span class="antiphon-mono">{{ fmt.kb(headersSizeBytes) }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption py-1 pl-6">
              <span class="text-medium-emphasis">{{ t('response.sizeBody') }}</span>
              <span class="antiphon-mono">{{ fmt.kb(response.sizeBytes) }}</span>
            </div>

            <!-- İstek boyutu -->
            <template v-if="response.requestSize">
              <v-divider class="my-2" />
              <div class="d-flex align-center ga-2 mb-1">
                <v-icon icon="mdi-arrow-up-circle" size="16" color="warning" />
                <span class="text-subtitle-2">{{ t('response.requestSize') }}</span>
                <v-spacer />
                <span class="text-caption antiphon-mono font-weight-bold">
                  {{ fmt.kb(response.requestSize.headers + response.requestSize.body) }}
                </span>
              </div>
              <div class="d-flex justify-space-between text-caption py-1 pl-6">
                <span class="text-medium-emphasis">{{ t('response.sizeHeaders') }}</span>
                <span class="antiphon-mono">{{ fmt.kb(response.requestSize.headers) }}</span>
              </div>
              <div class="d-flex justify-space-between text-caption py-1 pl-6">
                <span class="text-medium-emphasis">{{ t('response.sizeBody') }}</span>
                <span class="antiphon-mono">{{ fmt.kb(response.requestSize.body) }}</span>
              </div>
            </template>
          </v-card>
        </v-menu>

        <!-- Ağ: hover kartında bağlantı/TLS bilgisi -->
        <v-menu v-if="networkRows.length" open-on-hover :open-delay="150" location="bottom end" :close-on-content-click="false">
          <template #activator="{ props: hoverProps }">
            <v-icon v-bind="hoverProps" icon="mdi-web" size="16" class="text-medium-emphasis antiphon-meta-hover" />
          </template>
          <v-card min-width="320" class="pa-3">
            <div class="text-subtitle-2 mb-1">{{ t('response.network') }}</div>
            <div v-for="row in networkRows" :key="row.label" class="d-flex justify-space-between ga-4 text-caption py-1">
              <span class="text-medium-emphasis flex-shrink-0">{{ row.label }}</span>
              <span class="antiphon-mono text-truncate">{{ row.value }}</span>
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>

    <div v-if="isLoading" class="d-flex align-center justify-center flex-grow-1">
      <v-progress-circular indeterminate color="primary" />
      <span class="ml-3 text-body-2 text-medium-emphasis">{{ t('response.waiting') }}</span>
    </div>

    <div v-else-if="error" class="d-flex flex-column align-center justify-center flex-grow-1 text-error pa-6 text-center">
      <v-icon icon="mdi-alert-circle-outline" size="40" class="mb-2" />
      <span class="text-body-2">{{ error }}</span>
    </div>

    <AppEmptyState v-else-if="!response" icon="mdi-tray-arrow-down" :title="t('response.placeholder')" />

    <!-- v-window yerine v-if: sekme geçişlerinde eski içeriğin ekranda kalmasını
         (üst üste binme) önler; ağır editör/ağaç DOM'da da tutulmaz. -->
    <div v-else class="flex-grow-1 overflow-hidden d-flex flex-column">
      <!-- Gövde: araç çubuğu + metin (CodeMirror) veya ağaç görünümü -->
      <div v-if="activeTab === 'body'" class="h-100 d-flex flex-column">
        <div class="d-flex align-center ga-1 px-3 py-1 flex-shrink-0">
          <v-btn-toggle v-if="parsedJson !== undefined" v-model="viewMode" density="compact" mandatory color="primary">
            <v-btn value="text" size="x-small" class="text-none">{{ t('response.viewText') }}</v-btn>
            <v-btn value="tree" size="x-small" class="text-none">{{ t('response.viewTree') }}</v-btn>
          </v-btn-toggle>
          <v-chip size="x-small" variant="tonal" class="antiphon-mono ml-1" lang="en">{{ bodyLanguage.toUpperCase() }}</v-chip>
          <v-spacer />
          <v-btn
            v-if="parsedJson !== undefined"
            icon="mdi-filter-variant"
            size="x-small"
            variant="text"
            :color="filterBarOpen ? 'primary' : undefined"
            :title="t('response.filter')"
            @click="filterBarOpen = !filterBarOpen"
          />
          <v-btn
            v-if="viewMode === 'text'"
            icon="mdi-magnify"
            size="x-small"
            variant="text"
            :title="t('response.search')"
            @click="openSearch"
          />
          <v-btn
            icon="mdi-wrap"
            size="x-small"
            variant="text"
            :color="wrapLines ? 'primary' : undefined"
            :title="t('response.wrap')"
            @click="wrapLines = !wrapLines"
          />
          <v-btn
            :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
            size="x-small"
            variant="text"
            :title="copied ? t('response.copied') : t('response.copy')"
            @click="copyBody"
          />
        </div>

        <!-- JSONPath filtre çubuğu (Postman: "Filter using JSONPath") -->
        <div v-if="filterBarOpen && parsedJson !== undefined" class="d-flex align-center ga-2 px-3 pb-1 flex-shrink-0">
          <v-text-field
            v-model="filterPath"
            :placeholder="t('response.filterPlaceholder')"
            density="compact"
            hide-details
            clearable
            prepend-inner-icon="mdi-filter-variant"
            rounded="lg"
            class="antiphon-mono"
          />
          <v-chip v-if="filterHasNoMatch" size="x-small" color="warning" variant="tonal" class="flex-shrink-0">
            {{ t('response.noMatch') }}
          </v-chip>
        </div>

        <p v-if="isBinary" class="text-caption text-medium-emphasis pa-4">{{ t('response.binaryBody') }}</p>

        <!-- Ağaç görünümü (yalnızca geçerli JSON) -->
        <div v-else-if="viewMode === 'tree' && parsedJson !== undefined" class="flex-grow-1 overflow-y-auto px-2">
          <AppLtr>
            <v-treeview
              :items="jsonTreeItems"
              :load-children="loadTreeChildren"
              item-value="id"
              item-title="title"
              density="compact"
              indent-lines="default"
              indent-lines-opacity="0.15"
              class="antiphon-json-tree antiphon-mono"
            >
              <!-- Anahtar / değer / sayaç parçaları tema token'larıyla renklendirilir -->
              <template #title="{ item }">
                <span :class="item.kind === 'slice' ? 'antiphon-json-slice' : 'antiphon-json-key'">{{ item.keyLabel }}</span>
                <template v-if="item.kind === 'leaf'">
                  <span class="antiphon-json-punct"> : </span>
                  <span :class="`antiphon-json-value antiphon-json-value--${item.valueKind}`">{{ item.valueText }}</span>
                </template>
                <template v-else-if="item.kind === 'object' || item.kind === 'array'">
                  <span class="antiphon-json-punct"> : {{ item.kind === 'array' ? '[' : '{' }} </span>
                  <span class="antiphon-json-count">
                    {{ item.count }} {{ item.kind === 'array' ? t('response.items') : t('response.props') }}
                  </span>
                  <span class="antiphon-json-punct"> {{ item.kind === 'array' ? ']' : '}' }}</span>
                </template>
              </template>
            </v-treeview>
          </AppLtr>
        </div>

        <!-- Metin görünümü: vurgulamalı, salt-okunur editör -->
        <div v-else class="flex-grow-1 overflow-hidden">
          <CodeMirrorEditor ref="editorRef" :model-value="displayBody" :language="bodyLanguage" :wrap="wrapLines" read-only class="h-100" />
        </div>
      </div>

      <!-- Başlıklar: KEY/VALUE tablosu -->
      <div v-else-if="activeTab === 'headers'" class="pa-3 h-100 overflow-y-auto">
        <AppLtr>
          <v-table class="antiphon-response-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(value, key) in response.headers" :key="key">
                <td class="antiphon-mono text-medium-emphasis antiphon-response-table__key">{{ key }}</td>
                <td class="antiphon-mono">{{ value }}</td>
              </tr>
            </tbody>
          </v-table>
        </AppLtr>
      </div>
      <!-- Çerezler: yoksa boş durum, varsa tablo -->
      <div v-else-if="activeTab === 'cookies'" class="pa-3 h-100 overflow-y-auto d-flex flex-column">
        <AppEmptyState
          v-if="responseCookies.length === 0"
          icon="mdi-cookie-off-outline"
          :title="t('response.noCookies')"
          :text="t('response.noCookiesHint')"
        />
        <v-table v-else class="antiphon-response-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>{{ t('response.cookieAttributes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cookie in responseCookies" :key="cookie.name">
              <td class="antiphon-mono text-medium-emphasis antiphon-response-table__key">{{ cookie.name }}</td>
              <td class="antiphon-mono">{{ cookie.value }}</td>
              <td class="antiphon-mono text-medium-emphasis">{{ cookie.attributes }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Zamanlama ayrı sekme DEĞİL: dökümü üstteki süre rozetinin hover kartı gösterir. -->
      <div v-else-if="activeTab === 'tests'" class="pa-3 h-100 overflow-y-auto d-flex flex-column">
        <AppEmptyState
          v-if="!response.testResults?.length"
          icon="mdi-test-tube-empty"
          :title="t('response.noTests')"
          :text="t('response.noTestsHint')"
        />
        <div v-for="(test, i) in response.testResults" :key="i" class="d-flex align-start ga-2 py-1">
          <v-icon :icon="test.passed ? 'mdi-check-circle' : 'mdi-close-circle'" :color="test.passed ? 'success' : 'error'" size="18" />
          <div>
            <div class="text-body-2">{{ test.name }}</div>
            <div v-if="!test.passed && test.error" class="text-caption text-error antiphon-mono">{{ test.error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Başlık tablosu: tonal zeminde şeffaf, anahtar sütunu sabit genişlikte */
.antiphon-response-table {
  background: transparent;
}
.antiphon-response-table :deep(th) {
  font-size: 11px !important;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
}
.antiphon-response-table__key {
  width: 240px;
  white-space: nowrap;
}
.antiphon-json-tree {
  font-size: 13px;
  background: transparent;
}
.antiphon-json-tree :deep(.v-list-item) {
  min-height: 26px;
}

/* Meta hover hedefleri ve zamanlama şelalesi */
.antiphon-meta-hover {
  cursor: default;
}
.antiphon-timing-label {
  width: 110px;
  flex-shrink: 0;
}
.antiphon-timing-value {
  width: 64px;
  flex-shrink: 0;
  text-align: end;
}
.antiphon-timing-track {
  height: 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  overflow: hidden;
}
.antiphon-timing-bar {
  height: 100%;
  border-radius: 4px;
  min-width: 0;
}

/* JSON ağacı renkleri — tümü tema token'larından (açık/koyu/yüksek kontrast uyumlu) */
.antiphon-json-key {
  color: rgb(var(--v-theme-primary));
}
.antiphon-json-slice {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.antiphon-json-punct {
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.antiphon-json-value--string {
  color: rgb(var(--v-theme-method-post));
}
.antiphon-json-value--number {
  color: rgb(var(--v-theme-info));
}
.antiphon-json-value--boolean {
  color: rgb(var(--v-theme-method-patch));
}
.antiphon-json-value--null {
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-style: italic;
}
/* Sayaç rozeti ("3 öğe" / "4 özellik") — soluk tonal etiket */
.antiphon-json-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
