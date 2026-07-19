<script setup lang="ts">
import type { Auth } from '@schema/request'
import { computed } from 'vue'
import { useI18n } from '@/composables/i18n'

// Koleksiyon, klasör ve istek editörlerinin ORTAK paneli. 'none' seçeneği bağlama göre
// etiketlenir: koleksiyonda "Yok" (devralacak üst öğe yok), klasör ve isteklerde varsayılan
// "Üst öğeden devral" — runner kalıtımı (resolveInheritedSettings) gerçekte böyle çözer.
const props = defineProps<{ noneLabel?: string; noneHint?: string }>()
const auth = defineModel<Auth>({ required: true })
const { t } = useI18n()

const noneTitle = computed(() => props.noneLabel ?? t('auth.inherit'))
const noneHintText = computed(() => props.noneHint ?? t('auth.inheritHint'))

const authTypes = computed(() => [
  { title: noneTitle.value, value: 'none' },
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
    <v-select
      v-model="selectedType"
      :label="t('auth.type')"
      :items="authTypes"
      style="max-width: 280px"
    />

    <template v-if="auth.type === 'basic'">
      <v-text-field
        v-model="auth.username"
        :label="t('auth.username')"
        placeholder="kullanici-adi"
      />
      <v-text-field
        v-model="auth.password"
        :label="t('auth.password')"
        type="password"
        placeholder="••••••••"
      />
    </template>

    <template v-else-if="auth.type === 'bearer'">
      <v-text-field
        v-model="auth.token"
        :label="t('auth.token')"
        placeholder="eyJhbGciOiJIUzI1NiJ9…"
        class="antiphon-mono"
      />
    </template>

    <template v-else-if="auth.type === 'apiKey'">
      <v-text-field v-model="auth.key" label="Key" placeholder="X-API-Key" class="antiphon-mono" />
      <v-text-field
        v-model="auth.value"
        label="Value"
        placeholder="gizli-anahtar-degeri"
        class="antiphon-mono"
      />
      <v-btn-toggle
        v-model="auth.in"
        mandatory
        color="primary"
        density="comfortable"
        class="align-self-start"
      >
        <v-btn value="header">{{ t('auth.header') }}</v-btn>
        <v-btn value="query">{{ t('auth.queryParam') }}</v-btn>
      </v-btn-toggle>
    </template>

    <template v-else-if="auth.type === 'jwt'">
      <v-text-field
        v-model="auth.secret"
        :label="t('auth.secret')"
        placeholder="gizli-imza-anahtari"
        class="antiphon-mono"
      />
    </template>

    <p v-else class="text-body-2 text-medium-emphasis">{{ noneHintText }}</p>
  </div>
</template>
