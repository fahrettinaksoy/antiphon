import { defineStore } from 'pinia'
import type { Platform } from '@shared/ipc-contract'

export type SidebarSection = 'collections' | 'apis' | 'environments' | 'mockServers' | 'monitors' | 'history'
export type VuetifyThemeName = 'antiphonDark' | 'antiphonLight' | 'antiphonHcDark' | 'antiphonHcLight'
// Açık/koyu tercihi: sabit ya da 'system' (OS'i canlı takip eder).
export type ThemePreference = 'system' | 'antiphonDark' | 'antiphonLight'
// Kontrast tercihi (açık/koyu'dan bağımsız eksen): normal/yüksek ya da 'system' (OS prefers-contrast).
export type ContrastPreference = 'system' | 'normal' | 'high'

export const useUiStore = defineStore('ui', {
  state: () => ({
    // Kalıcı olan TERCİH'tir; efektif tema `themeName` getter'ından hesaplanır.
    themePreference: 'system' as ThemePreference,
    contrastPreference: 'system' as ContrastPreference,
    // OS tercihleri (runtime; App.vue'de @vueuse ile canlı güncellenir).
    systemPrefersDark: true,
    systemPrefersMoreContrast: false,
    sidebarWidth: 280,
    activeSidebarSection: 'collections' as SidebarSection,
    commandPaletteOpen: false,
    historyDrawerOpen: false,
    gitDrawerOpen: false,
    mockServerDialogOpen: false,
    createWorkspaceDialogOpen: false,
    locale: 'tr' as 'tr' | 'en',
    favoriteWorkspaceIds: [] as string[],
    platform: null as Platform | null
  }),
  getters: {
    // Efektif koyu-mu? (tercih 'system' ise OS'e göre)
    isDarkEffective: (state): boolean =>
      state.themePreference === 'system' ? state.systemPrefersDark : state.themePreference === 'antiphonDark',
    // Efektif yüksek-kontrast-mı? (tercih 'system' ise OS prefers-contrast'e göre)
    isHighContrastEffective: (state): boolean =>
      state.contrastPreference === 'system' ? state.systemPrefersMoreContrast : state.contrastPreference === 'high',
    // Efektif Vuetify teması: açık/koyu × normal/yüksek-kontrast → 4 temadan biri.
    themeName(): VuetifyThemeName {
      if (this.isHighContrastEffective) return this.isDarkEffective ? 'antiphonHcDark' : 'antiphonHcLight'
      return this.isDarkEffective ? 'antiphonDark' : 'antiphonLight'
    },
    // macOS'ta `titleBarStyle: 'hiddenInset'` pencere trafik ışıklarını (kırmızı/sarı/yeşil) web
    // içeriğinin üzerine bindirir; app bar bu alanı boşluk bırakarak telafi etmeli.
    needsTrafficLightInset: (state) => state.platform === 'darwin'
  },
  actions: {
    setPlatform(platform: Platform) {
      this.platform = platform
    },
    setSidebarSection(section: SidebarSection) {
      this.activeSidebarSection = section
    },
    setThemePreference(pref: ThemePreference) {
      this.themePreference = pref
    },
    setContrastPreference(pref: ContrastPreference) {
      this.contrastPreference = pref
    },
    setSystemPrefersDark(prefersDark: boolean) {
      this.systemPrefersDark = prefersDark
    },
    setSystemPrefersMoreContrast(prefersMore: boolean) {
      this.systemPrefersMoreContrast = prefersMore
    },
    toggleTheme() {
      // Hızlı geçiş: efektif açık/koyu'nun tersine SABİT tercih atar (sistem modundan çıkar).
      this.themePreference = this.isDarkEffective ? 'antiphonLight' : 'antiphonDark'
    },
    openCommandPalette() {
      this.commandPaletteOpen = true
    },
    closeCommandPalette() {
      this.commandPaletteOpen = false
    },
    toggleHistoryDrawer() {
      this.historyDrawerOpen = !this.historyDrawerOpen
    },
    toggleGitDrawer() {
      this.gitDrawerOpen = !this.gitDrawerOpen
    },
    openMockServerDialog() {
      this.mockServerDialogOpen = true
    },
    openCreateWorkspaceDialog() {
      this.createWorkspaceDialogOpen = true
    },
    closeMockServerDialog() {
      this.mockServerDialogOpen = false
    },
    setLocale(locale: 'tr' | 'en') {
      this.locale = locale
    },
    toggleFavoriteWorkspace(id: string) {
      const idx = this.favoriteWorkspaceIds.indexOf(id)
      if (idx === -1) this.favoriteWorkspaceIds.push(id)
      else this.favoriteWorkspaceIds.splice(idx, 1)
    }
  },
  persist: {
    // systemPrefers* KALICI DEĞİL — her açılışta OS'ten canlı okunur.
    pick: ['themePreference', 'contrastPreference', 'locale', 'sidebarWidth', 'activeSidebarSection', 'favoriteWorkspaceIds']
  }
})
