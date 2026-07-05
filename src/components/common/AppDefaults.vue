<script setup lang="ts">
// Merkezi Vuetify default preset'lerini bir alt-ağaca uygulayan ince sarmalayıcı.
// <v-defaults-provider>'ı doğrudan kullanmak yerine adlandırılmış preset'ler (DRY) sağlar.
// https://vuetifyjs.com/en/components/defaults-providers/
import { defaultsPresets, type DefaultsPresetName } from '../../plugins/vuetify-defaults'

withDefaults(
  defineProps<{
    preset: DefaultsPresetName
    // Vuetify: default'ların yalnızca doğrudan çocuklara uygulanmasını sağlar (iç içe
    // defaults-provider'lara veya teleport edilen içeriğe sızmasını engeller).
    scoped?: boolean
    disabled?: boolean
  }>(),
  { scoped: false, disabled: false }
)
</script>

<template>
  <v-defaults-provider :defaults="defaultsPresets[preset]" :scoped="scoped" :disabled="disabled">
    <slot />
  </v-defaults-provider>
</template>
