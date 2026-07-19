<script setup lang="ts">
import type { MockServerStatusDto } from '@shared/ipc-contract'
import { onMounted, ref } from 'vue'
import { ipc } from '@/lib/ipc'
import AppEmptyState from '../common/AppEmptyState.vue'

const open = defineModel<boolean>({ required: true })

const port = ref(4010)
const status = ref<MockServerStatusDto>({ running: false, port: null, routes: [] })
const isStarting = ref(false)

async function refreshStatus() {
  status.value = await ipc.getMockServerStatus()
}

async function start() {
  isStarting.value = true
  try {
    status.value = await ipc.startMockServer(port.value)
  } finally {
    isStarting.value = false
  }
}

async function stop() {
  await ipc.stopMockServer()
  await refreshStatus()
}

onMounted(refreshStatus)
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card title="Lokal Mock Server" rounded="lg">
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-3">
          Bir OpenAPI 3.x dosyası seçin; her path+method için otomatik olarak örnekten veya şemadan
          üretilmiş (faker) sahte veri döndüren bir endpoint oluşturulur.
        </p>

        <div class="d-flex align-center ga-2 mb-3">
          <v-chip
            size="small"
            :color="status.running ? 'success' : 'medium-emphasis'"
            variant="tonal"
          >
            {{ status.running ? `ÇALIŞIYOR :${status.port}` : 'DURDU' }}
          </v-chip>
          <v-text-field
            v-model.number="port"
            label="Port"
            type="number"
            placeholder="4010"
            density="compact"
            style="max-width: 120px"
            hide-details
            :disabled="status.running"
          />
          <v-btn
            v-if="!status.running"
            color="primary"
            :loading="isStarting"
            prepend-icon="mdi-play"
            class="text-none"
            @click="start"
          >
            OpenAPI Seç ve Başlat
          </v-btn>
          <v-btn
            v-else
            color="error"
            variant="tonal"
            prepend-icon="mdi-stop"
            class="text-none"
            @click="stop"
            >Durdur</v-btn
          >
        </div>

        <v-divider class="mb-3" />
        <div class="text-subtitle-2 mb-2">Endpoint'ler ({{ status.routes.length }})</div>
        <div
          v-for="route in status.routes"
          :key="`${route.method}-${route.path}`"
          class="d-flex ga-2 py-1"
        >
          <span
            class="antiphon-mono text-caption font-weight-bold"
            :class="`text-method-${route.method.toLowerCase()}`"
          >
            {{ route.method }}
          </span>
          <span class="antiphon-mono text-caption"
            >http://127.0.0.1:{{ status.port }}{{ route.path }}</span
          >
        </div>
        <AppEmptyState
          v-if="status.routes.length === 0"
          size="compact"
          icon="mdi-api-off"
          title="Henüz endpoint yok"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="open = false">Kapat</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
