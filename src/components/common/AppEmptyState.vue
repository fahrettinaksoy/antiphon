<script setup lang="ts">
// Tüm "boş durum" ekranları için ortak, dinamik sarmalayıcı.
// Vuetify'nin v-empty-state bileşenini kullanır.
// https://vuetifyjs.com/en/components/empty-states/
withDefaults(
  defineProps<{
    icon?: string
    title?: string
    text?: string
    /** Boyut: panel içi küçük alanlar için 'compact'. */
    size?: 'compact' | 'default'
    /** Ana buton metni (verilirse buton gösterilir). */
    actionText?: string
    actionIcon?: string
    actionColor?: string
  }>(),
  {
    icon: 'mdi-inbox-outline',
    size: 'default',
    actionColor: 'primary'
  }
)

defineEmits<{ action: [] }>()
</script>

<template>
  <v-empty-state
    :icon="icon"
    :title="title"
    :text="text"
    :size="size === 'compact' ? 64 : 96"
    class="antiphon-empty"
    :class="{ 'antiphon-empty--compact': size === 'compact' }"
  >
    <template v-if="$slots.media" #media>
      <slot name="media" />
    </template>

    <template v-if="actionText || $slots.actions" #actions>
      <slot name="actions">
        <v-btn
          variant="tonal"
          size="small"
          class="text-none"
          :color="actionColor"
          :prepend-icon="actionIcon"
          @click="$emit('action')"
        >
          {{ actionText }}
        </v-btn>
      </slot>
    </template>
  </v-empty-state>
</template>

<style scoped>
.antiphon-empty {
  height: 100%;
}
.antiphon-empty--compact :deep(.v-empty-state__title) {
  font-size: 0.9rem;
}
.antiphon-empty--compact :deep(.v-empty-state__text) {
  font-size: 0.8rem;
}
</style>
