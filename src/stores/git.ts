import { ipc } from '@/lib/ipc'
import { defineStore } from 'pinia'
import type { GitCommitSummaryDto, GitStatusSummaryDto } from '@shared/ipc-contract'

export const useGitStore = defineStore('git', {
  state: () => ({
    isRepo: false,
    status: null as GitStatusSummaryDto | null,
    log: [] as GitCommitSummaryDto[],
    selectedFile: null as string | null,
    diffText: '',
    isLoading: false,
    isSyncing: false
  }),
  actions: {
    async refresh(dir: string) {
      this.isRepo = await ipc.isGitRepo(dir)
      if (!this.isRepo) {
        this.status = null
        this.log = []
        return
      }
      this.isLoading = true
      try {
        this.status = await ipc.getGitStatus(dir)
        this.log = await ipc.getGitLog(dir, 30)
      } finally {
        this.isLoading = false
      }
    },
    async initRepo(dir: string) {
      await ipc.initGitRepo(dir)
      await this.refresh(dir)
    },
    async showDiff(dir: string, filepath: string) {
      this.selectedFile = filepath
      this.diffText = await ipc.diffGitFile(dir, filepath)
    },
    async stage(dir: string, filepath: string) {
      await ipc.stageGitFile(dir, filepath)
      await this.refresh(dir)
    },
    async unstage(dir: string, filepath: string) {
      await ipc.unstageGitFile(dir, filepath)
      await this.refresh(dir)
    },
    async stageAll(dir: string) {
      await ipc.stageAllGitFiles(dir)
      await this.refresh(dir)
    },
    async commit(dir: string, message: string, authorName: string, authorEmail: string) {
      await ipc.commitGit(dir, message, authorName, authorEmail)
      await this.refresh(dir)
    },
    async pull(dir: string, authorName: string, authorEmail: string, credentials?: { username: string; password: string }) {
      this.isSyncing = true
      try {
        await ipc.pullGit(dir, authorName, authorEmail, credentials)
        await this.refresh(dir)
      } finally {
        this.isSyncing = false
      }
    },
    async push(dir: string, credentials?: { username: string; password: string }) {
      this.isSyncing = true
      try {
        await ipc.pushGit(dir, credentials)
      } finally {
        this.isSyncing = false
      }
    }
  }
})
