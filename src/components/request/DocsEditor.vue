<script setup lang="ts">
import type { EditorView } from 'codemirror'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
// İstek dokümantasyonu editörü (Postman "Docs" karşılığı):
// üstte markdown biçimlendirme araç çubuğu, sağda iki editör türü arasında geçiş —
// "Markdown" (kaynak, CodeMirror) ve "Önizleme" (render edilmiş markdown).
import { computed, ref } from 'vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'

const docs = defineModel<string>({ required: true })

type EditorMode = 'edit' | 'preview'
const editorMode = ref<EditorMode>('edit')
const editorModeOptions = [
  { title: 'Markdown', value: 'edit' },
  { title: 'Önizleme', value: 'preview' }
]

const editorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)

function withView(action: (view: EditorView) => void) {
  const view = editorRef.value?.view as EditorView | null | undefined
  if (!view) return
  action(view)
  view.focus()
}

/** Seçimi verilen işaretlerle sarar; seçim yoksa işaretlerin arasına imleci bırakır. */
function wrapSelection(prefix: string, suffix = prefix) {
  withView((view) => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: `${prefix}${selected}${suffix}` },
      selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length }
    })
  })
}

/** Seçimdeki her satırın başına işaret ekler (liste, alıntı, başlık). */
function prefixLines(prefix: string) {
  withView((view) => {
    const { from, to } = view.state.selection.main
    const start = view.state.doc.lineAt(from).number
    const end = view.state.doc.lineAt(to).number
    const changes = []
    for (let n = start; n <= end; n++)
      changes.push({ from: view.state.doc.line(n).from, insert: prefix })
    view.dispatch({ changes })
  })
}

/** Seçimdeki satırların başındaki başlık işaretlerini kaldırır. */
function clearHeading() {
  withView((view) => {
    const { from, to } = view.state.selection.main
    const start = view.state.doc.lineAt(from).number
    const end = view.state.doc.lineAt(to).number
    const changes = []
    for (let n = start; n <= end; n++) {
      const line = view.state.doc.line(n)
      const match = /^#{1,6}\s+/.exec(line.text)
      if (match) changes.push({ from: line.from, to: line.from + match[0].length })
    }
    if (changes.length > 0) view.dispatch({ changes })
  })
}

/** İmlecin bulunduğu satırın altına blok ekler (tablo, kod bloğu). */
function insertBlock(text: string) {
  withView((view) => {
    const line = view.state.doc.lineAt(view.state.selection.main.to)
    const insert = `\n\n${text}\n`
    view.dispatch({
      changes: { from: line.to, insert },
      selection: { anchor: line.to + insert.length }
    })
  })
}

const TABLE_TEMPLATE = '| Başlık | Başlık |\n| --- | --- |\n| Hücre | Hücre |'
const CODE_BLOCK_TEMPLATE = '```\nkod\n```'

const headingOptions = [
  { title: 'Normal metin', action: clearHeading },
  { title: 'Başlık 1', action: () => prefixLines('# ') },
  { title: 'Başlık 2', action: () => prefixLines('## ') },
  { title: 'Başlık 3', action: () => prefixLines('### ') }
]

// Önizleme: markdown → HTML; DOMPurify script/javascript: gibi tehlikeli içerikleri temizler
// (workspace'ler git/gist ile paylaşılabildiğinden üçüncü taraf docs içeriği güvenilmez olabilir).
const renderedDocs = computed(() => {
  const html = marked.parse(docs.value || '_Henüz dokümantasyon yok._', { async: false }) as string
  return DOMPurify.sanitize(html)
})
</script>

