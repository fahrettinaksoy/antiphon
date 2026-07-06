import { ipc } from '@/lib/ipc'
import { defineStore } from 'pinia'
import type { CreateWorkspaceInput, WorkspaceMetaDto, WorkspaceSyncDirection } from '@shared/ipc-contract'
import { useWorkspaceStore } from './workspace'
import { useEnvironmentsStore } from './environments'

// Çalışma alanları kayıt defteri (registry). Her zaman en az bir yerel "My Workspace"
// bulunur; kullanıcı yeni alanlar (yerel / GitHub Gist / WebDAV) ekleyip silebilir.
export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    list: [] as WorkspaceMetaDto[],
    activeId: null as string | null,
    isSyncing: false,
    error: null as string | null
  }),
  getters: {
    active: (state) => state.list.find((w) => w.id === state.activeId) ?? null
  },
  actions: {
    async init() {
      this.list = await ipc.listWorkspaces()
      this.activeId = await ipc.getActiveWorkspaceId()
      if (this.activeId) await this.open(this.activeId)
    },
    async refresh() {
      this.list = await ipc.listWorkspaces()
    },
    async open(id: string) {
      const result = await ipc.openWorkspaceById(id)
      if (!result) return
      this.activeId = result.meta.id
      await this.refresh()
      useWorkspaceStore().applyTree(result.tree, result.meta.localPath)
      await useEnvironmentsStore().refresh(result.meta.localPath)
    },
    async create(input: CreateWorkspaceInput) {
      this.error = null
      const result = await ipc.createWorkspace(input)
      this.activeId = result.meta.id
      await this.refresh()
      useWorkspaceStore().applyTree(result.tree, result.meta.localPath)
      await useEnvironmentsStore().refresh(result.meta.localPath)
      return result.meta
    },
    async remove(id: string) {
      this.list = await ipc.deleteWorkspace(id)
      if (this.activeId === id) {
        const next = this.list[0]
        if (next) await this.open(next.id)
      }
    },
    async rename(id: string, name: string) {
      await ipc.renameWorkspace(id, name)
      await this.refresh()
    },
    async sync(id: string, direction: WorkspaceSyncDirection) {
      this.isSyncing = true
      this.error = null
      try {
        const tree = await ipc.syncWorkspace(id, direction)
        if (direction === 'pull' && this.activeId === id) {
          const meta = this.list.find((w) => w.id === id)
          if (meta) {
            useWorkspaceStore().applyTree(tree, meta.localPath)
            await useEnvironmentsStore().refresh(meta.localPath)
          }
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
        throw err
      } finally {
        this.isSyncing = false
      }
    }
  }
})
