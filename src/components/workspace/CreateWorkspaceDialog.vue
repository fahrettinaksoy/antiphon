<script setup lang="ts">
import { ipc } from '@/lib/ipc'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from '@/composables/i18n'
import type { CreateWorkspaceInput, WorkspaceStorageKind, WorkspaceVisibility } from '@shared/ipc-contract'
import { useWorkspacesStore } from '../../stores/workspaces'
import AppDefaults from '../common/AppDefaults.vue'
import SidebarSection from '../sidebar/SidebarSection.vue'

const model = defineModel<boolean>({ required: true })
const { t } = useI18n()
const workspacesStore = useWorkspacesStore()

const name = ref('')
const visibility = ref<WorkspaceVisibility>('personal')
const storageKind = ref<WorkspaceStorageKind>('local')
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

// Yerel: sıfırdan başla / mevcut klasöre bağlan
const localMode = ref<'scratch' | 'folder'>('scratch')
const sourceFolder = ref<string | null>(null)

const gist = reactive({ token: '', gistId: '' })
const webdav = reactive({ url: '', username: '', password: '' })

const storageOptions = computed(() => [
  { kind: 'local' as const, icon: 'mdi-folder-outline', title: t('workspace.storage.local'), desc: t('workspace.storage.localDesc') },
  { kind: 'gist' as const, icon: 'mdi-github', title: t('workspace.storage.gist'), desc: t('workspace.storage.gistDesc') },
  { kind: 'webdav' as const, icon: 'mdi-cloud-outline', title: t('workspace.storage.webdav'), desc: t('workspace.storage.webdavDesc') }
])

const visibilityOptions = computed(() => [
  { value: 'personal' as const, icon: 'mdi-account-outline', title: t('workspace.visibility.personal') },
  { value: 'internal' as const, icon: 'mdi-account-group-outline', title: t('workspace.visibility.internal') },
  { value: 'public' as const, icon: 'mdi-web', title: t('workspace.visibility.public') }
])

const canSubmit = computed(() => {
  if (!name.value.trim()) return false
  if (storageKind.value === 'gist') return gist.token.trim().length > 0
  if (storageKind.value === 'webdav') return webdav.url.trim() && webdav.username.trim() && webdav.password.length > 0
  if (storageKind.value === 'local' && localMode.value === 'folder') return !!sourceFolder.value
  return true
})

watch(model, (open) => {
  if (open) reset()
})

function reset() {
  name.value = ''
  visibility.value = 'personal'
  storageKind.value = 'local'
  localMode.value = 'scratch'
  sourceFolder.value = null
  gist.token = ''
  gist.gistId = ''
  webdav.url = ''
  webdav.username = ''
  webdav.password = ''
  errorMessage.value = null
  submitting.value = false
}

async function chooseFolder() {
  const dir = await ipc.pickDirectory()
  if (dir) {
    sourceFolder.value = dir
    localMode.value = 'folder'
  }
}