<template>
  <div class="d-flex flex-column h-100">
    <!-- Biçimlendirme araç çubuğu + editör türü seçimi -->
    <div class="d-flex align-center ga-1 px-2 py-1 flex-wrap">
      <template v-if="editorMode === 'edit'">
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              size="small"
              variant="text"
              append-icon="mdi-chevron-down"
              class="text-none"
            >
              Metin stili
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item v-for="opt in headingOptions" :key="opt.title" @click="opt.action()">
              <v-list-item-title class="text-body-2">{{ opt.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-divider vertical inset class="mx-1" />

        <v-btn
          icon="mdi-format-bold"
          size="small"
          variant="text"
          title="Kalın"
          @click="wrapSelection('**')"
        />
        <v-btn
          icon="mdi-format-italic"
          size="small"
          variant="text"
          title="İtalik"
          @click="wrapSelection('*')"
        />
        <v-btn
          icon="mdi-format-strikethrough"
          size="small"
          variant="text"
          title="Üstü çizili"
          @click="wrapSelection('~~')"
        />
        <v-btn
          icon="mdi-format-list-bulleted"
          size="small"
          variant="text"
          title="Madde listesi"
          @click="prefixLines('- ')"
        />
        <v-btn
          icon="mdi-format-list-numbered"
          size="small"
          variant="text"
          title="Numaralı liste"
          @click="prefixLines('1. ')"
        />
        <v-btn
          icon="mdi-table"
          size="small"
          variant="text"
          title="Tablo"
          @click="insertBlock(TABLE_TEMPLATE)"
        />
        <v-btn
          icon="mdi-image-outline"
          size="small"
          variant="text"
          title="Görsel"
          @click="wrapSelection('![', '](url)')"
        />
        <v-btn
          icon="mdi-link-variant"
          size="small"
          variant="text"
          title="Bağlantı"
          @click="wrapSelection('[', '](url)')"
        />
        <v-btn
          icon="mdi-format-quote-close"
          size="small"
          variant="text"
          title="Alıntı"
          @click="prefixLines('> ')"
        />
        <v-btn
          icon="mdi-code-tags"
          size="small"
          variant="text"
          title="Satır içi kod"
          @click="wrapSelection('`')"
        />
        <v-btn
          icon="mdi-code-braces"
          size="small"
          variant="text"
          title="Kod bloğu"
          @click="insertBlock(CODE_BLOCK_TEMPLATE)"
        />
      </template>

      <v-spacer />
      <v-select
        v-model="editorMode"
        :items="editorModeOptions"
        density="compact"
        hide-details
        variant="plain"
        class="antiphon-docs-mode flex-grow-0"
      />
    </div>

    <!-- Kaynak (markdown) editörü -->
    <CodeMirrorEditor
      v-if="editorMode === 'edit'"
      ref="editorRef"
      v-model="docs"
      language="text"
      placeholder="Bu isteği dokümante edin… (markdown desteklenir)"
      class="flex-grow-1"
    />

    <!-- Render edilmiş önizleme -->
    <!-- eslint-disable-next-line vue/no-v-html -- DOMPurify ile temizleniyor -->
    <div
      v-else
      class="antiphon-docs-preview flex-grow-1 overflow-y-auto pa-4"
      v-html="renderedDocs"
    />
  </div>
</template>

<style scoped>
.antiphon-docs-mode {
  min-width: 120px;
}
.antiphon-docs-mode :deep(.v-field__input) {
  font-size: 13px;
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 32px;
}

/* Önizleme tipografisi — MD okuma yüzeyi */
.antiphon-docs-preview :deep(h1),
.antiphon-docs-preview :deep(h2),
.antiphon-docs-preview :deep(h3) {
  margin: 16px 0 8px;
  line-height: 1.3;
}
.antiphon-docs-preview :deep(p) {
  margin: 8px 0;
}
.antiphon-docs-preview :deep(ul),
.antiphon-docs-preview :deep(ol) {
  padding-inline-start: 24px;
  margin: 8px 0;
}
.antiphon-docs-preview :deep(code) {
  font-family: var(--antiphon-font-mono);
  font-size: 0.9em;
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 4px;
  padding: 1px 5px;
}
.antiphon-docs-preview :deep(pre) {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
}
.antiphon-docs-preview :deep(pre code) {
  background: transparent;
  padding: 0;
}
.antiphon-docs-preview :deep(blockquote) {
  border-inline-start: 3px solid rgba(var(--v-theme-primary), 0.5);
  margin: 8px 0;
  padding: 4px 12px;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.antiphon-docs-preview :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
}
.antiphon-docs-preview :deep(th),
.antiphon-docs-preview :deep(td) {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  padding: 6px 12px;
  text-align: start;
}
.antiphon-docs-preview :deep(img) {
  max-width: 100%;
}
.antiphon-docs-preview :deep(a) {
  color: rgb(var(--v-theme-primary));
}
</style>
