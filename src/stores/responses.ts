import { defineStore } from 'pinia'
import type { HttpResponsePayload } from '@shared/ipc-contract'

export interface TabResponseState {
  response: HttpResponsePayload | null
  error: string | null
  isLoading: boolean
}

function blankState(): TabResponseState {
  return { response: null, error: null, isLoading: false }
}

export const useResponsesStore = defineStore('responses', {
  state: () => ({
    byTabId: {} as Record<string, TabResponseState>
  }),
  getters: {
    forTab: (state) => (tabId: string) => state.byTabId[tabId] ?? blankState()
  },
  actions: {
    setLoading(tabId: string) {
      this.byTabId[tabId] = { response: this.byTabId[tabId]?.response ?? null, error: null, isLoading: true }
    },
    setResult(tabId: string, response: HttpResponsePayload) {
      this.byTabId[tabId] = { response, error: null, isLoading: false }
    },
    setError(tabId: string, error: string) {
      this.byTabId[tabId] = { response: this.byTabId[tabId]?.response ?? null, error, isLoading: false }
    },
    clear(tabId: string) {
      delete this.byTabId[tabId]
    }
  }
})