function buildInput(): CreateWorkspaceInput {
  const base = { name: name.value.trim(), type: visibility.value }
  if (storageKind.value === 'gist') {
    return { ...base, storage: { kind: 'gist', token: gist.token.trim(), gistId: gist.gistId.trim() || null } }
  }
  if (storageKind.value === 'webdav') {
    return {
      ...base,
      storage: { kind: 'webdav', url: webdav.url.trim(), username: webdav.username.trim(), password: webdav.password }
    }
  }
  return {
    ...base,
    storage: { kind: 'local', sourceFolder: localMode.value === 'folder' ? sourceFolder.value : null }
  }
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  errorMessage.value = null
  try {
    await workspacesStore.create(buildInput())
    model.value = false
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Dialog yerine sağdan açılan çekmece — Git/Geçmiş ile aynı standart header/footer iskeleti. -->
  <v-navigation-drawer v-model="model" location="right" temporary width="520">
    <SidebarSection :title="t('workspace.createTitle')">
      <template #actions>
        <v-btn icon="mdi-close" size="x-small" variant="text" :title="t('actions.cancel')" @click="model = false" />
      </template>

      <!-- Form alanları comfortable yoğunlukta (global compact yerine). -->
      <AppDefaults preset="dialogForm">
      <div class="flex-grow-1 overflow-y-auto px-4 pt-2">
        <!-- Ad -->
        <label class="antiphon-field-label">{{ t('workspace.nameLabel') }}</label>
        <v-text-field
          v-model="name"
          :placeholder="t('workspace.namePlaceholder')"
          hide-details
          class="mb-5"
          autofocus
        />

        <!-- Depolama türü (Postman'deki "workspace type" kartlarının yerine) -->
        <label class="antiphon-field-label">{{ t('workspace.storageLabel') }}</label>
        <div class="antiphon-cards mb-5">
          <button
            v-for="opt in storageOptions"
            :key="opt.kind"
            type="button"
            class="antiphon-card"
            :class="{ 'antiphon-card--active': storageKind === opt.kind }"
            @click="storageKind = opt.kind"
          >
            <div class="d-flex align-center justify-space-between mb-1">
              <v-icon :icon="opt.icon" size="20" />
              <v-icon v-if="storageKind === opt.kind" icon="mdi-check-circle" size="18" color="primary" />
            </div>
            <div class="text-body-2 font-weight-medium">{{ opt.title }}</div>
            <div class="text-caption text-medium-emphasis">{{ opt.desc }}</div>
          </button>
        </div>

        <!-- Yerel yapılandırma -->
        <template v-if="storageKind === 'local'">
          <div class="antiphon-cards antiphon-cards--2 mb-2">
            <button
              type="button"
              class="antiphon-card"
              :class="{ 'antiphon-card--active': localMode === 'scratch' }"
              @click="localMode = 'scratch'"
            >
              <div class="text-body-2 font-weight-medium mb-1">{{ t('workspace.local.scratch') }}</div>
              <div class="text-caption text-medium-emphasis">{{ t('workspace.local.scratchDesc') }}</div>
            </button>
            <button
              type="button"
              class="antiphon-card"
              :class="{ 'antiphon-card--active': localMode === 'folder' }"
              @click="localMode = 'folder'"
            >
              <div class="text-body-2 font-weight-medium mb-2">{{ t('workspace.local.folder') }}</div>
              <v-btn size="small" variant="tonal" prepend-icon="mdi-folder-outline" class="text-none" @click.stop="chooseFolder">
                {{ t('workspace.local.chooseFolder') }}
              </v-btn>
              <div v-if="sourceFolder" class="text-caption text-medium-emphasis mt-2 text-truncate">{{ sourceFolder }}</div>
            </button>
          </div>
        </template>

        <!-- GitHub Gist yapılandırma -->
        <template v-else-if="storageKind === 'gist'">
          <v-text-field
            v-model="gist.token"
            :label="t('workspace.gist.token')"
            :hint="t('workspace.gist.tokenHint')"
            persistent-hint
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxx"
            class="mb-3"
          />
          <v-text-field
            v-model="gist.gistId"
            :label="t('workspace.gist.gistId')"
            :hint="t('workspace.gist.gistIdHint')"
            persistent-hint
            placeholder="a1b2c3d4e5f67890abcd"
          />
        </template>

        <!-- WebDAV yapılandırma -->
        <template v-else>
          <v-text-field
            v-model="webdav.url"
            :label="t('workspace.webdav.url')"
            placeholder="https://dav.example.com/remote.php/dav/files/user/antiphon"
            class="mb-3"
          />
          <div class="d-flex ga-3">
            <v-text-field v-model="webdav.username" :label="t('workspace.webdav.username')" placeholder="user" />
            <v-text-field v-model="webdav.password" :label="t('workspace.webdav.password')" type="password" placeholder="••••••••" />
          </div>
        </template>

        <!-- Görünürlük (yerel-öncelikli üründe kozmetik etiket) -->
        <label class="antiphon-field-label mt-4">{{ t('workspace.visibilityLabel') }}</label>
        <v-chip-group v-model="visibility" selected-class="text-primary" mandatory>
          <v-chip v-for="opt in visibilityOptions" :key="opt.value" :value="opt.value" :prepend-icon="opt.icon" variant="tonal" filter>
            {{ opt.title }}
          </v-chip>
        </v-chip-group>

        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mt-4 mb-4">
          {{ errorMessage }}
        </v-alert>
      </div>
      </AppDefaults>

      <!-- Standart footer: yan yana eylemler — İptal solda, birincil eylem kalan genişliği alır -->
      <template #footer>
        <div class="d-flex ga-2">
          <VBtnText @click="model = false">{{ t('actions.cancel') }}</VBtnText>
          <VBtnPrimary class="flex-grow-1" :disabled="!canSubmit" :loading="submitting" @click="submit">
            {{ t('workspace.createButton') }}
          </VBtnPrimary>
        </div>
      </template>
    </SidebarSection>
  </v-navigation-drawer>
</template>

<style scoped>
.antiphon-field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
/* Çekmece genişliğinde depolama kartları tek sütun (dikey liste) okunur. */
.antiphon-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.antiphon-cards--2 {
  grid-template-columns: repeat(2, 1fr);
}
/* MD3 seçilebilir kart: çerçevesiz tonal yüzey; seçili durum primary-tonal konteyner. */
.antiphon-card {
  text-align: left;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.antiphon-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.antiphon-card--active {
  background: rgba(var(--v-theme-primary), 0.14);
}
</style>
