<script setup lang="ts">
import type { HttpMethod } from '../../stores/tabs'
import { computed } from 'vue'

const props = defineProps<{ modelValue: HttpMethod }>()
const emit = defineEmits<{ 'update:modelValue': [HttpMethod] }>()

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const colorByMethod: Record<HttpMethod, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  PATCH: 'method-patch',
  DELETE: 'method-delete',
  HEAD: 'secondary',
  OPTIONS: 'secondary'
}

const color = computed(() => colorByMethod[props.modelValue])
</script>

<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        variant="tonal"
        :color="color"
        class="antiphon-method-chip antiphon-mono text-body-2"
      >
        {{ modelValue }}
      </v-btn>
    </template>
    <v-list density="compact">
      <v-list-item
        v-for="method in methods"
        :key="method"
        @click="emit('update:modelValue', method)"
      >
        <v-list-item-title class="antiphon-mono" :class="`text-${colorByMethod[method]}`">
          {{ method }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
