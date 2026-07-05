<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGitStore } from '../../stores/git'
import { useWorkspaceStore } from '../../stores/workspace'
import { useGitIdentityStore } from '../../stores/git-identity'
import { useFormat } from '../../composables/useFormat'
import GitCredentialsDialog from './GitCredentialsDialog.vue'

const gitStore = useGitStore()
const workspaceStore = useWorkspaceStore()
const gitIdentityStore = useGitIdentityStore()
const fmt = useFormat()

const activeTab = ref('changes')
const commitMessage = ref('')
const credentialsDialogOpen = ref(false)
const pendingAction = ref<'pull' | 'push' | null>(null)
const workspaceGitIdentity = ref<{ name: string; email: string } | null>(null)

const effectiveGitIdentity = computed(
  () => workspaceGitIdentity.value ?? { name: gitIdentityStore.name, email: gitIdentityStore.email }
)

const stagedFiles = computed(() => gitStore.status?.files.filter((f) => f.staged) ?? [])
const unstagedFiles = computed(() => gitStore.status?.files.filter((f) => !f.staged) ?? [])

const diffLines = computed(() =>
  gitStore.diffText.split('\n').map((line) => ({
    text: line,
    kind: line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : 'ctx'
  }))
)

watch(
  () => workspaceStore.rootPath,
  async (root) => {
    if (!root) return
    gitStore.refresh(root)
    const override = await window.antiphon.getWorkspaceSettingsOverride(root)
    workspaceGitIdentity.value = override.gitIdentity ?? null
  },
  { immediate: true }
)

function viewDiff(filepath: string) {
  if (!workspaceStore.rootPath) return
  gitStore.showDiff(workspaceStore.rootPath, filepath)
}

async function stageOrUnstage(filepath: string, staged: boolean) {
  if (!workspaceStore.rootPath) return
  if (staged) await gitStore.unstage(workspaceStore.rootPath, filepath)
  else await gitStore.stage(workspaceStore.rootPath, filepath)
}

async function stageAll() {
  if (workspaceStore.rootPath) await gitStore.stageAll(workspaceStore.rootPath)
}

async function commitChanges() {
  if (!workspaceStore.rootPath || !commitMessage.value.trim()) return
  await gitStore.commit(workspaceStore.rootPath, commitMessage.value.trim(), effectiveGitIdentity.value.name, effectiveGitIdentity.value.email)
  commitMessage.value = ''
}

function requestSync(action: 'pull' | 'push') {
  pendingAction.value = action
  credentialsDialogOpen.value = true
}

async function handleCredentialsConfirm(credentials?: { username: string; password: string }) {
  if (!workspaceStore.rootPath || !pendingAction.value) return
  if (pendingAction.value === 'pull') {
    await gitStore.pull(workspaceStore.rootPath, effectiveGitIdentity.value.name, effectiveGitIdentity.value.email, credentials)
  } else {
    await gitStore.push(workspaceStore.rootPath, credentials)
  }
  pendingAction.value = null
}

async function initRepo() {
  if (workspaceStore.rootPath) await gitStore.initRepo(workspaceStore.rootPath)
}

