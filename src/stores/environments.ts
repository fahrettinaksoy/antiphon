import type { EnvironmentSummary } from '@shared/ipc-contract'
import { defineStore } from 'pinia'
import { ipc } from '@/lib/ipc'

export const useEnvironmentsStore = defineStore('environments', {
  state: () => ({
    list: [] as EnvironmentSummary[],
    activeEnvironmentPath: null as string | null,
    activeVariables: {} as Record<string, string>
  }),
  getters: {
    activeEnvironment: (state) =>
      state.list.find((e) => e.path === state.activeEnvironmentPath) ?? null
  },
  actions: {
    async refresh(workspaceRoot: string) {
      this.list = await ipc.listEnvironments(workspaceRoot)
      if (
        this.activeEnvironmentPath &&
        !this.list.some((e) => e.path === this.activeEnvironmentPath)
      ) {
        this.activeEnvironmentPath = null
        this.activeVariables = {}
      }
    },
    async selectEnvironment(path: string | null) {
      this.activeEnvironmentPath = path
      if (!path) {
        this.activeVariables = {}
        return
      }
      const env = await ipc.readEnvironment(path)
      this.activeVariables = env.variables
    },
    async createEnvironment(workspaceRoot: string, name: string) {
      const summary = await ipc.createEnvironment(workspaceRoot, name)
      await this.refresh(workspaceRoot)
      await this.selectEnvironment(summary.path)
      return summary
    },
    async updateVariables(path: string, name: string, variables: Record<string, string>) {
      await ipc.writeEnvironment(path, { schema: 1, name, variables })
      if (path === this.activeEnvironmentPath) this.activeVariables = variables
    },
    async deleteEnvironment(workspaceRoot: string, path: string) {
      await ipc.deleteEnvironment(path)
      if (path === this.activeEnvironmentPath) await this.selectEnvironment(null)
      await this.refresh(workspaceRoot)
    }
  },
  persist: {
    pick: ['activeEnvironmentPath']
  }
})
