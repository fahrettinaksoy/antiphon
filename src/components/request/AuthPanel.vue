<script setup lang="ts">
import { computed } from 'vue'
import type { Auth } from '@schema/request'

const auth = defineModel<Auth>({ required: true })
// 'none' seçeneği bağlama göre yeniden etiketlenebilir: klasörlerde "Üst öğeden devral".
const props = withDefaults(defineProps<{ noneLabel?: string; noneHint?: string }>(), {
  noneLabel: 'Yok',
  noneHint: 'Bu istek için kimlik doğrulama uygulanmıyor.'
})

const authTypes = computed(() => [
  { title: props.noneLabel, value: 'none' },
  { title: 'Basic Auth', value: 'basic' },
  { title: 'Bearer Token', value: 'bearer' },
  { title: 'API Key', value: 'apiKey' },
  { title: 'JWT Bearer', value: 'jwt' }
])

const selectedType = computed<Auth['type']>({
  get: () => auth.value.type,
  set: (type) => {
    switch (type) {
      case 'none':
        auth.value = { type: 'none' }
        break
      case 'basic':
        auth.value = { type: 'basic', username: '', password: '' }
        break
      case 'bearer':
        auth.value = { type: 'bearer', token: '' }
        break
      case 'apiKey':
        auth.value = { type: 'apiKey', key: '', value: '', in: 'header' }
        break
      case 'jwt':
        auth.value = { type: 'jwt', secret: '' }
        break
    }
  }
})
</script>

<template>
  <div class="d-flex flex-column ga-3">
    <v-select v-model="selectedType" label="Kimlik doğrulama türü" :items="authTypes" style="max-width: 280px" />

    <template v-if="auth.type === 'basic'">
      <v-text-field v-model="auth.username" label="Kullanıcı adı" />
      <v-text-field v-model="auth.password" label="Parola" type="password" />
    </template>

    <template v-else-if="auth.type === 'bearer'">
      <v-text-field v-model="auth.token" label="Token" class="antiphon-mono" />
    </template>

    <template v-else-if="auth.type === 'apiKey'">
      <v-text-field v-model="auth.key" label="Key" class="antiphon-mono" />
      <v-text-field v-model="auth.value" label="Value" class="antiphon-mono" />
      <v-btn-toggle
        v-model="auth.in"
        mandatory
        color="primary"
        variant="outlined"
        density="comfortable"
        class="align-self-start"
      >
        <v-btn value="header">Header</v-btn>
        <v-btn value="query">Query Param</v-btn>
      </v-btn-toggle>
    </template>

    <template v-else-if="auth.type === 'jwt'">
      <v-text-field v-model="auth.secret" label="Secret (HS256)" class="antiphon-mono" />
    </template>

    <p v-else class="text-body-2 text-medium-emphasis">{{ noneHint }}</p>
  </div>
</template>
