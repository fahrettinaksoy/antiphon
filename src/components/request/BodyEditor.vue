<script setup lang="ts">
import type { KeyValueRow } from './KeyValueEditor.vue'
import { computed, ref, watch } from 'vue'
import { ipc } from '@/lib/ipc'
import AppEmptyState from '../common/AppEmptyState.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import KeyValueEditor from './KeyValueEditor.vue'

type BodyMode = 'none' | 'json' | 'form' | 'multipart' | 'binary' | 'raw'
type RawLanguage = 'text' | 'javascript' | 'json' | 'html' | 'xml'

const mode = defineModel<BodyMode>('mode', { required: true })
const rawContent = defineModel<string | undefined>('content', { required: true })

// Görünen mod seçenekleri (Postman düzeni). 'json', "raw + JSON dili"nin persist edilmiş halidir;
// radyo grubunda ayrı görünmez, raw seçiliyken dil menüsünden yönetilir.
const RADIO_MODES: { value: Exclude<BodyMode, 'json'>; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'multipart', label: 'form-data' },
  { value: 'form', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'binary', label: 'binary' }
]

// raw dili: JSON, dosyaya 'json' modu olarak yazılır; diğerleri yalnızca vurgulama içindir.
const rawLanguage = ref<RawLanguage>(mode.value === 'json' ? 'json' : 'text')

const radioMode = computed<Exclude<BodyMode, 'json'>>({
  get: () => (mode.value === 'json' ? 'raw' : mode.value),
  set: (value) => {
    mode.value = value === 'raw' && rawLanguage.value === 'json' ? 'json' : value
  }
})

watch(rawLanguage, (lang) => {
  if (mode.value === 'raw' || mode.value === 'json') mode.value = lang === 'json' ? 'json' : 'raw'
})
const rawLanguageOptions: { title: string; value: RawLanguage }[] = [
  { title: 'Text', value: 'text' },
  { title: 'JavaScript', value: 'javascript' },
  { title: 'JSON', value: 'json' },
  { title: 'HTML', value: 'html' },
  { title: 'XML', value: 'xml' }
]

const content = computed<string>({
  get: () => rawContent.value ?? '',
  set: (value) => {
    rawContent.value = value
  }
})

// form / multipart: satırlar content'te urlencoded olarak saklanır (Postman import formatıyla uyumlu).
const rows = ref<KeyValueRow[]>([])
function parseRows(text: string): KeyValueRow[] {
  const list: KeyValueRow[] = []
  new URLSearchParams(text).forEach((value, key) => list.push({ key, value, enabled: true }))
  return list
}
function serializeRows(list: KeyValueRow[]): string {
  const params = new URLSearchParams()
  for (const row of list) if (row.enabled && row.key !== '') params.append(row.key, row.value)
  return params.toString()
}
watch(
  mode,
  (current) => {
    if (current === 'form' || current === 'multipart')
      rows.value = parseRows(rawContent.value ?? '')
  },
  { immediate: true }
)
watch(
  rows,
  (list) => {
    if (mode.value === 'form' || mode.value === 'multipart') rawContent.value = serializeRows(list)
  },
  { deep: true }
)

// binary: content mutlak dosya yolunu tutar.
async function chooseFile() {
  const path = await ipc.chooseFile()
  if (path) rawContent.value = path
}

const showEditor = computed(() => mode.value === 'raw' || mode.value === 'json')
const editorLanguage = computed<RawLanguage>(() =>
  mode.value === 'json' ? 'json' : rawLanguage.value
)
</script>

<template>
  <div class="d-flex flex-column h-100">
    <!-- Mod seçimi: Postman benzeri radyo satırı; raw seçiliyken sağda dil menüsü -->
    <div class="d-flex align-center ga-2 px-3 flex-wrap">
      <v-radio-group
        v-model="radioMode"
        inline
        hide-details
        density="compact"
        class="antiphon-body-modes"
      >
        <v-radio
          v-for="option in RADIO_MODES"
          :key="option.value"
          :value="option.value"
          :label="option.label"
          color="primary"
        />
      </v-radio-group>
      <v-spacer />
      <v-select
        v-if="showEditor"
        v-model="rawLanguage"
        :items="rawLanguageOptions"
        density="compact"
        hide-details
        variant="plain"
        class="antiphon-body-language flex-grow-0"
      />
    </div>

    <!-- raw / json: kod editörü -->
    <CodeMirrorEditor
      v-if="showEditor"
      v-model="content"
      :language="editorLanguage"
      class="flex-grow-1"
    />

    <!-- form-data / x-www-form-urlencoded: standart key-value tablosu -->
    <div v-else-if="mode === 'form' || mode === 'multipart'" class="pa-3 overflow-y-auto">
      <KeyValueEditor v-model="rows" />
    </div>

    <!-- binary: dosya seçimi -->
    <div v-else-if="mode === 'binary'" class="pa-4">
      <div class="d-flex ga-2 align-center" style="max-width: 520px">
        <v-text-field
          :model-value="content"
          readonly
          placeholder="Dosya seçilmedi"
          density="compact"
          hide-details
          prepend-inner-icon="mdi-file-outline"
          class="antiphon-mono"
        />
        <v-btn
          variant="tonal"
          class="text-none flex-shrink-0"
          prepend-icon="mdi-paperclip"
          @click="chooseFile"
        >
          Dosya Seç
        </v-btn>
      </div>
      <p class="text-caption text-medium-emphasis mt-2">
        Dosya içeriği istekle birlikte
        <span class="antiphon-mono">application/octet-stream</span> olarak gönderilir.
      </p>
    </div>

    <AppEmptyState v-else size="compact" icon="mdi-code-braces" title="Bu istek gövde içermiyor" />
  </div>
</template>

<style scoped>
.antiphon-body-modes :deep(.v-label) {
  font-size: 13px;
}
.antiphon-body-modes :deep(.v-selection-control) {
  min-height: 36px;
}
.antiphon-body-language {
  min-width: 110px;
}
.antiphon-body-language :deep(.v-field__input) {
  font-size: 13px;
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 32px;
}
</style>
