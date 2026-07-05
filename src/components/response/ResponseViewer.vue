<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import type { HttpResponsePayload } from '@shared/ipc-contract'
import { useFormat } from '../../composables/useFormat'
import AppEmptyState from '../common/AppEmptyState.vue'
import AppLtr from '../common/AppLtr.vue'

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
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div v-if="response" class="d-flex align-center ga-4 px-3 py-2">
      <v-chip :color="statusColor" variant="tonal" size="small" class="antiphon-mono font-weight-bold">
        {{ response.status }} {{ response.statusText }}
      </v-chip>
      <span class="text-caption text-medium-emphasis antiphon-mono">{{ fmt.ms(response.timing.total) }}</span>
      <span class="text-caption text-medium-emphasis antiphon-mono">{{ fmt.kb(response.sizeBytes) }}</span>
    </div>
    <v-divider v-if="response" />

    <v-tabs v-if="response" v-model="activeTab" density="compact">
      <v-tab value="body">{{ t('response.tabs.body') }}</v-tab>
      <v-tab value="headers">{{ t('response.tabs.headers') }}</v-tab>
      <v-tab value="cookies">{{ t('response.tabs.cookies') }}</v-tab>
      <v-tab value="timing">{{ t('response.tabs.timing') }}</v-tab>
      <v-tab value="tests">
        {{ t('response.tabs.tests') }}
        <v-chip
          v-if="response?.testResults?.length"
          size="x-small"
          class="ml-2"
          :color="response.testResults.every((r) => r.passed) ? 'success' : 'error'"
          variant="tonal"
        >
          {{ response.testResults.filter((r) => r.passed).length }}/{{ response.testResults.length }}
        </v-chip>
      </v-tab>
    </v-tabs>
    <v-divider v-if="response" />

    <div v-if="isLoading" class="d-flex align-center justify-center flex-grow-1">
      <v-progress-circular indeterminate color="primary" />
      <span class="ml-3 text-body-2 text-medium-emphasis">{{ t('response.waiting') }}</span>
    </div>

    <div v-else-if="error" class="d-flex flex-column align-center justify-center flex-grow-1 text-error pa-6 text-center">
      <v-icon icon="mdi-alert-circle-outline" size="40" class="mb-2" />
      <span class="text-body-2">{{ error }}</span>
    </div>

    <AppEmptyState
      v-else-if="!response"
      icon="mdi-tray-arrow-down"
      :title="t('response.placeholder')"
    />

    <v-window v-else v-model="activeTab" class="flex-grow-1 overflow-y-auto">
      <v-window-item value="body" class="pa-3">
        <!-- Yanıt gövdesi (JSON/XML/HTML) her zaman LTR. -->
        <AppLtr>
          <pre class="antiphon-mono text-body-2">{{ response.body }}</pre>
        </AppLtr>
      </v-window-item>
      <v-window-item value="headers" class="pa-3">
        <AppLtr>
          <div v-for="(value, key) in response.headers" :key="key" class="d-flex ga-2 antiphon-mono text-body-2 py-1">
            <span class="text-medium-emphasis">{{ key }}:</span>
            <span>{{ value }}</span>
          </div>
        </AppLtr>
      </v-window-item>
      <v-window-item value="cookies" class="pa-3 text-body-2 text-medium-emphasis">—</v-window-item>
      <v-window-item value="timing" class="pa-3">
        <div v-for="(value, key) in response.timing" :key="key" class="d-flex justify-space-between antiphon-mono text-body-2 py-1">
          <span class="text-medium-emphasis">{{ key }}</span>
          <span>{{ fmt.msDecimal(value) }}</span>
        </div>
      </v-window-item>
      <v-window-item value="tests" class="pa-3">
        <div v-if="!response.testResults?.length" class="text-body-2 text-medium-emphasis">
          Test script tanımlanmadı veya sonuç üretmedi.
        </div>
        <div v-for="(test, i) in response.testResults" :key="i" class="d-flex align-start ga-2 py-1">
          <v-icon :icon="test.passed ? 'mdi-check-circle' : 'mdi-close-circle'" :color="test.passed ? 'success' : 'error'" size="18" />
          <div>
            <div class="text-body-2">{{ test.name }}</div>
            <div v-if="!test.passed && test.error" class="text-caption text-error antiphon-mono">{{ test.error }}</div>
          </div>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>
