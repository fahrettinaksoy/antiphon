import { defineStore } from 'pinia'
import type { WorkspaceNode } from '@shared/ipc-contract'
import { useEnvironmentsStore } from './environments'

let watcherUnsubscribe: (() => void) | null = null

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    rootPath: null as string | null,
    tree: null as WorkspaceNode | null,
    isLoading: false
  }),
  getters: {
    isOpen: (state) => state.tree !== null
  },
  actions: {
    async openWorkspace() {
      this.isLoading = true
      try {
        const tree = await window.antiphon.openWorkspace()
        if (tree) {
          this.tree = tree
          this.rootPath = tree.path
          this.subscribeToChanges()
          await useEnvironmentsStore().refresh(tree.path)
        }
      } finally {
        this.isLoading = false
      }
    },
    // Kayıt defterinden (registry) açılan bir çalışma alanının ağacını uygular.
    applyTree(tree: WorkspaceNode | null, rootPath: string) {
      this.tree = tree
      this.rootPath = rootPath
      this.subscribeToChanges()
    },
    subscribeToChanges() {
      watcherUnsubscribe?.()
      watcherUnsubscribe = window.antiphon.onWorkspaceChanged((tree) => {
        this.tree = tree
        if (this.rootPath) useEnvironmentsStore().refresh(this.rootPath)
      })
    },
    async createRequest(folderPath: string, name: string) {
      return window.antiphon.createRequest(folderPath, name)
    },
    async createFolder(parentPath: string, name: string) {
      await window.antiphon.createFolder(parentPath, name)
    },
    async deleteNode(path: string) {
      await window.antiphon.deleteNode(path)
    },
    async renameNode(path: string, newName: string) {
      await window.antiphon.renameNode(path, newName)
    }
  }
})
