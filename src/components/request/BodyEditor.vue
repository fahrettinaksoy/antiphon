<script setup lang="ts">
import { computed } from 'vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import AppEmptyState from '../common/AppEmptyState.vue'

const mode = defineModel<'none' | 'json' | 'form' | 'multipart' | 'binary' | 'raw'>('mode', { required: true })
const rawContent = defineModel<string | undefined>('content', { required: true })

const modes = ['none', 'json', 'form', 'multipart', 'binary', 'raw'] as const

const language = computed(() => (mode.value === 'json' ? 'json' : 'text'))

const content = computed<string>({
  get: () => rawContent.value ?? '',
  set: (value) => {
    rawContent.value = value
  }
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex ga-1 pa-2">
      <v-btn
        v-for="m in modes"
        :key="m"
        size="small"
        variant="text"
        :color="mode === m ? 'primary' : undefined"
        class="text-none"
        @click="mode = m"
      >
        {{ m }}
      </v-btn>
    </div>
    <v-divider />
    <CodeMirrorEditor
      v-if="mode !== 'none' && mode !== 'multipart' && mode !== 'binary'"
      v-model="content"
      :language="language"
      class="flex-grow-1"
    />
    <AppEmptyState
      v-else-if="mode === 'none'"
      size="compact"
      icon="mdi-code-braces"
      title="Bu istek gövde içermiyor"
    />
    <div v-else class="d-flex align-center justify-center flex-grow-1 text-medium-emphasis text-body-2">
      {{ mode === 'multipart' ? 'Multipart form-data düzenleyici yakında' : 'Binary dosya seçici yakında' }}
    </div>
  </div>
</template>
