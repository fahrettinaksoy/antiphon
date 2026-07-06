<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { useTabsStore } from '../../stores/tabs'
import type { WorkspaceNode } from '@shared/ipc-contract'
import NewItemDialog from './NewItemDialog.vue'
import NewItemMenu from './NewItemMenu.vue'
import FolderSettingsDialog from './FolderSettingsDialog.vue'
import CollectionRunnerDialog from './CollectionRunnerDialog.vue'
import AppEmptyState from '../common/AppEmptyState.vue'
import SidebarSection from './SidebarSection.vue'

interface TreeItem {
  id: string
  title: string
  type: WorkspaceNode['type']
  method?: string
  // Üst düzey klasör = koleksiyon; iç içe klasörden ayırt etmek için.
  isCollection?: boolean
  children?: TreeItem[]
}

// HTTP method rozeti için renk (Postman benzeri).
const METHOD_COLORS: Record<string, string> = {
  GET: '#4CAF50',
  POST: '#FF9800',
  PUT: '#2196F3',
  PATCH: '#9C27B0',
  DELETE: '#F44336',
  HEAD: '#00BCD4',
  OPTIONS: '#795548'
}
function methodColor(method?: string): string {
  return METHOD_COLORS[(method ?? 'GET').toUpperCase()] ?? '#78909C'
}

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

// Çalışma alanı kökünü DEĞİL, kökün içindeki koleksiyonları/istekleri göster.
// Kök = çalışma alanının kendisi; üst düzey klasörler = koleksiyonlar.
const items = computed(() => (workspaceStore.tree?.children ?? []).map((node) => toTreeItem(node, 0)))

// Standart bölüm arama + HTTP method filtresi (SidebarSection v-model'leri).
const search = ref('')
const methodFilter = ref<string[]>([])
const methodFilterOptions = Object.keys(METHOD_COLORS).map((m) => ({ title: m, value: m }))

// Ağacı arama metni ve method filtresine göre daralt. Başlığı eşleşen klasörün altı
// daraltılmaz (yalnızca method filtresi uygulanır); eşleşen çocuğu olmayan dallar gizlenir.
function filterNode(node: TreeItem, q: string, methods: string[]): TreeItem | null {
  if (node.type === 'request') {
    const methodOk = methods.length === 0 || methods.includes((node.method ?? 'GET').toUpperCase())
    const queryOk = !q || node.title.toLowerCase().includes(q)
    return methodOk && queryOk ? node : null
  }
  const selfMatch = q !== '' && node.title.toLowerCase().includes(q)
  const childQuery = selfMatch ? '' : q
  const children = (node.children ?? [])
    .map((child) => filterNode(child, childQuery, methods))
    .filter((child): child is TreeItem => child !== null)
  if (children.length > 0 || (selfMatch && methods.length === 0)) return { ...node, children }
  return null
}

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q && methodFilter.value.length === 0) return items.value
  return items.value
    .map((node) => filterNode(node, q, methodFilter.value))
    .filter((node): node is TreeItem => node !== null)
})

function toTreeItem(node: WorkspaceNode, depth: number): TreeItem {
  return {
    id: node.id,
    title: node.name,
    type: node.type,
    method: node.method,
    isCollection: node.type === 'folder' && depth === 0,
    children: node.children?.map((child) => toTreeItem(child, depth + 1))
  }
}

async function handleClick(item: TreeItem) {
  if (item.type === 'request') {
    await tabsStore.openRequestFile(item.id)
  } else if (item.type === 'folder') {
    // Klasör = koleksiyon; tıklayınca koleksiyon editörünü tab olarak açar.
    await openCollection(item)
  }
}

// Koleksiyon editörünü tab olarak açar (tıklama veya menüden).
async function openCollection(item: TreeItem) {
  if (item.type !== 'folder') return
  await tabsStore.openCollection(item.id, item.title)
}

const menuTarget = ref<TreeItem | null>(null)

const dialog = ref<{ open: boolean; mode: 'new-request' | 'new-folder' | 'new-collection' | 'rename'; target: TreeItem | null }>({
  open: false,
  mode: 'new-request',
  target: null
})

function openDialog(mode: typeof dialog.value.mode, target: TreeItem | null) {
  dialog.value = { open: true, mode, target }
}

const dialogTitle = computed(() => {
  switch (dialog.value.mode) {
    case 'new-request':
      return 'Yeni İstek'
    case 'new-folder':
      return 'Yeni Klasör'
    case 'new-collection':
      return t('sidebar.newCollectionTitle')
    default:
      return 'Yeniden Adlandır'
  }
})

async function handleConfirm(name: string) {
  const { mode, target } = dialog.value
  if (mode === 'new-request') {
    const folderPath = target?.id ?? workspaceStore.rootPath
    if (folderPath) {
      const node = await workspaceStore.createRequest(folderPath, name)
      await tabsStore.openRequestFile(node.path)
    }
  } else if (mode === 'new-folder' || mode === 'new-collection') {
    // Koleksiyon = çalışma alanı kökünde üst düzey bir klasör.
    const folderPath = target?.id ?? workspaceStore.rootPath
    if (folderPath) await workspaceStore.createFolder(folderPath, name)
  } else if (mode === 'rename' && target) {
    await workspaceStore.renameNode(target.id, name)
  }
}

async function handleDelete(item: TreeItem) {
  await workspaceStore.deleteNode(item.id)
}

const folderSettingsTarget = ref<TreeItem | null>(null)
const folderSettingsOpen = ref(false)

