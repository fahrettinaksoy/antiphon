<script setup lang="ts">
import { ref, watch } from 'vue'
import AppDefaults from '../common/AppDefaults.vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  initialValue?: string
  confirmLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; confirm: [string] }>()

const name = ref(props.initialValue ?? '')

watch(
  () => props.modelValue,
  (open) => {
    if (open) name.value = props.initialValue ?? ''
  }
)

function confirm() {
  if (!name.value.trim()) return
  emit('confirm', name.value.trim())
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="$emit('update:modelValue', $event)">
    <v-card :title="title" rounded="lg">
      <AppDefaults preset="dialogForm">
        <v-card-text>
          <v-text-field v-model="name" placeholder="Ad girin…" autofocus hide-details @keydown.enter="confirm" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <VBtnText @click="$emit('update:modelValue', false)">İptal</VBtnText>
          <VBtnPrimary @click="confirm">
            {{ confirmLabel ?? 'Oluştur' }}
          </VBtnPrimary>
        </v-card-actions>
      </AppDefaults>
    </v-card>
  </v-dialog>
</template>
