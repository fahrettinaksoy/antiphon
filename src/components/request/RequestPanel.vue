<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import KeyValueEditor from './KeyValueEditor.vue'
import BodyEditor from './BodyEditor.vue'
import AuthPanel from './AuthPanel.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import type { RequestTab } from '../../stores/tabs'

const tab = defineModel<RequestTab>({ required: true })
const { t } = useI18n()
const activeSection = ref('params')
</script>

<template>
  <div class="d-flex flex-column h-100">
    <v-tabs v-model="activeSection" density="compact">
      <v-tab value="params">{{ t('request.tabs.params') }}</v-tab>
      <v-tab value="headers">{{ t('request.tabs.headers') }}</v-tab>
      <v-tab value="body">{{ t('request.tabs.body') }}</v-tab>
      <v-tab value="auth">{{ t('request.tabs.auth') }}</v-tab>
      <v-tab value="scripts">{{ t('request.tabs.scripts') }}</v-tab>
      <v-tab value="docs">{{ t('request.tabs.docs') }}</v-tab>
    </v-tabs>
    <v-divider />
    <v-window v-model="activeSection" class="flex-grow-1 overflow-y-auto">
      <v-window-item value="params" class="pa-3">
        <KeyValueEditor v-model="tab.params" />
      </v-window-item>
      <v-window-item value="headers" class="pa-3">
        <KeyValueEditor v-model="tab.headers" />
      </v-window-item>
      <v-window-item value="body" class="h-100">
        <BodyEditor v-model:mode="tab.body.mode" v-model:content="tab.body.content" />
      </v-window-item>
      <v-window-item value="auth" class="pa-3">
        <AuthPanel v-model="tab.auth" />
      </v-window-item>
      <v-window-item value="scripts" class="h-100 d-flex flex-column">
        <div class="text-caption text-medium-emphasis px-3 py-1">Pre-request Script</div>
        <CodeMirrorEditor v-model="tab.preRequestScript" language="javascript" style="height: 45%" />
        <v-divider />
        <div class="text-caption text-medium-emphasis px-3 py-1">Test Script</div>
        <CodeMirrorEditor v-model="tab.testScript" language="javascript" style="height: 45%" />
      </v-window-item>
      <v-window-item value="docs" class="h-100">
        <CodeMirrorEditor v-model="tab.docs" language="text" />
      </v-window-item>
    </v-window>
  </div>
</template>
