import { ipc } from '@/lib/ipc'
import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import type { Auth, Body, FolderMeta, HttpMethod, KeyValue, RequestFile, RequestSettings } from '@schema/request'
import { SCHEMA_VERSION, defaultRequestSettings } from '@schema/request'
import { useEnvironmentsStore } from './environments'

export type { HttpMethod }

export type TabProtocol = 'http' | 'ws' | 'sse' | 'graphql' | 'mcp'
// Bir tab bir istek dosyasını, bir koleksiyonu (üst düzey klasör) veya bir ortamı düzenler.
export type TabKind = 'request' | 'collection' | 'environment'

export interface RequestTab {
  id: string
  kind: TabKind
  protocol: TabProtocol
  requestPath: string | null
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  auth: Auth
  body: Body
  settings: RequestSettings
  preRequestScript: string
  testScript: string
  docs: string
  // Koleksiyon tab'ına özgü alanlar.
  description: string
  variables: KeyValue[]
  graphqlQuery: string
  graphqlVariables: string
  mcpTransport: 'stdio' | 'http'
  mcpCommand: string
  isDirty: boolean
  isSaving: boolean
}

function blankTab(name = 'Yeni İstek', protocol: TabProtocol = 'http'): RequestTab {
  return {
    id: nanoid(8),
    kind: 'request',
    protocol,
    requestPath: null,
    name,
    method: protocol === 'graphql' ? 'POST' : 'GET',
    url: '',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { mode: 'none' },
    settings: defaultRequestSettings(),
    preRequestScript: '',
    testScript: '',
    docs: '',
    description: '',
    variables: [],
    graphqlQuery: '',
    graphqlVariables: '{}',
    mcpTransport: 'stdio',
    mcpCommand: '',
    isDirty: false,
    isSaving: false
  }
}

export function tabToRequestFile(tab: RequestTab): RequestFile {
  return {
    schema: SCHEMA_VERSION,
    name: tab.name,
    method: tab.method,
    url: tab.url,
    params: tab.params.filter((p) => p.key !== ''),
    headers: tab.headers.filter((h) => h.key !== ''),
    auth: tab.auth,
    body: tab.body,
    settings: tab.settings,
    preRequestScript: tab.preRequestScript || undefined,
    testScript: tab.testScript || undefined,
    docs: tab.docs || undefined
  }
}

function requestFileToTab(path: string, file: RequestFile, existingId?: string): RequestTab {
  return {
    ...blankTab(file.name),
    id: existingId ?? nanoid(8),
    kind: 'request',
    protocol: 'http',
    requestPath: path,
    name: file.name,
    method: file.method,
    url: file.url,
    params: file.params,
    headers: file.headers,
    auth: file.auth,
    body: file.body,
    settings: file.settings ?? defaultRequestSettings(),
    preRequestScript: file.preRequestScript ?? '',
    testScript: file.testScript ?? '',
    docs: file.docs ?? ''
  }
}

// Koleksiyon = üst düzey klasör; ayarları folder.meta.yaml sidecar'ında tutulur.
function folderMetaToTab(folderPath: string, name: string, meta: FolderMeta | null): RequestTab {
  return {
    ...blankTab(name),
    kind: 'collection',
    requestPath: folderPath,
    name,
    description: meta?.description ?? '',
    auth: meta?.auth ?? { type: 'none' },
    headers: (meta?.headers ?? []).map((h) => ({ ...h })),
    variables: (meta?.variables ?? []).map((v) => ({ ...v })),
    preRequestScript: meta?.preRequestScript ?? '',
    testScript: meta?.testScript ?? ''
  }
}

