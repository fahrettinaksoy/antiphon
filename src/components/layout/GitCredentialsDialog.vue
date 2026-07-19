<script setup lang="ts">
import { ref } from 'vue'
import AppDefaults from '../common/AppDefaults.vue'

const emit = defineEmits<{ confirm: [{ username: string; password: string } | undefined] }>()
const open = defineModel<boolean>({ required: true })
const username = ref('')
const password = ref('')

function confirmWithCredentials() {
  emit(
    'confirm',
    username.value ? { username: username.value, password: password.value } : undefined
  )
  open.value = false
}

function confirmWithoutCredentials() {
  emit('confirm', undefined)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="420">
    <v-card title="Git Kimlik Bilgileri" rounded="lg">
      <AppDefaults preset="dialogForm">
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">
            Uzak sunucu (remote) HTTPS kimlik doğrulama istiyorsa kullanıcı adı ve personal access
            token girin. SSH anahtarı veya credential helper kullanıyorsanız boş bırakıp devam
            edebilirsiniz.
          </p>
          <v-text-field v-model="username" label="Kullanıcı adı" placeholder="git-kullanici-adi" />
          <v-text-field
            v-model="password"
            label="Token / Parola"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxx"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <VBtnText @click="confirmWithoutCredentials">Kimlik Bilgisiz Devam Et</VBtnText>
          <VBtnPrimary @click="confirmWithCredentials">Devam Et</VBtnPrimary>
        </v-card-actions>
      </AppDefaults>
    </v-card>
  </v-dialog>
</template>
