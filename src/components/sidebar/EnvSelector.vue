<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n'
import { useEnvironmentsStore } from '../../stores/environments'
import { useTabsStore } from '../../stores/tabs'

const router = useRouter()
const { t } = useI18n()
const environmentsStore = useEnvironmentsStore()
const tabsStore = useTabsStore()

function handleSelect(path: string | null) {
  environmentsStore.selectEnvironment(path)
}

// Kalem, SEÇİLİ ortamın düzenleyici sekmesini açar; seçim yoksa uyarı gösterilir.
const noSelectionWarning = ref(false)
async function editActiveEnvironment() {
  const active = environmentsStore.activeEnvironment
  if (!active) {
    noSelectionWarning.value = true
    return
  }
  await tabsStore.openEnvironment(active.path, active.name)
  if (router.currentRoute.value.path !== '/') router.push('/')
}
</script>

<template>
  <div class="d-flex align-center ga-1">
    <v-select
      :model-value="environmentsStore.activeEnvironmentPath"
      :items="[
        { title: 'Environment yok', value: null },
        ...environmentsStore.list.map((e) => ({ title: e.name, value: e.path }))
      ]"
      density="compact"
      hide-details
      style="min-width: 180px"
      @update:model-value="handleSelect"
    />
    <v-btn
      icon="mdi-square-edit-outline"
      size="small"
      variant="text"
      :title="t('environment.editSelected')"
      @click="editActiveEnvironment"
    />

    <v-snackbar v-model="noSelectionWarning" :timeout="3000" color="warning" variant="tonal">
      {{ t('environment.selectFirst') }}
    </v-snackbar>
  </div>
</template>
