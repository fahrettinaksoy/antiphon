<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/composables/i18n'
import { ipc } from '@/lib/ipc'
import { useFormat } from '../../composables/useFormat'
import { useGitStore } from '../../stores/git'
import { useGitIdentityStore } from '../../stores/git-identity'
import { useWorkspaceStore } from '../../stores/workspace'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from '../sidebar/SidebarSection.vue'
import GitCredentialsDialog from './GitCredentialsDialog.vue'

const { t } = useI18n()
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
    kind:
      line.startsWith('+') && !line.startsWith('+++')
        ? 'add'
        : line.startsWith('-') && !line.startsWith('---')
          ? 'del'
          : 'ctx'
  }))
)

watch(
  () => workspaceStore.rootPath,
  async (root) => {
    if (!root) return
    gitStore.refresh(root)
    const override = await ipc.getWorkspaceSettingsOverride(root)
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
  await gitStore.commit(
    workspaceStore.rootPath,
    commitMessage.value.trim(),
    effectiveGitIdentity.value.name,
    effectiveGitIdentity.value.email
  )
  commitMessage.value = ''
}

function requestSync(action: 'pull' | 'push') {
  pendingAction.value = action
  credentialsDialogOpen.value = true
}

async function handleCredentialsConfirm(credentials?: { username: string; password: string }) {
  if (!workspaceStore.rootPath || !pendingAction.value) return
  if (pendingAction.value === 'pull') {
    await gitStore.pull(
      workspaceStore.rootPath,
      effectiveGitIdentity.value.name,
      effectiveGitIdentity.value.email,
      credentials
    )
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
  <!-- Standart bölüm iskeleti: header (başlık + sayaç + yenile) / gövde / footer (commit formu).
       Başlık "GIT" önceden büyük yazılır — Türkçe i→İ dönüşümüne takılmaz. -->
  <SidebarSection title="GIT" :count="gitStore.status?.files.length || undefined">
    <template #actions>
      <v-btn
        icon="mdi-refresh"
        size="x-small"
        variant="text"
        :title="t('git.refresh')"
        @click="workspaceStore.rootPath && gitStore.refresh(workspaceStore.rootPath)"
      />
    </template>

    <p v-if="!workspaceStore.isOpen" class="pa-4 text-caption text-medium-emphasis">
      {{ t('git.noWorkspace') }}
    </p>

    <AppEmptyState
      v-else-if="!gitStore.isRepo"
      size="compact"
      icon="mdi-source-branch"
      :title="t('git.notRepo')"
      :text="t('git.notRepoHint')"
      :action-text="t('git.initRepo')"
      action-icon="mdi-source-branch-plus"
      @action="initRepo"
    />

    <template v-else>
      <!-- Dal + uzak eşitleme eylemleri -->
      <div class="d-flex align-center ga-2 px-3 pb-2">
        <v-chip size="small" variant="tonal" prepend-icon="mdi-source-branch" class="antiphon-mono">
          {{ gitStore.status?.branch ?? '—' }}
        </v-chip>
        <v-spacer />
        <v-btn
          size="small"
          variant="tonal"
          :loading="gitStore.isSyncing"
          prepend-icon="mdi-arrow-down"
          class="text-none"
          @click="requestSync('pull')"
        >
          {{ t('git.pull') }}
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          :loading="gitStore.isSyncing"
          prepend-icon="mdi-arrow-up"
          class="text-none"
          @click="requestSync('push')"
        >
          {{ t('git.push') }}
        </v-btn>
      </div>

      <v-tabs v-model="activeTab" density="compact" class="px-2">
        <v-tab value="changes">
          {{ t('git.changes') }}
          <span v-if="gitStore.status?.files.length" class="antiphon-tab-count">{{
            gitStore.status.files.length
          }}</span>
        </v-tab>
        <v-tab value="log">{{ t('git.history') }}</v-tab>
      </v-tabs>

      <v-window v-model="activeTab" class="flex-grow-1 overflow-hidden antiphon-git-window">
        <v-window-item value="changes" class="h-100 d-flex flex-column overflow-hidden">
          <div class="flex-grow-1 overflow-y-auto">
            <AppEmptyState
              v-if="!gitStore.status?.files.length"
              size="compact"
              icon="mdi-check-decagram-outline"
              :title="t('git.noChanges')"
            />

            <template v-if="unstagedFiles.length > 0">
              <div class="px-3 py-1 d-flex align-center">
                <span class="antiphon-git-group">{{ t('git.unstagedTitle') }}</span>
                <v-chip size="x-small" variant="tonal" class="ml-2">{{
                  unstagedFiles.length
                }}</v-chip>
                <v-spacer />
                <v-btn size="x-small" variant="text" class="text-none" @click="stageAll">{{
                  t('git.stageAll')
                }}</v-btn>
              </div>
              <div
                v-for="file in unstagedFiles"
                :key="file.path"
                class="d-flex align-center ga-2 px-3 py-1 antiphon-git-row"
                @click="viewDiff(file.path)"
              >
                <v-chip
                  size="x-small"
                  :color="statusColor(file.status)"
                  variant="tonal"
                  class="antiphon-mono justify-center"
                  style="min-width: 30px"
                >
                  {{ file.status.charAt(0).toUpperCase() }}
                </v-chip>
                <span class="text-body-2 text-truncate flex-grow-1">{{ file.path }}</span>
                <v-btn
                  icon="mdi-plus"
                  size="x-small"
                  variant="text"
                  class="antiphon-git-row__action"
                  :title="t('git.stage')"
                  @click.stop="stageOrUnstage(file.path, false)"
                />
              </div>
            </template>

            <template v-if="stagedFiles.length > 0">
              <div class="px-3 py-1 d-flex align-center mt-2">
                <span class="antiphon-git-group">{{ t('git.stagedTitle') }}</span>
                <v-chip size="x-small" color="success" variant="tonal" class="ml-2">{{
                  stagedFiles.length
                }}</v-chip>
              </div>
              <div
                v-for="file in stagedFiles"
                :key="file.path"
                class="d-flex align-center ga-2 px-3 py-1 antiphon-git-row"
                @click="viewDiff(file.path)"
              >
                <v-chip
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="antiphon-mono justify-center"
                  style="min-width: 30px"
                >
                  {{ file.status.charAt(0).toUpperCase() }}
                </v-chip>
                <span class="text-body-2 text-truncate flex-grow-1">{{ file.path }}</span>
                <v-btn
                  icon="mdi-minus"
                  size="x-small"
                  variant="text"
                  class="antiphon-git-row__action"
                  :title="t('git.unstage')"
                  @click.stop="stageOrUnstage(file.path, true)"
                />
              </div>
            </template>

            <!-- Seçili dosyanın farkı — tonal kart -->
            <v-card v-if="gitStore.diffText" variant="tonal" class="ma-3 pa-3">
              <div
                class="text-caption font-weight-bold text-medium-emphasis mb-1 antiphon-mono text-truncate"
              >
                {{ gitStore.selectedFile }}
              </div>
              <pre
                class="antiphon-mono antiphon-diff text-caption"
              ><div v-for="(line, i) in diffLines" :key="i" :class="`antiphon-diff-${line.kind}`">{{ line.text }}</div></pre>
            </v-card>
          </div>
        </v-window-item>

        <v-window-item value="log" class="h-100 overflow-y-auto">
          <AppEmptyState
            v-if="gitStore.log.length === 0"
            size="compact"
            icon="mdi-history"
            :title="t('git.noCommits')"
          />
          <v-list v-else density="compact" bg-color="transparent">
            <v-list-item v-for="entry in gitStore.log" :key="entry.oid">
              <template #prepend>
                <v-icon icon="mdi-source-commit" size="18" class="mr-2 text-medium-emphasis" />
              </template>
              <v-list-item-title class="text-body-2">{{ entry.message }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption antiphon-mono">
                {{ entry.oid.slice(0, 7) }} · {{ entry.author }} · {{ fmt.date(entry.timestamp) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-window-item>
      </v-window>
    </template>

    <!-- Footer: commit formu (yalnızca Değişiklikler sekmesinde) -->
    <template v-if="gitStore.isRepo && workspaceStore.isOpen && activeTab === 'changes'" #footer>
      <v-textarea
        v-model="commitMessage"
        :label="t('git.commitMessage')"
        :placeholder="t('git.commitPlaceholder')"
        rows="2"
        density="compact"
        hide-details
      />
      <v-btn
        class="mt-2 text-none"
        color="primary"
        variant="flat"
        block
        :disabled="!commitMessage.trim() || stagedFiles.length === 0"
        @click="commitChanges"
      >
        Commit
        <span v-if="stagedFiles.length" class="antiphon-tab-count">{{ stagedFiles.length }}</span>
      </v-btn>
    </template>

    <GitCredentialsDialog v-model="credentialsDialogOpen" @confirm="handleCredentialsConfirm" />
  </SidebarSection>
</template>

<style scoped>
.antiphon-git-group {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.antiphon-git-row {
  cursor: pointer;
  border-radius: 8px;
  margin-inline: 4px;
}
.antiphon-git-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
/* Sahnele/çıkar butonu yalnızca satır üzerine gelince görünür. */
.antiphon-git-row__action {
  opacity: 0;
}
.antiphon-git-row:hover .antiphon-git-row__action {
  opacity: 1;
}
/* v-window yüksekliği iletmez; sekme içerikleri tam yükseklik ister. */
.antiphon-git-window :deep(.v-window__container),
.antiphon-git-window :deep(.v-window-item) {
  height: 100%;
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
