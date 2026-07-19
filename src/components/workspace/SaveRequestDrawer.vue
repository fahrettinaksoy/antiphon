<script setup lang="ts">
import type { WorkspaceNode } from '@shared/ipc-contract'
// "İsteği Kaydet" çekmecesi — boşta (dosyasız) bir sekme kaydedilirken açılır:
// ad, "Kaydedilecek yer" breadcrumb'ı, aranabilir klasör ağacı (kapalı başlar),
// Yeni Klasör ve Kaydet/İptal. (Postman'in Save Request diyaloğunun karşılığı.)
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useTabsStore } from '../../stores/tabs'
import { useUiStore } from '../../stores/ui'
import { useWorkspaceStore } from '../../stores/workspace'
import { useWorkspacesStore } from '../../stores/workspaces'
import NewItemDialog from '../sidebar/NewItemDialog.vue'
import SidebarSection from '../sidebar/SidebarSection.vue'

const { t } = useI18n()
const uiStore = useUiStore()
const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()
const workspacesStore = useWorkspacesStore()

const open = computed({
  get: () => uiStore.saveRequestTabId !== null,
  set: (value: boolean) => {
    if (!value) uiStore.closeSaveRequest()
  }
})

const tab = computed(
  () => tabsStore.tabs.find((item) => item.id === uiStore.saveRequestTabId) ?? null
)

const requestName = ref('')
const targetPath = ref<string | null>(null)
const search = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    requestName.value = tab.value?.name ?? ''
    targetPath.value = workspaceStore.rootPath
    search.value = ''
  }
})

// Yalnızca KLASÖRLERDEN oluşan ağaç (koleksiyonlar + alt klasörler).
interface FolderItem {
  id: string
  title: string
  children?: FolderItem[]
}
function toFolderItem(node: WorkspaceNode): FolderItem | null {
  if (node.type !== 'folder') return null
  const children = (node.children ?? [])
    .map(toFolderItem)
    .filter((c): c is FolderItem => c !== null)
  return { id: node.path, title: node.name, children: children.length > 0 ? children : undefined }
}
const folderItems = computed(() =>
  (workspaceStore.tree?.children ?? []).map(toFolderItem).filter((c): c is FolderItem => c !== null)
)

// Arama: başlığı eşleşen klasörler (eşleşen alt dallar korunur).
function filterFolder(item: FolderItem, q: string): FolderItem | null {
  const selfMatch = item.title.toLowerCase().includes(q)
  const children = (item.children ?? [])
    .map((c) => filterFolder(c, q))
    .filter((c): c is FolderItem => c !== null)
  if (selfMatch || children.length > 0)
    return { ...item, children: children.length > 0 ? children : undefined }
  return null
}
const filteredFolders = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return folderItems.value
  return folderItems.value
    .map((item) => filterFolder(item, q))
    .filter((c): c is FolderItem => c !== null)
})

// v-treeview seçim modeli (tek klasör)
const activated = computed({
  get: () =>
    targetPath.value && targetPath.value !== workspaceStore.rootPath ? [targetPath.value] : [],
  set: (values: unknown[]) => {
    targetPath.value = (values[0] as string | undefined) ?? workspaceStore.rootPath
  }
})

// Breadcrumb: çalışma alanı adı + hedef klasörün kök-göreli segmentleri.
const breadcrumbs = computed(() => {
  const root = workspaceStore.rootPath
  const crumbs: { title: string; path: string }[] = [
    { title: workspacesStore.active?.name ?? 'Workspace', path: root ?? '' }
  ]
  if (!root || !targetPath.value || targetPath.value === root) return crumbs
  const rel = targetPath.value.startsWith(root)
    ? targetPath.value.slice(root.length)
    : targetPath.value
  let acc = root
  for (const segment of rel.split(/[\\/]/).filter(Boolean)) {
    acc = `${acc}/${segment}`
    crumbs.push({ title: segment, path: acc })
  }
  return crumbs
})

