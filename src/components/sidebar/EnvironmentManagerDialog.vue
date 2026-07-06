<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { computed, ref, watch } from 'vue'
import { useEnvironmentsStore } from '../../stores/environments'
import { useWorkspaceStore } from '../../stores/workspace'
import KeyValueEditor, { type KeyValueRow } from '../request/KeyValueEditor.vue'
import NewItemDialog from './NewItemDialog.vue'

const open = defineModel<boolean>({ required: true })

const environmentsStore = useEnvironmentsStore()
const workspaceStore = useWorkspaceStore()

const selectedPath = ref<string | null>(environmentsStore.activeEnvironmentPath)
const rows = ref<KeyValueRow[]>([])
const newDialogOpen = ref(false)

const selectedSummary = computed(() => environmentsStore.list.find((e) => e.path === selectedPath.value) ?? null)

async function loadRows(path: string | null) {
  if (!path) {
    rows.value = []
    return
  }
  const env = await ipc.readEnvironment(path)
  rows.value = Object.entries(env.variables).map(([key, value]) => ({ key, value, enabled: true }))
}

watch(selectedPath, loadRows, { immediate: true })

watch(open, (isOpen) => {
  if (isOpen) selectedPath.value = environmentsStore.activeEnvironmentPath ?? environmentsStore.list[0]?.path ?? null
})

async function createEnvironment(name: string) {
  if (!workspaceStore.rootPath) return
  const summary = await environmentsStore.createEnvironment(workspaceStore.rootPath, name)
  selectedPath.value = summary.path
}

async function save() {
  if (!selectedPath.value || !selectedSummary.value) return
  const variables = Object.fromEntries(rows.value.filter((r) => r.key !== '').map((r) => [r.key, r.value]))
  await environmentsStore.updateVariables(selectedPath.value, selectedSummary.value.name, variables)
}

async function remove() {
  if (!selectedPath.value || !workspaceStore.rootPath) return
  await environmentsStore.deleteEnvironment(workspaceStore.rootPath, selectedPath.value)
  selectedPath.value = environmentsStore.list[0]?.path ?? null
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card title="Environment Yönetimi" rounded="lg">
      <v-card-text>
        <div class="d-flex ga-2 align-center mb-3">
          <v-select
            v-model="selectedPath"
            :items="environmentsStore.list.map((e) => ({ title: e.name, value: e.path }))"
            label="Environment"
            placeholder="Environment seçin"
            style="max-width: 280px"
            hide-details
          />
          <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" class="text-none" @click="newDialogOpen = true">
            Yeni
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            class="text-none"
            :disabled="!selectedPath"
            @click="remove"
          >
            Sil
          </v-btn>
        </div>

        <KeyValueEditor v-if="selectedPath" v-model="rows" />
        <p v-else class="text-body-2 text-medium-emphasis">Düzenlemek için bir environment seçin veya yeni oluşturun.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="open = false">Kapat</v-btn>
        <v-btn color="primary" variant="flat" class="text-none" :disabled="!selectedPath" @click="save">Kaydet</v-btn>
      </v-card-actions>
    </v-card>

    <NewItemDialog v-model="newDialogOpen" title="Yeni Environment" confirm-label="Oluştur" @confirm="createEnvironment" />
  </v-dialog>
</template>
