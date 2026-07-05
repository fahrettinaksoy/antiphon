<script setup lang="ts">
import { computed } from 'vue'
import type { GraphQLSchema } from 'graphql'

// `schema` typed as `unknown` at the prop boundary: Vue's cross-SFC prop type extraction can't
// preserve GraphQLSchema's private class fields, which otherwise trips a spurious type error.
const props = defineProps<{ schema: unknown; isLoading: boolean }>()
const typedSchema = computed(() => props.schema as GraphQLSchema | null)

interface FieldSummary {
  name: string
  typeName: string
  argCount: number
}

function summarizeFields(getFields: (() => Record<string, { type: unknown; args: unknown[] }>) | undefined): FieldSummary[] {
  if (!getFields) return []
  return Object.entries(getFields()).map(([name, field]) => ({
    name,
    typeName: String(field.type),
    argCount: field.args.length
  }))
}

const groups = computed(() => {
  const schema = typedSchema.value
  if (!schema) return []
  const query = schema.getQueryType()
  const mutation = schema.getMutationType()
  const subscription = schema.getSubscriptionType()

  return [
    { title: 'Query', icon: 'mdi-magnify', fields: summarizeFields(query?.getFields.bind(query) as never) },
    { title: 'Mutation', icon: 'mdi-pencil-outline', fields: summarizeFields(mutation?.getFields.bind(mutation) as never) },
    { title: 'Subscription', icon: 'mdi-access-point', fields: summarizeFields(subscription?.getFields.bind(subscription) as never) }
  ].filter((g) => g.fields.length > 0)
})
</script>

<template>
  <div class="h-100 overflow-y-auto pa-2">
    <div v-if="isLoading" class="d-flex align-center justify-center pa-6">
      <v-progress-circular indeterminate color="primary" size="24" />
    </div>
    <div v-else-if="!schema" class="text-caption text-medium-emphasis pa-3 text-center">
      Şema keşfedilmedi. "Şemayı Getir" ile introspection çalıştırın.
    </div>
    <v-list v-else density="compact" open-strategy="multiple">
      <v-list-group v-for="group in groups" :key="group.title" :value="group.title">
        <template #activator="{ props: groupProps }">
          <v-list-item v-bind="groupProps" :prepend-icon="group.icon">
            <v-list-item-title class="font-weight-bold">{{ group.title }}</v-list-item-title>
          </v-list-item>
        </template>
        <v-list-item v-for="field in group.fields" :key="field.name" density="compact">
          <v-list-item-title class="antiphon-mono text-body-2">
            {{ field.name }}<span v-if="field.argCount" class="text-medium-emphasis">({{ field.argCount }})</span>
          </v-list-item-title>
          <v-list-item-subtitle class="antiphon-mono text-caption">{{ field.typeName }}</v-list-item-subtitle>
        </v-list-item>
      </v-list-group>
    </v-list>
  </div>
</template>
