<script setup lang="ts">
export interface KeyValueRow {
  key: string
  value: string
  enabled: boolean
}

const rows = defineModel<KeyValueRow[]>({ required: true })

function addRow() {
  rows.value.push({ key: '', value: '', enabled: true })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function ensureTrailingRow() {
  const last = rows.value[rows.value.length - 1]
  if (!last || last.key !== '' || last.value !== '') addRow()
}

ensureTrailingRow()
</script>

<template>
  <div class="antiphon-kv-grid">
    <div v-for="(row, index) in rows" :key="index" class="d-flex align-center ga-2 py-1">
      <v-checkbox-btn v-model="row.enabled" density="compact" />
      <v-text-field v-model="row.key" placeholder="key" density="compact" hide-details class="antiphon-mono" />
      <v-text-field
        v-model="row.value"
        placeholder="value"
        density="compact"
        hide-details
        class="antiphon-mono"
        @update:model-value="ensureTrailingRow"
      />
      <v-btn icon="mdi-close" size="x-small" variant="text" :disabled="index === rows.length - 1" @click="removeRow(index)" />
    </div>
  </div>
</template>