// Yeni klasör: seçili hedefin altına oluşturup onu hedef yapar.
const newFolderOpen = ref(false)
async function handleNewFolder(name: string) {
  const parent = targetPath.value ?? workspaceStore.rootPath
  if (!parent) return
  await workspaceStore.createFolder(parent, name)
}

const canSave = computed(() => requestName.value.trim().length > 0 && !!targetPath.value)

async function save() {
  const current = tab.value
  const target = targetPath.value
  if (!current || !target || !canSave.value) return
  // Önce benzersiz adla dosya oluşturulur, sonra sekmenin gerçek içeriği o dosyaya yazılır.
  const node = await workspaceStore.createRequest(target, requestName.value.trim())
  current.name = node.name
  current.requestPath = node.path
  await tabsStore.saveTab(current.id)
  uiStore.closeSaveRequest()
}
</script>

<template>
  <v-navigation-drawer v-model="open" location="right" temporary width="480">
    <SidebarSection :title="t('saveRequest.title')">
      <template #actions>
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          :title="t('actions.cancel')"
          @click="open = false"
        />
      </template>

      <div class="flex-grow-1 overflow-y-auto px-4 pt-2 d-flex flex-column">
        <!-- İstek adı -->
        <div class="text-caption text-medium-emphasis mb-1">{{ t('saveRequest.nameLabel') }}</div>
        <v-text-field
          v-model="requestName"
          density="comfortable"
          hide-details
          autofocus
          class="mb-4 flex-grow-0"
        />

        <!-- Kaydedilecek yer: breadcrumb -->
        <div class="d-flex align-center flex-wrap ga-1 mb-2">
          <span class="text-caption text-medium-emphasis mr-1">{{ t('saveRequest.saveTo') }}</span>
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
            <v-icon v-if="i > 0" icon="mdi-chevron-right" size="14" class="text-medium-emphasis" />
            <button
              type="button"
              class="antiphon-crumb text-caption"
              :class="{ 'antiphon-crumb--current': i === breadcrumbs.length - 1 }"
              @click="targetPath = crumb.path"
            >
              {{ crumb.title }}
            </button>
          </template>
        </div>

        <!-- Klasör arama + ağaç (kapalı başlar) -->
        <v-text-field
          v-model="search"
          :placeholder="t('saveRequest.searchPlaceholder')"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          rounded="lg"
          class="mb-2 flex-grow-0"
        />

        <p v-if="folderItems.length === 0" class="text-caption text-medium-emphasis pa-2">
          {{ t('saveRequest.noFolders') }}
        </p>
        <v-treeview
          v-else
          v-model:activated="activated"
          :items="filteredFolders"
          item-value="id"
          item-title="title"
          density="compact"
          activatable
          active-strategy="single-independent"
          :open-all="search.trim().length > 0"
          class="antiphon-save-tree flex-grow-1"
        >
          <template #prepend>
            <v-icon icon="mdi-folder-outline" size="18" color="warning" />
          </template>
        </v-treeview>
      </div>

      <!-- Standart footer: Yeni Klasör solda, Kaydet/İptal sağda -->
      <template #footer>
        <div class="d-flex align-center ga-2">
          <v-btn
            size="small"
            variant="text"
            prepend-icon="mdi-folder-plus-outline"
            class="text-none"
            @click="newFolderOpen = true"
          >
            {{ t('saveRequest.newFolder') }}
          </v-btn>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="open = false">{{
            t('actions.cancel')
          }}</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none"
            :disabled="!canSave"
            @click="save"
          >
            {{ t('actions.save') }}
          </v-btn>
        </div>
      </template>

      <NewItemDialog
        v-model="newFolderOpen"
        :title="t('saveRequest.newFolder')"
        @confirm="handleNewFolder"
      />
    </SidebarSection>
  </v-navigation-drawer>
</template>

<style scoped>
.antiphon-crumb {
  padding: 2px 4px;
  border-radius: 6px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  transition: background-color 0.15s ease;
}
.antiphon-crumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.antiphon-crumb--current {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
}
.antiphon-save-tree {
  min-height: 0;
  overflow-y: auto;
}
</style>