function openFolderSettings(item: TreeItem) {
  folderSettingsTarget.value = item
  folderSettingsOpen.value = true
}

const runnerTarget = ref<TreeItem | null>(null)
const runnerOpen = ref(false)

function openRunner(item: TreeItem) {
  runnerTarget.value = item
  runnerOpen.value = true
}
</script>

<template>
  <SidebarSection
    :title="t('sidebar.collections')"
    :count="items.length || undefined"
    searchable
    :search-placeholder="t('sidebar.searchCollections')"
    :filter-options="methodFilterOptions"
    v-model:search="search"
    v-model:filter="methodFilter"
  >
    <template #actions>
      <NewItemMenu @new-http="openDialog('new-request', null)" @new-collection="openDialog('new-collection', null)" />
    </template>

    <AppEmptyState
      v-if="!workspaceStore.isOpen"
      size="compact"
      icon="mdi-folder-open-outline"
      :title="t('sidebar.empty')"
      :text="t('sidebar.emptyHint')"
    />

    <AppEmptyState
      v-else-if="items.length === 0"
      size="compact"
      icon="mdi-folder-multiple-outline"
      :title="t('sidebar.noCollections')"
      :action-text="t('sidebar.newCollectionTitle')"
      action-icon="mdi-plus"
      @action="openDialog('new-collection', null)"
    />

    <AppEmptyState v-else-if="filteredItems.length === 0" size="compact" icon="mdi-magnify" :title="t('sidebar.noMatches')" />

    <v-treeview
      v-else
      :items="filteredItems"
      item-value="id"
      item-title="title"
      density="compact"
      class="flex-grow-1 overflow-y-auto antiphon-tree"
      open-strategy="multiple"
      :hide-actions="false"
      :separate-roots="false"
      indent-lines="default"
      indent-lines-opacity="0.1"
      activatable
      open-all
      fluid
    >
      <template #prepend="{ item }">
        <v-icon
          v-if="item.type === 'folder'"
          :icon="item.isCollection ? 'mdi-folder-multiple-outline' : 'mdi-folder-outline'"
          size="18"
          :color="item.isCollection ? 'primary' : 'warning'"
        />
        <span v-else class="antiphon-method" :style="{ color: methodColor(item.method) }" @click="handleClick(item as TreeItem)">
          {{ (item.method ?? 'GET').toUpperCase() }}
        </span>
      </template>
      <template #title="{ item }">
        <div class="d-flex align-center justify-space-between antiphon-tree-row" @click="handleClick(item as TreeItem)">
          <span class="text-body-2 text-truncate" :class="{ 'font-weight-bold': item.isCollection }">{{ item.title }}</span>
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-dots-vertical"
                size="x-small"
                variant="text"
                class="antiphon-tree-menu-btn"
                @click.stop="menuTarget = item as TreeItem"
              />
            </template>
            <v-list density="compact">
              <template v-if="item.type === 'folder'">
                <v-list-item prepend-icon="mdi-folder-cog-outline" @click="openCollection(item as TreeItem)">
                  <v-list-item-title>{{ t('collection.open') }}</v-list-item-title>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item @click="openDialog('new-request', item as TreeItem)">
                  <v-list-item-title>Yeni İstek</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openDialog('new-folder', item as TreeItem)">
                  <v-list-item-title>Yeni Klasör</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openFolderSettings(item as TreeItem)">
                  <v-list-item-title>Klasör Ayarları (Auth/Header)</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openRunner(item as TreeItem)">
                  <v-list-item-title>Koleksiyonu Çalıştır</v-list-item-title>
                </v-list-item>
              </template>
              <v-list-item @click="openDialog('rename', item as TreeItem)">
                <v-list-item-title>Yeniden Adlandır</v-list-item-title>
              </v-list-item>
              <v-list-item @click="handleDelete(item as TreeItem)">
                <v-list-item-title class="text-error">Sil</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </template>
    </v-treeview>

    <NewItemDialog
      v-model="dialog.open"
      :title="dialogTitle"
      :initial-value="dialog.mode === 'rename' ? dialog.target?.title : ''"
      @confirm="handleConfirm"
    />

    <FolderSettingsDialog
      v-model="folderSettingsOpen"
      :folder-path="folderSettingsTarget?.id ?? null"
      :folder-name="folderSettingsTarget?.title ?? ''"
    />

    <CollectionRunnerDialog v-model="runnerOpen" :folder-path="runnerTarget?.id ?? null" :folder-name="runnerTarget?.title ?? ''" />
  </SidebarSection>
</template>

<style scoped>
.antiphon-tree-row {
  width: 100%;
  cursor: pointer;
}
.antiphon-tree-menu-btn {
  opacity: 0;
}
.antiphon-tree-row:hover .antiphon-tree-menu-btn {
  opacity: 1;
}

/* İstek ikonu yerine HTTP method rozeti; sabit genişlikle hizalı. */
.antiphon-method {
  display: inline-block;
  min-width: 30px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-align: left;
  font-family: var(--antiphon-mono, ui-monospace, monospace);
  cursor: pointer;
}

/* Daha sıkışık (compact) ağaç satırları. */
.antiphon-tree :deep(.v-list-item) {
  min-height: 28px;
  padding-top: 0;
  padding-bottom: 0;
}
.antiphon-tree :deep(.v-list-item__spacer) {
  width: 0px;
}
.antiphon-tree :deep(.v-treeview-item__prepend),
.antiphon-tree :deep(.v-list-item__prepend) {
  margin-inline-end: 0px;
}
</style>
