<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import { useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useGitIdentityStore } from '../stores/git-identity'
import { useWorkspaceStore } from '../stores/workspace'
import { nanoid } from 'nanoid'
import type { CookieSummaryDto, NetworkSettingsDto, WorkspaceSettingsOverrideDto } from '@shared/ipc-contract'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUiStore()
const gitIdentityStore = useGitIdentityStore()
const workspaceStore = useWorkspaceStore()

// Tema tercihleri — her biri <v-theme-provider> ile önizlenir. 'system' OS'i canlı takip eder
// ve efektif temayı (uiStore.themeName) önizler.
const themeOptions = computed(() => [
  { value: 'antiphonLight' as const, label: t('settings.light'), icon: 'mdi-white-balance-sunny', previewTheme: 'antiphonLight' as const },
  { value: 'antiphonDark' as const, label: t('settings.dark'), icon: 'mdi-weather-night', previewTheme: 'antiphonDark' as const },
  { value: 'system' as const, label: t('settings.system'), icon: 'mdi-monitor', previewTheme: uiStore.themeName }
])

// Kontrast tercihi (açık/koyu'dan bağımsız) — WCAG yüksek kontrast erişilebilirliği.
const contrastOptions = computed(() => [
  { value: 'normal' as const, label: t('settings.contrastNormal') },
  { value: 'high' as const, label: t('settings.contrastHigh') },
  { value: 'system' as const, label: t('settings.system') }
])

const secretKeys = ref<string[]>([])
const newSecretKey = ref('')
const newSecretValue = ref('')
const secretPlaceholderExample = '{{secret:AD}}'

async function refreshSecrets() {
  secretKeys.value = await window.antiphon.listSecretKeys()
}

async function addSecret() {
  if (!newSecretKey.value.trim()) return
  await window.antiphon.setSecret(newSecretKey.value.trim(), newSecretValue.value)
  newSecretKey.value = ''
  newSecretValue.value = ''
  await refreshSecrets()
}

async function removeSecret(key: string) {
  await window.antiphon.deleteSecret(key)
  await refreshSecrets()
}

const networkSettings = ref<NetworkSettingsDto>({
  proxyEnabled: false,
  proxyUrl: '',
  customCaPem: '',
  clientCertificates: [],
  rejectUnauthorized: true,
  cookieJarEnabled: true
})
const cookies = ref<CookieSummaryDto[]>([])

async function refreshNetworkSettings() {
  networkSettings.value = await window.antiphon.getNetworkSettings()
}

async function saveNetworkSettings() {
  await window.antiphon.setNetworkSettings(networkSettings.value)
}

function addClientCertificate() {
  networkSettings.value.clientCertificates.push({
    id: nanoid(6),
    hostPattern: '*.example.com',
    certPem: '',
    keyPem: '',
    passphrase: ''
  })
}

function removeClientCertificate(id: string) {
  networkSettings.value.clientCertificates = networkSettings.value.clientCertificates.filter((c) => c.id !== id)
}

async function refreshCookies() {
  cookies.value = await window.antiphon.listCookies()
}

async function clearAllCookies() {
  await window.antiphon.clearCookies()
  await refreshCookies()
}

const workspaceOverride = ref<WorkspaceSettingsOverrideDto>({})
const overrideNetworkEnabled = ref(false)
const overrideGitIdentityEnabled = ref(false)

async function refreshWorkspaceOverride() {
  if (!workspaceStore.rootPath) return
  workspaceOverride.value = await window.antiphon.getWorkspaceSettingsOverride(workspaceStore.rootPath)
  overrideNetworkEnabled.value = !!workspaceOverride.value.networkSettings
  overrideGitIdentityEnabled.value = !!workspaceOverride.value.gitIdentity
  if (!workspaceOverride.value.networkSettings) {
    workspaceOverride.value.networkSettings = {
      proxyEnabled: false,
      proxyUrl: '',
      customCaPem: '',
      rejectUnauthorized: true,
      cookieJarEnabled: true
    }
  }
  if (!workspaceOverride.value.gitIdentity) {
    workspaceOverride.value.gitIdentity = { name: '', email: '' }
  }
}

