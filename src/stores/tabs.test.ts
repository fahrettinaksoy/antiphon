import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTabsStore, tabToRequestFile } from './tabs'

describe('tabs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens a new blank HTTP tab with sensible defaults and makes it active', () => {
    const store = useTabsStore()
    const tab = store.openNewTab()

    expect(store.tabs).toHaveLength(1)
    expect(store.activeTabId).toBe(tab.id)
    expect(tab.protocol).toBe('http')
    expect(tab.method).toBe('GET')
    expect(tab.requestPath).toBeNull()
    expect(tab.isDirty).toBe(false)
  })

  it('defaults GraphQL tabs to POST and other protocol tabs stay non-HTTP', () => {
    const store = useTabsStore()
    const gqlTab = store.openNewTab('GQL', 'graphql')
    expect(gqlTab.method).toBe('POST')

    const wsTab = store.openNewTab('WS', 'ws')
    expect(wsTab.protocol).toBe('ws')
  })

  it('closes a tab and falls back the active tab to a neighbor', () => {
    const store = useTabsStore()
    const first = store.openNewTab('First')
    const second = store.openNewTab('Second')
    expect(store.activeTabId).toBe(second.id)

    store.closeTab(second.id)
    expect(store.tabs).toHaveLength(1)
    expect(store.activeTabId).toBe(first.id)
  })

  it('clears activeTabId when the last tab is closed', () => {
    const store = useTabsStore()
    const only = store.openNewTab()
    store.closeTab(only.id)
    expect(store.tabs).toHaveLength(0)
    expect(store.activeTabId).toBeNull()
  })

  it('marks a tab dirty independently of others', () => {
    const store = useTabsStore()
    const tab = store.openNewTab()
    expect(tab.isDirty).toBe(false)
    store.markDirty(tab.id)
    expect(store.activeTab?.isDirty).toBe(true)
  })

  it('reassigns the secondary split-view tab when it gets closed', () => {
    const store = useTabsStore()
    const first = store.openNewTab('First')
    const second = store.openNewTab('Second')
    store.setSecondaryTab(second.id)
    expect(store.secondaryTabId).toBe(second.id)

    store.closeTab(second.id)
    expect(store.secondaryTabId).toBe(first.id)
  })

  it('toggles split view on and picks a distinct secondary tab automatically', () => {
    const store = useTabsStore()
    const first = store.openNewTab('First')
    store.openNewTab('Second')
    store.setActiveTab(first.id)

    expect(store.splitViewEnabled).toBe(false)
    store.toggleSplitView()
    expect(store.splitViewEnabled).toBe(true)
    expect(store.secondaryTabId).not.toBe(first.id)
  })
})

describe('tabToRequestFile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters out blank key/value rows and maps optional script fields', () => {
    const store = useTabsStore()
    const tab = store.openNewTab('Ping')
    tab.headers = [
      { key: 'X-Test', value: '1', enabled: true },
      { key: '', value: '', enabled: true }
    ]
    tab.preRequestScript = 'console.log(1)'

    const file = tabToRequestFile(tab)
    expect(file.headers).toHaveLength(1)
    expect(file.preRequestScript).toBe('console.log(1)')
    expect(file.testScript).toBeUndefined()
  })
})
