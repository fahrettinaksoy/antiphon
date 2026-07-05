<script setup lang="ts">
import { ref } from 'vue'
import { useEnvironmentsStore } from '../../stores/environments'
import EnvironmentManagerDialog from './EnvironmentManagerDialog.vue'

const environmentsStore = useEnvironmentsStore()
const managerOpen = ref(false)

function handleSelect(path: string | null) {
  environmentsStore.selectEnvironment(path)
}
</script>

<template>
  <div class="d-flex align-center ga-1">
    <v-select
      :model-value="environmentsStore.activeEnvironmentPath"
      :items="[{ title: 'Environment yok', value: null }, ...environmentsStore.list.map((e) => ({ title: e.name, value: e.path }))]"
      density="compact"
      hide-details
      style="min-width: 180px"
      @update:model-value="handleSelect"
    />
    <v-btn icon="mdi-cog-outline" size="small" variant="text" title="Environment yönet" @click="managerOpen = true" />
    <EnvironmentManagerDialog v-model="managerOpen" />
  </div>
</template>
