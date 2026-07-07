<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, type Extension } from '@codemirror/state'
import { keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { xml } from '@codemirror/lang-xml'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { graphql as graphqlExtension, updateSchema } from 'cm6-graphql'
import type { GraphQLSchema } from 'graphql'
import { useUiStore } from '../../stores/ui'
import AppLtr from './AppLtr.vue'

type Language = 'json' | 'javascript' | 'xml' | 'html' | 'graphql' | 'text'

// `graphqlSchema` typed as `unknown` at the prop boundary: Vue's cross-SFC prop type extraction
// can't preserve GraphQLSchema's private class fields, which otherwise trips a spurious type error.
const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: Language
    placeholder?: string
    readOnly?: boolean
    /** Uzun satırları kaydır (yanıt görüntüleyici gibi salt-okunur kullanımlar için). */
    wrap?: boolean
    graphqlSchema?: unknown
  }>(),
  { language: 'text', placeholder: '', readOnly: false, wrap: false, graphqlSchema: undefined }
)

const typedGraphqlSchema = () => props.graphqlSchema as GraphQLSchema | undefined
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const uiStore = useUiStore()
const containerRef = ref<HTMLDivElement | null>(null)
const view = shallowRef<EditorView | null>(null)

function languageExtension(language: Language): Extension[] {
  switch (language) {
    case 'json':
      return [json()]
    case 'javascript':
      return [javascript()]
    case 'xml':
      return [xml()]
    case 'html':
      return [html()]
    case 'graphql':
      return graphqlExtension(typedGraphqlSchema())
    default:
      return []
  }
}

function buildExtensions(): Extension[] {
  const extensions: Extension[] = [
    basicSetup,
    keymap.of([indentWithTab]),
    ...languageExtension(props.language),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
    EditorView.editable.of(!props.readOnly)
  ]
  if (props.placeholder) extensions.push(cmPlaceholder(props.placeholder))
  if (props.wrap) extensions.push(EditorView.lineWrapping)
  if (uiStore.themeName === 'antiphonDark') extensions.push(oneDark)
  return extensions
}

function createEditor() {
  if (!containerRef.value) return
  view.value?.destroy()
  view.value = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: buildExtensions() }),
    parent: containerRef.value
  })
}

onMounted(createEditor)
onBeforeUnmount(() => view.value?.destroy())

// Araç çubukları (ör. Docs markdown editörü) seçim üzerinde işlem yapabilsin diye view dışa açılır.
defineExpose({ view })

watch(() => props.language, createEditor)
watch(() => props.wrap, createEditor)
watch(() => uiStore.themeName, createEditor)
watch(
  () => props.graphqlSchema,
  () => {
    if (view.value && props.language === 'graphql') updateSchema(view.value, typedGraphqlSchema())
  }
)

watch(
  () => props.modelValue,
  (value) => {
    const current = view.value
    if (!current || value === current.state.doc.toString()) return
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } })
  }
)
</script>

<template>
  <!-- Kod her zaman LTR: RTL bir dilde bile editör ters dönmez. -->
  <AppLtr>
    <div ref="containerRef" class="antiphon-codemirror" />
  </AppLtr>
</template>

<style scoped>
.antiphon-codemirror {
  height: 100%;
  overflow: auto;
  font-size: 13px;
}
.antiphon-codemirror :deep(.cm-editor) {
  height: 100%;
}
.antiphon-codemirror :deep(.cm-scroller) {
  font-family: var(--antiphon-font-mono);
}
</style>
