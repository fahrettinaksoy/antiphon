<script setup lang="ts">
// Kenar çubuğu bölümleri için STANDART iskelet — Collections, APIs, Environments,
// Mock Servers, Monitors, History hepsi bunu kullanır:
//   header : başlık + sayaç rozeti + bölüme özel eylemler (#actions) + standart "yeni ekle" (+)
//   arama  : searchable ise arama alanı (v-model:search) + opsiyonel çoklu-seçim filtre menüsü (v-model:filter)
//   gövde  : varsayılan slot
//   footer : opsiyonel bölüm alt eylem/özet alanı (#footer)
import { useI18n } from '@/composables/i18n'

const props = defineProps<{
  title: string
  /** Başlık yanında opsiyonel sayaç rozeti. */
  count?: number
  /** true ise başlığın altında arama satırı görünür (v-model:search). */
  searchable?: boolean
  searchPlaceholder?: string
  /** Verilirse arama satırında filtre menüsü görünür (v-model:filter, çoklu seçim). */
  filterOptions?: { title: string; value: string }[]
  /** true ise başlıkta standart "yeni ekle" (+) butonu görünür → @add */
  addable?: boolean
  addTooltip?: string
}>()

const emit = defineEmits<{ add: [] }>()

const { t } = useI18n()
const search = defineModel<string>('search', { default: '' })
const filter = defineModel<string[]>('filter', { default: () => [] })

function toggleFilter(value: string) {
  filter.value = filter.value.includes(value)
    ? filter.value.filter((v) => v !== value)
    : [...filter.value, value]
}
</script>

<template>
  <section class="antiphon-section">
    <header class="antiphon-section__header">
      <span class="antiphon-section__title text-truncate">{{ title }}</span>
      <v-chip v-if="count !== undefined" size="x-small" variant="tonal" class="antiphon-section__count">
        {{ count }}
      </v-chip>
      <v-spacer />
      <div v-if="$slots.actions" class="antiphon-section__actions">
        <slot name="actions" />
      </div>
      <v-btn
        v-if="addable"
        icon="mdi-plus"
        size="x-small"
        variant="text"
        :title="addTooltip ?? t('sidebar.add')"
        @click="emit('add')"
      />
    </header>

    <!-- Standart arama + filtre satırı -->
    <div v-if="searchable" class="antiphon-section__search">
      <v-text-field
        v-model="search"
        :placeholder="searchPlaceholder ?? t('sidebar.search')"
        density="compact"
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        rounded="lg"
        class="flex-grow-1"
      />
      <v-menu v-if="filterOptions?.length" :close-on-content-click="false" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" size="small" variant="text" icon :title="t('sidebar.filter')">
            <v-badge :model-value="filter.length > 0" dot color="primary">
              <v-icon icon="mdi-filter-variant" size="18" />
            </v-badge>
          </v-btn>
        </template>
        <v-list density="compact" min-width="160">
          <v-list-item v-for="opt in filterOptions" :key="opt.value" @click="toggleFilter(opt.value)">
            <template #prepend>
              <v-checkbox-btn
                :model-value="filter.includes(opt.value)"
                density="compact"
                class="mr-1"
                @click.stop="toggleFilter(opt.value)"
              />
            </template>
            <v-list-item-title class="text-body-2">{{ opt.title }}</v-list-item-title>
          </v-list-item>
          <template v-if="filter.length > 0">
            <v-divider class="my-1" />
            <v-list-item @click="filter = []">
              <v-list-item-title class="text-body-2 text-medium-emphasis">
                {{ t('sidebar.clearFilter') }}
              </v-list-item-title>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
    </div>

    <!-- MD3: bölüm ayrımı divider ile değil boşluk ve tipografi ile yapılır. -->
    <div class="antiphon-section__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="antiphon-section__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.antiphon-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.antiphon-section__header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 8px 0 12px;
  flex: 0 0 auto;
}
.antiphon-section__title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.antiphon-section__count {
  flex: 0 0 auto;
}
.antiphon-section__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}
.antiphon-section__search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px 8px 8px;
  flex: 0 0 auto;
}
.antiphon-section__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.antiphon-section__footer {
  flex: 0 0 auto;
  padding: 8px 12px;
}
</style>
