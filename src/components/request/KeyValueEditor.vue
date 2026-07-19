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
  <!-- MD data table: başlık satırlı tablo; hücre içi düzenleme "plain" alanlarla yapılır.
       density/hover global VTable varsayılanından gelir. -->
  <v-table class="antiphon-kv-table">
    <thead>
      <tr>
        <th class="antiphon-kv-table__check"></th>
        <th>Key</th>
        <th>Value</th>
        <th class="antiphon-kv-table__actions"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in rows" :key="index">
        <td class="antiphon-kv-table__check">
          <v-checkbox-btn v-model="row.enabled" density="compact" />
        </td>
        <td>
          <v-text-field
            v-model="row.key"
            placeholder="key"
            variant="plain"
            density="compact"
            hide-details
            class="antiphon-mono"
            @update:model-value="ensureTrailingRow"
          />
        </td>
        <td>
          <v-text-field
            v-model="row.value"
            placeholder="value"
            variant="plain"
            density="compact"
            hide-details
            class="antiphon-mono"
            @update:model-value="ensureTrailingRow"
          />
        </td>
        <td class="antiphon-kv-table__actions">
          <v-btn
            icon="mdi-close"
            size="x-small"
            variant="text"
            :disabled="index === rows.length - 1"
            @click="removeRow(index)"
          />
        </td>
      </tr>
    </tbody>
  </v-table>
</template>

<style scoped>
/* Tonal kartların içinde tablo kendi 'surface' arka planını getirmesin. */
.antiphon-kv-table {
  background: transparent;
}
.antiphon-kv-table__check {
  width: 44px;
}
.antiphon-kv-table__actions {
  width: 44px;
  text-align: right;
}
.antiphon-kv-table :deep(th) {
  font-size: 11px !important;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
}
/* Plain variant'ın varsayılan üst dolgusunu tablo satırına göre sıkılaştır. */
.antiphon-kv-table :deep(.v-field__input) {
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 32px;
  font-size: 13px;
}
</style>
