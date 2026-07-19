<script setup lang="ts">
import type {
  CookieSummaryDto,
  NetworkSettingsDto,
  WorkspaceSettingsOverrideDto
} from '@shared/ipc-contract'
import { nanoid } from 'nanoid'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/i18n'
import { ipc } from '@/lib/ipc'
import { useGitIdentityStore } from '../stores/git-identity'
import { useUiStore } from '../stores/ui'
import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUiStore()
const gitIdentityStore = useGitIdentityStore()
const workspaceStore = useWorkspaceStore()

// Tema tercihleri — her biri <v-theme-provider> ile önizlenir. 'system' OS'i canlı takip eder
// ve efektif temayı (uiStore.themeName) önizler.
const themeOptions = computed(() => [
  {
    value: 'antiphonLight' as const,
    label: t('settings.light'),
    icon: 'mdi-white-balance-sunny',
    previewTheme: 'antiphonLight' as const
  },
  {
    value: 'antiphonDark' as const,
    label: t('settings.dark'),
    icon: 'mdi-weather-night',
    previewTheme: 'antiphonDark' as const
  },
  {
    value: 'system' as const,
    label: t('settings.system'),
    icon: 'mdi-monitor',
    previewTheme: uiStore.themeName
  }
])

// Kontrast tercihi (açık/koyu'dan bağımsız) — WCAG yüksek kontrast erişilebilirliği.
const contrastOptions = computed(() => [
  { value: 'normal' as const, label: t('settings.contrastNormal') },
  { value: 'high' as const, label: t('settings.contrastHigh') },
  { value: 'system' as const, label: t('settings.system') }
])

// Sağdaki dikey sekmelerle seçilen ayar bölümü — içerik solda gösterilir.
type SettingsSection = 'appearance' | 'git' | 'workspace' | 'network' | 'secrets'
const section = ref<SettingsSection>('appearance')

const secretKeys = ref<string[]>([])
const newSecretKey = ref('')
const newSecretValue = ref('')
const secretPlaceholderExample = '{{secret:AD}}'

async function refreshSecrets() {
  secretKeys.value = await ipc.listSecretKeys()
}

async function addSecret() {
  if (!newSecretKey.value.trim()) return
  await ipc.setSecret(newSecretKey.value.trim(), newSecretValue.value)
  newSecretKey.value = ''
  newSecretValue.value = ''
  await refreshSecrets()
}

async function removeSecret(key: string) {
  await ipc.deleteSecret(key)
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
  networkSettings.value = await ipc.getNetworkSettings()
}

async function saveNetworkSettings() {
  await ipc.setNetworkSettings(networkSettings.value)
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
  networkSettings.value.clientCertificates = networkSettings.value.clientCertificates.filter(
    (c) => c.id !== id
  )
}

async function refreshCookies() {
  cookies.value = await ipc.listCookies()
}

async function clearAllCookies() {
  await ipc.clearCookies()
  await refreshCookies()
}

const workspaceOverride = ref<WorkspaceSettingsOverrideDto>({})
const overrideNetworkEnabled = ref(false)
const overrideGitIdentityEnabled = ref(false)

