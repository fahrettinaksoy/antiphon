<script setup lang="ts">
// Teknik içeriği (kod, URL, JSON, monospace) her zaman soldan-sağa (LTR) render eder —
// uygulama bir RTL dile (ar/he/fa…) geçse bile kod/URL ters dönmez.
//
// <v-locale-provider :rtl="false"> `display: contents` bir sarmalayıcıya `.v-locale--is-ltr`
// sınıfını ekler; bu sınıf global Vuetify CSS'inde `direction: ltr` uygular (hem Vuetify
// hem düz HTML — CodeMirror, <pre> — içeriğini kapsar). Layout kutusu eklemez.
// https://vuetifyjs.com/en/components/locale-providers/
</script>

<template>
  <v-locale-provider :rtl="false">
    <slot />
  </v-locale-provider>
</template>