export function tabToFolderMeta(tab: RequestTab): FolderMeta {
  return {
    schema: SCHEMA_VERSION,
    description: tab.description || undefined,
    auth: tab.auth,
    headers: tab.headers.filter((h) => h.key !== ''),
    variables: tab.variables.filter((v) => v.key !== ''),
    preRequestScript: tab.preRequestScript || undefined,
    testScript: tab.testScript || undefined
  }
}

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [] as RequestTab[],
    activeTabId: null as string | null,
    splitViewEnabled: false,
    secondaryTabId: null as string | null
  }),
  getters: {
    activeTab: (state) => state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
    tabByPath: (state) => (path: string) => state.tabs.find((tab) => tab.requestPath === path) ?? null
  },
  actions: {
    toggleSplitView() {
      this.splitViewEnabled = !this.splitViewEnabled
      if (this.splitViewEnabled && !this.secondaryTabId) {
        this.secondaryTabId = this.tabs.find((t) => t.id !== this.activeTabId)?.id ?? this.activeTabId
      }
    },
    setSecondaryTab(tabId: string) {
      this.secondaryTabId = tabId
    },
    openNewTab(name?: string, protocol?: TabProtocol) {
      const tab = blankTab(name, protocol)
      this.tabs.push(tab)
      this.activeTabId = tab.id
      return tab
    },
    async openRequestFile(path: string) {
      const existing = this.tabByPath(path)
      if (existing) {
        this.activeTabId = existing.id
        return existing
      }
      const file = await ipc.readRequestFile(path)
      const tab = requestFileToTab(path, file)
      this.tabs.push(tab)
      this.activeTabId = tab.id
      return tab
    },
    // Ortamı ana alanda sekme olarak açar (çalışma alanı mantığı — dialog yerine).
    async openEnvironment(path: string, name: string) {
      const existing = this.tabByPath(path)
      if (existing) {
        this.activeTabId = existing.id
        return existing
      }
      const env = await ipc.readEnvironment(path)
      const tab: RequestTab = {
        ...blankTab(env.name || name),
        kind: 'environment',
        requestPath: path,
        variables: Object.entries(env.variables).map(([key, value]) => ({ key, value, enabled: true }))
      }
      this.tabs.push(tab)
      this.activeTabId = tab.id
      return tab
    },
    async openCollection(folderPath: string, name: string) {
      const existing = this.tabByPath(folderPath)
      if (existing) {
        this.activeTabId = existing.id
        return existing
      }
      const meta = await ipc.readFolderMeta(folderPath)
      const tab = folderMetaToTab(folderPath, name, meta)
      this.tabs.push(tab)
      this.activeTabId = tab.id
      return tab
    },
    closeTab(tabId: string) {
      const index = this.tabs.findIndex((tab) => tab.id === tabId)
      if (index === -1) return
      this.tabs.splice(index, 1)
      if (this.activeTabId === tabId) {
        const fallback = this.tabs[index] ?? this.tabs[index - 1]
        this.activeTabId = fallback?.id ?? null
      }
      if (this.secondaryTabId === tabId) {
        this.secondaryTabId = this.tabs.find((t) => t.id !== this.activeTabId)?.id ?? this.activeTabId
      }
    },
    setActiveTab(tabId: string) {
      this.activeTabId = tabId
    },
    markDirty(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (tab) tab.isDirty = true
    },
    async saveTab(tabId: string) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab || !tab.requestPath) return
      tab.isSaving = true
      try {
        if (tab.kind === 'collection') {
          await ipc.writeFolderMeta(tab.requestPath, tabToFolderMeta(tab))
        } else if (tab.kind === 'environment') {
          const variables = Object.fromEntries(tab.variables.filter((v) => v.key !== '').map((v) => [v.key, v.value]))
          // updateVariables aktif ortamın activeVariables senkronunu da yapar.
          await useEnvironmentsStore().updateVariables(tab.requestPath, tab.name, variables)
        } else {
          await ipc.writeRequestFile(tab.requestPath, tabToRequestFile(tab))
        }
        tab.isDirty = false
      } finally {
        tab.isSaving = false
      }
    }
  }
})
