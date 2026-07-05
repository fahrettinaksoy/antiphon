<script setup lang="ts">
// Kenar çubuğu bölümleri için standart iskelet: başlık (header) + gövde + opsiyonel footer.
// Collections, APIs, Environments, Mock Servers, Monitors, History hepsi bunu kullanır.
defineProps<{
  title: string
  /** Başlık yanında opsiyonel sayaç rozeti. */
  count?: number
}>()
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
    </header>

    <v-divider />

    <div class="antiphon-section__body">
      <slot />
    </div>

    <template v-if="$slots.footer">
      <v-divider />
      <footer class="antiphon-section__footer">
        <slot name="footer" />
      </footer>
    </template>
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
