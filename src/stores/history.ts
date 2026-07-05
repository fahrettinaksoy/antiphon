import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import type { Auth, Body, KeyValue } from '@schema/request'

const MAX_ENTRIES = 200

export interface HistoryEntry {
  id: string
  requestName: string
  method: string
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body?: Body
  auth?: Auth
  status: number | null
  durationMs: number
  sentAt: number
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    entries: [] as HistoryEntry[]
  }),
  actions: {
    record(entry: Omit<HistoryEntry, 'id'>) {
      this.entries.unshift({ id: nanoid(8), ...entry })
      if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
    },
    clear() {
      this.entries = []
    },
    remove(id: string) {
      this.entries = this.entries.filter((e) => e.id !== id)
    }
  },
  persist: true
})