async function saveWorkspaceOverride() {
  if (!workspaceStore.rootPath) return
  const payload: WorkspaceSettingsOverrideDto = {
    networkSettings: overrideNetworkEnabled.value ? workspaceOverride.value.networkSettings : undefined,
    gitIdentity: overrideGitIdentityEnabled.value ? workspaceOverride.value.gitIdentity : undefined
  }
  await window.antiphon.setWorkspaceSettingsOverride(workspaceStore.rootPath, payload)
  workspaceOverride.value = payload
}

onMounted(() => {
  refreshSecrets()
  refreshNetworkSettings()
  refreshCookies()
  refreshWorkspaceOverride()
})
</script>

<template>
  <v-app-bar :elevation="0" density="compact">
    <v-btn icon="mdi-arrow-left" variant="text" @click="router.push('/')" />
    <v-toolbar-title>{{ t('settings.title') }}</v-toolbar-title>
  </v-app-bar>

  <v-main>
    <v-container max-width="640">
      <v-card variant="tonal" class="pa-4 mb-4">
        <div class="text-subtitle-2 mb-1">{{ t('settings.theme') }}</div>
        <p class="text-caption text-medium-emphasis mb-3">{{ t('settings.themeHint') }}</p>
        <!-- Her önizleme, aktif temadan bağımsız olarak kendi temasında render edilir. -->
        <div class="d-flex ga-3">
          <v-theme-provider
            v-for="opt in themeOptions"
            :key="opt.value"
            :theme="opt.previewTheme"
            with-background
            class="antiphon-theme-frame"
          >
            <button
              type="button"
              class="antiphon-theme-preview"
              :class="{ 'antiphon-theme-preview--active': uiStore.themePreference === opt.value }"
              @click="uiStore.setThemePreference(opt.value)"
            >
              <div class="d-flex align-center ga-2 mb-2">
                <v-icon :icon="opt.icon" size="16" />
                <span class="text-caption font-weight-bold">{{ opt.label }}</span>
                <v-spacer />
                <v-icon v-if="uiStore.themePreference === opt.value" icon="mdi-check-circle" size="16" color="primary" />
              </div>
              <div class="antiphon-theme-window">
                <div class="d-flex ga-1 mb-2">
                  <v-chip size="x-small" color="primary" variant="flat">primary</v-chip>
                  <v-chip size="x-small" color="secondary" variant="tonal">accent</v-chip>
                </div>
                <div class="antiphon-theme-line" style="width: 82%" />
                <div class="antiphon-theme-line" style="width: 56%" />
                <div class="d-flex ga-1 mt-2">
                  <span class="antiphon-theme-dot" style="background: rgb(var(--v-theme-method-get))" />
                  <span class="antiphon-theme-dot" style="background: rgb(var(--v-theme-method-post))" />
                  <span class="antiphon-theme-dot" style="background: rgb(var(--v-theme-method-put))" />
                  <span class="antiphon-theme-dot" style="background: rgb(var(--v-theme-method-delete))" />
                </div>
              </div>
            </button>
          </v-theme-provider>
        </div>

        <!-- Kontrast (açık/koyu'dan bağımsız) — WCAG yüksek kontrast erişilebilirliği. -->
        <v-divider class="my-4" />
        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
          <div>
            <div class="text-subtitle-2">{{ t('settings.contrast') }}</div>
            <p class="text-caption text-medium-emphasis mb-0">{{ t('settings.contrastHint') }}</p>
          </div>
          <v-btn-toggle
            :model-value="uiStore.contrastPreference"
            mandatory
            color="primary"
            density="comfortable"
            variant="outlined"
            @update:model-value="uiStore.setContrastPreference($event)"
          >
            <v-btn v-for="opt in contrastOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</v-btn>
          </v-btn-toggle>
        </div>
      </v-card>

      <v-card variant="tonal" class="pa-4 mb-4">
        <div class="d-flex align-center justify-space-between">
          <span>{{ t('settings.language') }}</span>
          <v-btn-toggle
            :model-value="uiStore.locale"
            mandatory
            color="primary"
            density="comfortable"
            variant="outlined"
            @update:model-value="uiStore.setLocale($event)"
          >
            <v-btn value="tr">TR</v-btn>
            <v-btn value="en">EN</v-btn>
          </v-btn-toggle>
        </div>
      </v-card>

      <v-card variant="tonal" class="pa-4 mb-4">
        <div class="text-subtitle-2 mb-2">Git Kimliği</div>
        <p class="text-caption text-medium-emphasis mb-3">Commit'lerde yazar bilgisi olarak kullanılır.</p>
        <div class="d-flex ga-2">
          <v-text-field v-model="gitIdentityStore.name" label="Ad Soyad" density="compact" hide-details />
          <v-text-field v-model="gitIdentityStore.email" label="E-posta" density="compact" hide-details />
        </div>
      </v-card>

      <v-card v-if="workspaceStore.isOpen" variant="tonal" class="pa-4 mb-4">
        <div class="text-subtitle-2 mb-2">Bu Çalışma Alanı İçin Override</div>
        <p class="text-caption text-medium-emphasis mb-3">
          Sadece açık olan bu workspace'te geçerli olur; <span class="antiphon-mono">.antiphon/settings.json</span> içine yazılır.
        </p>

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2">Git Kimliğini Override Et</span>
          <v-switch v-model="overrideGitIdentityEnabled" density="compact" hide-details color="primary" />
        </div>
        <div v-if="overrideGitIdentityEnabled && workspaceOverride.gitIdentity" class="d-flex ga-2 mb-3">
          <v-text-field v-model="workspaceOverride.gitIdentity.name" label="Ad Soyad" density="compact" hide-details />
          <v-text-field v-model="workspaceOverride.gitIdentity.email" label="E-posta" density="compact" hide-details />
        </div>

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2">Ağ Ayarlarını Override Et</span>
          <v-switch v-model="overrideNetworkEnabled" density="compact" hide-details color="primary" />
        </div>
        <template v-if="overrideNetworkEnabled && workspaceOverride.networkSettings">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-body-2">Proxy</span>
            <v-switch v-model="workspaceOverride.networkSettings.proxyEnabled" density="compact" hide-details color="primary" />
          </div>
          <v-text-field
            v-model="workspaceOverride.networkSettings.proxyUrl"
            :disabled="!workspaceOverride.networkSettings.proxyEnabled"
            placeholder="http://kullanici:sifre@proxy-host:8080"
            density="compact"
            class="antiphon-mono mb-3"
            hide-details
          />
          <div class="d-flex align-center justify-space-between mb-3">
            <span class="text-body-2">Çerez Kavanozu</span>
            <v-switch v-model="workspaceOverride.networkSettings.cookieJarEnabled" density="compact" hide-details color="primary" />
          </div>
        </template>

        <v-btn color="primary" variant="flat" class="text-none" @click="saveWorkspaceOverride">Workspace Override'ı Kaydet</v-btn>
      </v-card>

      <v-card variant="tonal" class="pa-4 mb-4">
        <div class="text-subtitle-2 mb-2">Ağ Ayarları</div>
        <p class="text-caption text-medium-emphasis mb-3">Proxy, özel CA, mTLS istemci sertifikası ve çerez (cookie) yönetimi.</p>

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2">Proxy</span>
          <v-switch v-model="networkSettings.proxyEnabled" density="compact" hide-details color="primary" />
        </div>
        <v-text-field
          v-model="networkSettings.proxyUrl"
          :disabled="!networkSettings.proxyEnabled"
          placeholder="http://kullanici:sifre@proxy-host:8080"
          density="compact"
          class="antiphon-mono mb-3"
          hide-details
        />

        <v-textarea
          v-model="networkSettings.customCaPem"
          label="Özel CA Sertifikası (PEM)"
          rows="3"
          density="compact"
          class="antiphon-mono mb-3"
          hide-details
        />

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-subtitle-2">mTLS İstemci Sertifikaları (host-bazlı)</span>
          <v-btn size="small" variant="text" prepend-icon="mdi-plus" class="text-none" @click="addClientCertificate">Ekle</v-btn>
        </div>
        <v-card
          v-for="cert in networkSettings.clientCertificates"
          :key="cert.id"
          variant="outlined"
          class="pa-3 mb-3"
        >
          <div class="d-flex align-center ga-2 mb-2">
            <v-text-field
              v-model="cert.hostPattern"
              label="Host deseni (ör. *.example.com)"
              density="compact"
              class="antiphon-mono"
              hide-details
            />
            <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removeClientCertificate(cert.id)" />
          </div>
          <div class="d-flex ga-2 mb-2">
            <v-textarea v-model="cert.certPem" label="İstemci Sertifikası (PEM)" rows="3" density="compact" class="antiphon-mono" hide-details />
            <v-textarea v-model="cert.keyPem" label="İstemci Anahtarı (PEM)" rows="3" density="compact" class="antiphon-mono" hide-details />
          </div>
          <v-text-field v-model="cert.passphrase" label="Anahtar Parolası (opsiyonel)" type="password" density="compact" hide-details />
        </v-card>
        <p v-if="networkSettings.clientCertificates.length === 0" class="text-caption text-disabled mb-3">
          Henüz istemci sertifikası eklenmedi.
        </p>

        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2">Sertifika Doğrulamasını Zorla (rejectUnauthorized)</span>
          <v-switch v-model="networkSettings.rejectUnauthorized" density="compact" hide-details color="primary" />
        </div>
        <div class="d-flex align-center justify-space-between mb-3">
          <span class="text-body-2">Çerez Kavanozu (Cookie Jar)</span>
          <v-switch v-model="networkSettings.cookieJarEnabled" density="compact" hide-details color="primary" />
        </div>

        <v-btn color="primary" variant="flat" class="text-none mb-4" @click="saveNetworkSettings">Ağ Ayarlarını Kaydet</v-btn>

        <v-divider class="mb-3" />
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-subtitle-2">Çerezler ({{ cookies.length }})</span>
          <div>
            <v-btn size="small" variant="text" class="text-none" @click="refreshCookies">Yenile</v-btn>
            <v-btn size="small" variant="text" color="error" class="text-none" @click="clearAllCookies">Tümünü Temizle</v-btn>
          </div>
        </div>
        <div v-for="cookie in cookies" :key="`${cookie.domain}-${cookie.key}`" class="text-caption antiphon-mono py-1">
          <span class="text-medium-emphasis">{{ cookie.domain }}</span> {{ cookie.key }}={{ cookie.value }}
        </div>
        <p v-if="cookies.length === 0" class="text-caption text-disabled">Henüz çerez yok.</p>
      </v-card>

      <v-card variant="tonal" class="pa-4">
        <div class="text-subtitle-2 mb-2">Secret Vault</div>
        <p class="text-caption text-medium-emphasis mb-3">
          Bu değerler OS anahtarlığı (keychain) üzerinden şifrelenir; dosyalarda yalnızca
          <code class="antiphon-mono">{{ secretPlaceholderExample }}</code> referansı tutulur.
        </p>

        <div v-for="key in secretKeys" :key="key" class="d-flex align-center justify-space-between py-1">
          <span class="antiphon-mono text-body-2">{{ key }}</span>
          <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" @click="removeSecret(key)" />
        </div>
        <p v-if="secretKeys.length === 0" class="text-caption text-disabled">Henüz secret eklenmedi.</p>

        <v-divider class="my-3" />

        <div class="d-flex ga-2 align-end">
          <v-text-field v-model="newSecretKey" label="Anahtar" density="compact" class="antiphon-mono" hide-details />
          <v-text-field
            v-model="newSecretValue"
            label="Değer"
            type="password"
            density="compact"
            class="antiphon-mono"
            hide-details
          />
          <v-btn color="primary" variant="flat" class="text-none" @click="addSecret">Ekle</v-btn>
        </div>
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
/* <v-theme-provider with-background> çerçevesi: arka planı temanın background rengini alır. */
.antiphon-theme-frame {
  flex: 1 1 0;
  border-radius: 12px;
}
.antiphon-theme-preview {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  padding: 12px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: transparent;
  color: rgb(var(--v-theme-on-background));
  transition: border-color 0.15s ease;
}
.antiphon-theme-preview:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}
.antiphon-theme-preview--active {
  border-color: rgb(var(--v-theme-primary));
}
.antiphon-theme-window {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 10px;
}
.antiphon-theme-line {
  height: 6px;
  border-radius: 3px;
  background: rgba(var(--v-theme-on-surface), 0.22);
  margin-bottom: 5px;
}
.antiphon-theme-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