async function refreshWorkspaceOverride() {
  if (!workspaceStore.rootPath) return
  workspaceOverride.value = await ipc.getWorkspaceSettingsOverride(workspaceStore.rootPath)
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
    networkSettings: overrideNetworkEnabled.value
      ? workspaceOverride.value.networkSettings
      : undefined,
    gitIdentity: overrideGitIdentityEnabled.value ? workspaceOverride.value.gitIdentity : undefined
  }
  await ipc.setWorkspaceSettingsOverride(workspaceStore.rootPath, payload)
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
  <!-- Kabuk (app bar + sol gezinme) App.vue'da; sayfa başlığı içerikte yer alır. -->
  <v-container fluid class="pa-6">
    <div class="d-flex align-center ga-2 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" @click="router.push('/')" />
      <h1 class="text-h5 font-weight-bold">{{ t('settings.title') }}</h1>
    </div>

    <!-- Solda seçili bölümün içeriği, sağda dikey bölüm sekmeleri -->
    <div class="d-flex ga-6 align-start">
      <div class="flex-grow-1" style="min-width: 0">
        <template v-if="section === 'appearance'">
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
                  :class="{
                    'antiphon-theme-preview--active': uiStore.themePreference === opt.value
                  }"
                  @click="uiStore.setThemePreference(opt.value)"
                >
                  <div class="d-flex align-center ga-2 mb-2">
                    <v-icon :icon="opt.icon" size="16" />
                    <span class="text-caption font-weight-bold">{{ opt.label }}</span>
                    <v-spacer />
                    <v-icon
                      v-if="uiStore.themePreference === opt.value"
                      icon="mdi-check-circle"
                      size="16"
                      color="primary"
                    />
                  </div>
                  <div class="antiphon-theme-window">
                    <div class="d-flex ga-1 mb-2">
                      <v-chip size="x-small" color="primary" variant="flat">primary</v-chip>
                      <v-chip size="x-small" color="secondary" variant="tonal">accent</v-chip>
                    </div>
                    <div class="antiphon-theme-line" style="width: 82%" />
                    <div class="antiphon-theme-line" style="width: 56%" />
                    <div class="d-flex ga-1 mt-2">
                      <span
                        class="antiphon-theme-dot"
                        style="background: rgb(var(--v-theme-method-get))"
                      />
                      <span
                        class="antiphon-theme-dot"
                        style="background: rgb(var(--v-theme-method-post))"
                      />
                      <span
                        class="antiphon-theme-dot"
                        style="background: rgb(var(--v-theme-method-put))"
                      />
                      <span
                        class="antiphon-theme-dot"
                        style="background: rgb(var(--v-theme-method-delete))"
                      />
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
                <p class="text-caption text-medium-emphasis mb-0">
                  {{ t('settings.contrastHint') }}
                </p>
              </div>
              <v-btn-toggle
                :model-value="uiStore.contrastPreference"
                mandatory
                color="primary"
                density="comfortable"
                @update:model-value="uiStore.setContrastPreference($event)"
              >
                <v-btn v-for="opt in contrastOptions" :key="opt.value" :value="opt.value">{{
                  opt.label
                }}</v-btn>
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
                @update:model-value="uiStore.setLocale($event)"
              >
                <v-btn value="tr">TR</v-btn>
                <v-btn value="en">EN</v-btn>
              </v-btn-toggle>
            </div>
          </v-card>
        </template>

        <template v-else-if="section === 'git'">
          <v-card variant="tonal" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-2">Git Kimliği</div>
            <p class="text-caption text-medium-emphasis mb-3">
              Commit'lerde yazar bilgisi olarak kullanılır.
            </p>
            <div class="d-flex ga-2">
              <v-text-field
                v-model="gitIdentityStore.name"
                label="Ad Soyad"
                placeholder="Ayşe Yılmaz"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model="gitIdentityStore.email"
                label="E-posta"
                placeholder="ayse@example.com"
                density="compact"
                hide-details
              />
            </div>
          </v-card>
        </template>

        <template v-else-if="section === 'workspace'">
          <v-card v-if="workspaceStore.isOpen" variant="tonal" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-2">Bu Çalışma Alanı İçin Override</div>
            <p class="text-caption text-medium-emphasis mb-3">
              Sadece açık olan bu workspace'te geçerli olur;
              <span class="antiphon-mono">.antiphon/settings.json</span> içine yazılır.
            </p>

            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-2">Git Kimliğini Override Et</span>
              <v-switch
                v-model="overrideGitIdentityEnabled"
                density="compact"
                hide-details
                color="primary"
              />
            </div>
            <div
              v-if="overrideGitIdentityEnabled && workspaceOverride.gitIdentity"
              class="d-flex ga-2 mb-3"
            >
              <v-text-field
                v-model="workspaceOverride.gitIdentity.name"
                label="Ad Soyad"
                placeholder="Ayşe Yılmaz"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model="workspaceOverride.gitIdentity.email"
                label="E-posta"
                placeholder="ayse@example.com"
                density="compact"
                hide-details
              />
            </div>

            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-2">Ağ Ayarlarını Override Et</span>
              <v-switch
                v-model="overrideNetworkEnabled"
                density="compact"
                hide-details
                color="primary"
              />
            </div>
            <template v-if="overrideNetworkEnabled && workspaceOverride.networkSettings">
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-body-2">Proxy</span>
                <v-switch
                  v-model="workspaceOverride.networkSettings.proxyEnabled"
                  density="compact"
                  hide-details
                  color="primary"
                />
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
                <v-switch
                  v-model="workspaceOverride.networkSettings.cookieJarEnabled"
                  density="compact"
                  hide-details
                  color="primary"
                />
              </div>
            </template>

            <v-btn color="primary" variant="flat" class="text-none" @click="saveWorkspaceOverride"
              >Workspace Override'ı Kaydet</v-btn
            >
          </v-card>
        </template>

        <template v-else-if="section === 'network'">
          <v-card variant="tonal" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-2">Ağ Ayarları</div>
            <p class="text-caption text-medium-emphasis mb-3">
              Proxy, özel CA, mTLS istemci sertifikası ve çerez (cookie) yönetimi.
            </p>

            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-2">Proxy</span>
              <v-switch
                v-model="networkSettings.proxyEnabled"
                density="compact"
                hide-details
                color="primary"
              />
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
              placeholder="-----BEGIN CERTIFICATE-----"
              rows="3"
              density="compact"
              class="antiphon-mono mb-3"
              hide-details
            />

            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">mTLS İstemci Sertifikaları (host-bazlı)</span>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-plus"
                class="text-none"
                @click="addClientCertificate"
                >Ekle</v-btn
              >
            </div>
            <v-card
              v-for="cert in networkSettings.clientCertificates"
              :key="cert.id"
              variant="tonal"
              class="pa-3 mb-3"
            >
              <div class="d-flex align-center ga-2 mb-2">
                <v-text-field
                  v-model="cert.hostPattern"
                  label="Host deseni (ör. *.example.com)"
                  placeholder="*.example.com"
                  density="compact"
                  class="antiphon-mono"
                  hide-details
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  color="error"
                  @click="removeClientCertificate(cert.id)"
                />
              </div>
              <div class="d-flex ga-2 mb-2">
                <v-textarea
                  v-model="cert.certPem"
                  label="İstemci Sertifikası (PEM)"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  rows="3"
                  density="compact"
                  class="antiphon-mono"
                  hide-details
                />
                <v-textarea
                  v-model="cert.keyPem"
                  label="İstemci Anahtarı (PEM)"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  rows="3"
                  density="compact"
                  class="antiphon-mono"
                  hide-details
                />
              </div>
              <v-text-field
                v-model="cert.passphrase"
                label="Anahtar Parolası (opsiyonel)"
                type="password"
                placeholder="••••••••"
                density="compact"
                hide-details
              />
            </v-card>
            <p
              v-if="networkSettings.clientCertificates.length === 0"
              class="text-caption text-disabled mb-3"
            >
              Henüz istemci sertifikası eklenmedi.
            </p>

            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-2">Sertifika Doğrulamasını Zorla (rejectUnauthorized)</span>
              <v-switch
                v-model="networkSettings.rejectUnauthorized"
                density="compact"
                hide-details
                color="primary"
              />
            </div>
            <div class="d-flex align-center justify-space-between mb-3">
              <span class="text-body-2">Çerez Kavanozu (Cookie Jar)</span>
              <v-switch
                v-model="networkSettings.cookieJarEnabled"
                density="compact"
                hide-details
                color="primary"
              />
            </div>

            <v-btn
              color="primary"
              variant="flat"
              class="text-none mb-4"
              @click="saveNetworkSettings"
              >Ağ Ayarlarını Kaydet</v-btn
            >

            <v-divider class="mb-3" />
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">Çerezler ({{ cookies.length }})</span>
              <div>
                <v-btn size="small" variant="text" class="text-none" @click="refreshCookies"
                  >Yenile</v-btn
                >
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  class="text-none"
                  @click="clearAllCookies"
                  >Tümünü Temizle</v-btn
                >
              </div>
            </div>
            <div
              v-for="cookie in cookies"
              :key="`${cookie.domain}-${cookie.key}`"
              class="text-caption antiphon-mono py-1"
            >
              <span class="text-medium-emphasis">{{ cookie.domain }}</span> {{ cookie.key }}={{
                cookie.value
              }}
            </div>
            <p v-if="cookies.length === 0" class="text-caption text-disabled">Henüz çerez yok.</p>
          </v-card>
        </template>

        <template v-else-if="section === 'secrets'">
          <v-card variant="tonal" class="pa-4">
            <div class="text-subtitle-2 mb-2">Secret Vault</div>
            <p class="text-caption text-medium-emphasis mb-3">
              Bu değerler OS anahtarlığı (keychain) üzerinden şifrelenir; dosyalarda yalnızca
              <code class="antiphon-mono">{{ secretPlaceholderExample }}</code> referansı tutulur.
            </p>

            <div
              v-for="key in secretKeys"
              :key="key"
              class="d-flex align-center justify-space-between py-1"
            >
              <span class="antiphon-mono text-body-2">{{ key }}</span>
              <v-btn
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                color="error"
                @click="removeSecret(key)"
              />
            </div>
            <p v-if="secretKeys.length === 0" class="text-caption text-disabled">
              Henüz secret eklenmedi.
            </p>

            <v-divider class="my-3" />

            <div class="d-flex ga-2 align-end">
              <v-text-field
                v-model="newSecretKey"
                label="Anahtar"
                placeholder="API_TOKEN"
                density="compact"
                class="antiphon-mono"
                hide-details
              />
              <v-text-field
                v-model="newSecretValue"
                label="Değer"
                type="password"
                placeholder="gizli-deger"
                density="compact"
                class="antiphon-mono"
                hide-details
              />
              <v-btn color="primary" variant="flat" class="text-none" @click="addSecret"
                >Ekle</v-btn
              >
            </div>
          </v-card>
        </template>
      </div>

      <!-- Sağda dikey bölüm sekmeleri -->
      <v-tabs
        v-model="section"
        direction="vertical"
        color="primary"
        class="antiphon-settings-tabs flex-shrink-0"
      >
        <v-tab value="appearance" prepend-icon="mdi-palette-outline" class="text-none justify-start"
          >Görünüm</v-tab
        >
        <v-tab value="git" prepend-icon="mdi-source-branch" class="text-none justify-start"
          >Git Kimliği</v-tab
        >
        <v-tab
          v-if="workspaceStore.isOpen"
          value="workspace"
          prepend-icon="mdi-briefcase-outline"
          class="text-none justify-start"
          >Çalışma Alanı</v-tab
        >
        <v-tab value="network" prepend-icon="mdi-lan" class="text-none justify-start"
          >Ağ Ayarları</v-tab
        >
        <v-tab value="secrets" prepend-icon="mdi-key-outline" class="text-none justify-start"
          >Secret Vault</v-tab
        >
      </v-tabs>
    </div>
  </v-container>
</template>

<style scoped>
/* Sağdaki dikey bölüm sekmeleri: sayfa kaydırılsa da görünür kalır (sticky). */
.antiphon-settings-tabs {
  min-width: 200px;
  position: sticky;
  top: 76px;
}

/* <v-theme-provider with-background> çerçevesi: arka planı temanın background rengini alır. */
.antiphon-theme-frame {
  flex: 1 1 0;
  border-radius: 12px;
}
/* MD3: seçim çerçeveyle değil tonal dolgu + check ikonu ile gösterilir. */
.antiphon-theme-preview {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  padding: 12px;
  border-radius: 12px;
  background: transparent;
  color: rgb(var(--v-theme-on-background));
  transition: background-color 0.15s ease;
}
.antiphon-theme-preview:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
.antiphon-theme-preview--active {
  background: rgba(var(--v-theme-primary), 0.14);
}
/* Mini pencere mockup'ı çerçeve yerine hafif elevation gölgesiyle ayrılır. */
.antiphon-theme-window {
  background: rgb(var(--v-theme-surface));
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
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