function statusColor(status: string): string {
  if (status === 'added' || status === 'untracked') return 'success'
  if (status === 'deleted') return 'error'
  return 'warning'
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex align-center justify-space-between px-3 py-2">
      <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">Git</span>
      <v-btn icon="mdi-refresh" size="x-small" variant="text" @click="workspaceStore.rootPath && gitStore.refresh(workspaceStore.rootPath)" />
    </div>
    <v-divider />

    <div v-if="!workspaceStore.isOpen" class="pa-4 text-caption text-medium-emphasis">Önce bir çalışma alanı açın.</div>

    <div v-else-if="!gitStore.isRepo" class="pa-4 d-flex flex-column align-center text-center ga-2">
      <v-icon icon="mdi-source-branch" size="32" class="text-medium-emphasis" />
      <p class="text-body-2 text-medium-emphasis">Bu çalışma alanı bir Git deposu değil.</p>
      <v-btn size="small" variant="tonal" color="primary" class="text-none" @click="initRepo">Git Deposu Başlat</v-btn>
    </div>

    <template v-else>
      <div class="d-flex align-center ga-2 px-3 py-2">
        <v-chip size="small" variant="tonal" prepend-icon="mdi-source-branch">{{ gitStore.status?.branch ?? '—' }}</v-chip>
        <v-spacer />
        <v-btn size="small" variant="text" :loading="gitStore.isSyncing" prepend-icon="mdi-arrow-down" class="text-none" @click="requestSync('pull')">
          Pull
        </v-btn>
        <v-btn size="small" variant="text" :loading="gitStore.isSyncing" prepend-icon="mdi-arrow-up" class="text-none" @click="requestSync('push')">
          Push
        </v-btn>
      </div>
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="changes">Değişiklikler</v-tab>
        <v-tab value="log">Geçmiş</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="activeTab" class="flex-grow-1 overflow-hidden">
        <v-window-item value="changes" class="h-100 d-flex flex-column overflow-hidden">
          <div class="flex-grow-1 overflow-y-auto">
            <div v-if="unstagedFiles.length > 0" class="px-3 py-1 d-flex align-center justify-space-between">
              <span class="text-caption font-weight-bold text-medium-emphasis">DEĞİŞİKLİKLER</span>
              <v-btn size="x-small" variant="text" class="text-none" @click="stageAll">Tümünü Sahnele</v-btn>
            </div>
            <div
              v-for="file in unstagedFiles"
              :key="file.path"
              class="d-flex align-center ga-2 px-3 py-1 antiphon-git-row"
              @click="viewDiff(file.path)"
            >
              <v-chip size="x-small" :color="statusColor(file.status)" variant="tonal" class="antiphon-mono" style="min-width: 30px">
                {{ file.status.charAt(0).toUpperCase() }}
              </v-chip>
              <span class="text-body-2 text-truncate flex-grow-1">{{ file.path }}</span>
              <v-btn icon="mdi-plus" size="x-small" variant="text" @click.stop="stageOrUnstage(file.path, false)" />
            </div>

            <div v-if="stagedFiles.length > 0" class="px-3 py-1 text-caption font-weight-bold text-medium-emphasis mt-2">
              SAHNELENDİ
            </div>
            <div
              v-for="file in stagedFiles"
              :key="file.path"
              class="d-flex align-center ga-2 px-3 py-1 antiphon-git-row"
              @click="viewDiff(file.path)"
            >
              <v-chip size="x-small" color="success" variant="tonal" class="antiphon-mono" style="min-width: 30px">
                {{ file.status.charAt(0).toUpperCase() }}
              </v-chip>
              <span class="text-body-2 text-truncate flex-grow-1">{{ file.path }}</span>
              <v-btn icon="mdi-minus" size="x-small" variant="text" @click.stop="stageOrUnstage(file.path, true)" />
            </div>

            <p v-if="!gitStore.status?.files.length" class="text-caption text-disabled pa-3">Değişiklik yok, çalışma dizini temiz.</p>

            <v-divider class="my-2" />
            <div v-if="gitStore.diffText" class="pa-2">
              <div class="text-caption font-weight-bold text-medium-emphasis mb-1">{{ gitStore.selectedFile }}</div>
              <pre class="antiphon-mono antiphon-diff text-caption">
                <div v-for="(line, i) in diffLines" :key="i" :class="`antiphon-diff-${line.kind}`">{{ line.text }}</div>
              </pre>
            </div>
          </div>

          <v-divider />
          <div class="pa-3">
            <v-textarea v-model="commitMessage" label="Commit mesajı" rows="2" density="compact" hide-details />
            <v-btn
              class="mt-2 text-none"
              color="primary"
              variant="flat"
              block
              :disabled="!commitMessage.trim() || stagedFiles.length === 0"
              @click="commitChanges"
            >
              Commit ({{ stagedFiles.length }})
            </v-btn>
          </div>
        </v-window-item>

        <v-window-item value="log" class="h-100 overflow-y-auto">
          <v-list density="compact">
            <v-list-item v-for="entry in gitStore.log" :key="entry.oid">
              <v-list-item-title class="text-body-2">{{ entry.message }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption antiphon-mono">
                {{ entry.oid.slice(0, 7) }} · {{ entry.author }} · {{ fmt.date(entry.timestamp) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-window-item>
      </v-window>
    </template>

    <GitCredentialsDialog v-model="credentialsDialogOpen" @confirm="handleCredentialsConfirm" />
  </div>
</template>

<style scoped>
.antiphon-git-row {
  cursor: pointer;
}
.antiphon-git-row:hover {
  background-color: rgba(128, 128, 128, 0.08);
}
.antiphon-diff {
  white-space: pre-wrap;
  word-break: break-all;
}
.antiphon-diff-add {
  color: rgb(var(--v-theme-success));
}
.antiphon-diff-del {
  color: rgb(var(--v-theme-error));
}
</style>
