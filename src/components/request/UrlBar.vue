<script setup lang="ts">
import type { KeyValue } from '@schema/request'
import type { HttpMethod } from '../../stores/tabs'
import { useI18n } from '@/composables/i18n'
import { ipc } from '@/lib/ipc'
import AppLtr from '../common/AppLtr.vue'
import MethodSelect from './MethodSelect.vue'

const emit = defineEmits<{ send: []; save: [] }>()
const method = defineModel<HttpMethod>('method', { required: true })
const url = defineModel<string>('url', { required: true })
const headers = defineModel<KeyValue[]>('headers', { required: true })

const { t } = useI18n()

async function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!text.trim().toLowerCase().startsWith('curl ')) return

  event.preventDefault()
  const parsed = await ipc.parseCurl(text)
  method.value = parsed.method
  url.value = parsed.url
  if (parsed.headers.length > 0) headers.value = [...headers.value, ...parsed.headers]
}
</script>

<template>
  <div class="d-flex align-center ga-2 pa-3">
    <MethodSelect v-model="method" />
    <!-- URL her zaman LTR (RTL dilde bile). display:contents olduğu için flex düzeni korunur. -->
    <AppLtr>
      <v-text-field
        v-model="url"
        :placeholder="t('request.urlPlaceholder')"
        class="antiphon-mono"
        density="comfortable"
        hide-details
        @keydown.enter="emit('send')"
        @paste="handlePaste"
      />
    </AppLtr>
    <v-btn
      color="primary"
      prepend-icon="mdi-send-variant-outline"
      class="text-none"
      @click="emit('send')"
    >
      {{ t('actions.send') }}
    </v-btn>
    <v-btn
      icon="mdi-content-save-outline"
      variant="text"
      :title="t('actions.save')"
      @click="emit('save')"
    />
  </div>
</template>
