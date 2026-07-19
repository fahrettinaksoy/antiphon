<script setup lang="ts">
// GLOBAL app bar — çalışma alanına özel eylemler WorkspaceToolbar'da yaşar.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n'
import { useUiStore } from '../../stores/ui'
import WorkspaceMenu from '../workspace/WorkspaceMenu.vue'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUiStore()

// Tüm bar boş alanını pencere sürüklenebilir yap: Vuetify'ın içerik konteynerine
// `data-tauri-drag-region` eklenir (butonlar kendi tıklamalarını yakalar → etkilenmez).
const appBar = ref<{ $el?: HTMLElement }>()
onMounted(() => {
  appBar.value?.$el
    ?.querySelector('.v-toolbar__content')
    ?.setAttribute('data-tauri-drag-region', '')
})

// Hamburger yalnızca sol kenar çubuğunun var olduğu rotada (çalışma alanı) görünür.
const inWorkspace = computed(() => router.currentRoute.value.path === '/')

// Dil tek kaynak: uiStore.locale. App.vue izleyicisi lazy yükleyip i18n'e uygular.
function toggleLocale() {
  uiStore.setLocale(uiStore.locale === 'tr' ? 'en' : 'tr')
}

// Ana Sayfa ayrı bir genel sayfadır (son etkinlik + favoriler + son kullanılanlar).
function goHome() {
  if (router.currentRoute.value.path !== '/home') router.push('/home')
}
</script>

<template>
  <!-- MD3 top app bar: 64px yükseklik; başta kenar çubuğu aç/kapa (hamburger) gezinme ikonu.
       macOS'ta trafik ışıkları bu barın sol boşluğuna oturur (ayrı başlık şeridi yok). -->
  <v-app-bar
    ref="appBar"
    :elevation="0"
    height="64"
    class="px-2 antiphon-app-bar"
    data-tauri-drag-region
  >
    <template #prepend>
      <v-btn
        v-if="inWorkspace"
        icon="mdi-menu"
        variant="text"
        density="comfortable"
        :title="t('header.toggleSidebar')"
        @click="uiStore.toggleSidebar"
      />
      <v-icon
        icon="mdi-vector-triangle"
        size="22"
        class="mx-2"
        color="primary"
        data-tauri-drag-region
      />
      <!-- lang="en": marka adı büyük harfe çevrilirken Türkçe i→İ kuralı uygulanmasın (ANTIPHON, ANTİPHON değil). -->
      <span
        lang="en"
        class="text-subtitle-1 font-weight-bold mr-4 text-uppercase antiphon-brand"
        data-tauri-drag-region
        >{{ t('app.name') }}</span
      >
    </template>

    <!-- Sol gezinme bağlantıları (Postman: Home / Workspaces / API Network / Explore) -->
    <nav class="antiphon-nav">
      <v-btn variant="text" size="small" class="text-none antiphon-nav__link" @click="goHome">
        {{ t('header.home') }}
      </v-btn>

      <WorkspaceMenu />

      <v-btn
        variant="text"
        size="small"
        class="text-none antiphon-nav__link"
        @click="uiStore.openCommandPalette"
      >
        {{ t('header.explore') }}
      </v-btn>
    </nav>

    <v-spacer data-tauri-drag-region />

    <!-- Ortada belirgin arama kutusu (komut paletini açar) -->
    <button type="button" class="antiphon-search" @click="uiStore.openCommandPalette">
      <v-icon icon="mdi-magnify" size="18" class="antiphon-search__icon" />
      <span class="antiphon-search__placeholder">{{ t('header.searchPlaceholder') }}</span>
      <kbd class="antiphon-kbd">⌘K</kbd>
    </button>

    <v-spacer data-tauri-drag-region />

    <!-- Çalışma alanına özel eylemler (İçe Aktar, ortam, Git, Geçmiş) WorkspaceToolbar'da yaşar. -->
    <div class="antiphon-icon-group ml-1">
      <v-btn
        :icon="uiStore.themeName === 'antiphonDark' ? 'mdi-weather-night' : 'mdi-weather-sunny'"
        variant="text"
        density="comfortable"
        size="small"
        title="Tema"
        @click="uiStore.toggleTheme"
      />
      <v-btn variant="text" density="comfortable" size="small" title="Dil" @click="toggleLocale">{{
        uiStore.locale.toUpperCase()
      }}</v-btn>
      <v-btn
        icon="mdi-cog-outline"
        variant="text"
        density="comfortable"
        size="small"
        :title="t('settings.title')"
        @click="router.push('/settings')"
      />
    </div>
  </v-app-bar>
</template>

<style scoped>
/* Pencere sürükleme: boş bölgeler `data-tauri-drag-region` ile sürüklenebilir; butonlar/arama
   kendi tıklamalarını yakalar (attribute taşımaz) → sürükleme onları etkilemez. */
.antiphon-app-bar :deep([data-tauri-drag-region]) {
  cursor: default;
}
.antiphon-brand {
  letter-spacing: 0.04em;
}

/* Sol metin gezinme bağlantıları */
.antiphon-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.antiphon-nav__link {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Ortadaki arama kutusu — MD3 search bar: çerçevesiz, tam yuvarlak, dolgulu tonal yüzey. */
.antiphon-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: min(420px, 34vw);
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  cursor: text;
  transition: background-color 0.15s ease;
}
.antiphon-search:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.antiphon-search__icon {
  opacity: 0.6;
}
.antiphon-search__placeholder {
  flex: 1 1 auto;
  text-align: left;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.55;
}

/* İlişkili ikon butonlarını tek bir "hap" (pill) konteynerde gruplar. */
.antiphon-icon-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.antiphon-kbd {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  opacity: 0.7;
}
</style>
