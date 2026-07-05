<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Auth, FolderMeta } from '@schema/request'
import KeyValueEditor, { type KeyValueRow } from '../request/KeyValueEditor.vue'
import AuthPanel from '../request/AuthPanel.vue'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ folderPath: string | null; folderName: string }>()

const auth = ref<Auth>({ type: 'none' })
const headerRows = ref<KeyValueRow[]>([])
// Koleksiyon editörünün yazdığı description/variables/script alanlarını kayıtta korumak için tutulur.
const loadedMeta = ref<FolderMeta | null>(null)

async function load() {
  if (!props.folderPath) return
  const meta = await window.antiphon.readFolderMeta(props.folderPath)
  loadedMeta.value = meta
  auth.value = meta?.auth ?? { type: 'none' }
  headerRows.value = (meta?.headers ?? []).map((h) => ({ ...h }))
}

watch(open, (isOpen) => {
  if (isOpen) load()
})

async function save() {
  if (!props.folderPath) return
  await window.antiphon.writeFolderMeta(props.folderPath, {
    ...loadedMeta.value,
    schema: 1,
    auth: auth.value,
    headers: headerRows.value.filter((r) => r.key !== '')
  })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card :title="`Klasör Ayarları — ${folderName}`" rounded="lg">
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-3">
          Bu ayarlar, üzerine yazmadığı sürece klasördeki tüm alt isteklere miras olarak uygulanır.
        </p>
        <div class="text-subtitle-2 mb-2">Kimlik Doğrulama</div>
        <AuthPanel v-model="auth" />
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">Ortak Header'lar</div>
        <KeyValueEditor v-model="headerRows" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="open = false">İptal</v-btn>
        <v-btn color="primary" variant="flat" class="text-none" @click="save">Kaydet</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
