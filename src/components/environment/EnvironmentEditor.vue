<script setup lang="ts">
import type { RequestTab } from '../../stores/tabs'
// Ortam düzenleyici sekmesi — ortamlar da istek/koleksiyon gibi ana alanda düzenlenir.
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useEnvironmentsStore } from '../../stores/environments'
import KeyValueEditor from '../request/KeyValueEditor.vue'

const tab = defineModel<RequestTab>({ required: true })
const { t } = useI18n()
const environmentsStore = useEnvironmentsStore()

const isActive = computed(() => environmentsStore.activeEnvironmentPath === tab.value.requestPath)

function toggleActive() {
  environmentsStore.selectEnvironment(isActive.value ? null : tab.value.requestPath)
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <!-- Başlık: ad + aktiflik durumu -->
    <div class="d-flex align-center ga-3 px-4 py-3">
      <v-icon icon="mdi-layers-triple-outline" color="primary" size="22" />
      <div class="flex-grow-1" style="min-width: 0">
        <div class="text-body-2 font-weight-bold text-truncate">{{ tab.name }}</div>
        <div class="text-caption text-medium-emphasis">{{ t('environment.subtitle') }}</div>
      </div>
      <v-chip v-if="isActive" size="small" color="primary" variant="tonal">{{
        t('environment.active')
      }}</v-chip>
      <v-btn
        size="small"
        :variant="isActive ? 'text' : 'tonal'"
        class="text-none"
        @click="toggleActive"
      >
        {{ isActive ? t('actions.clear') : t('environment.makeActive') }}
      </v-btn>
    </div>

    <div class="flex-grow-1 overflow-y-auto pa-4">
      <v-card variant="tonal" class="pa-4">
        <div class="text-subtitle-2 mb-1">{{ t('environment.variables') }}</div>
        <p class="text-caption text-medium-emphasis mb-2">{{ t('environment.variablesHint') }}</p>
        <KeyValueEditor v-model="tab.variables" />
      </v-card>
    </div>
  </div>
</template>
