<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/i18n'
import KeyValueEditor from './KeyValueEditor.vue'
import BodyEditor from './BodyEditor.vue'
import AuthPanel from './AuthPanel.vue'
import DocsEditor from './DocsEditor.vue'
import CodeMirrorEditor from '../common/CodeMirrorEditor.vue'
import type { RequestTab } from '../../stores/tabs'

const tab = defineModel<RequestTab>({ required: true })
const { t } = useI18n()
const activeSection = ref('params')
// Scripts bölümündeki dikey mini-nav: Pre-request / Post-response
const activeScript = ref<'pre' | 'post'>('pre')

// Ayarlar sekmesi seçenek listeleri
const httpVersionOptions = [
  { title: 'Otomatik', value: 'auto' },
  { title: 'HTTP/1.1', value: 'http1' },
  { title: 'HTTP/2', value: 'http2' }
]
const tlsProtocolOptions = ['SSLv3', 'TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']

// Sekme başlığındaki satır sayısı: yalnızca anahtarı dolu satırlar sayılır (sondaki boş satır hariç).
const filledCount = (rows: { key: string }[]) => rows.filter((row) => row.key.trim() !== '').length
const paramsCount = computed(() => filledCount(tab.value.params))
const headersCount = computed(() => filledCount(tab.value.headers))
</script>

<template>
  <div class="d-flex flex-column h-100">
    <v-tabs v-model="activeSection" density="compact">
      <v-tab value="params">
        {{ t('request.tabs.params') }}
        <span v-if="paramsCount" class="antiphon-tab-count">{{ paramsCount }}</span>
      </v-tab>
      <v-tab value="headers">
        {{ t('request.tabs.headers') }}
        <span v-if="headersCount" class="antiphon-tab-count">{{ headersCount }}</span>
      </v-tab>
      <v-tab value="body">{{ t('request.tabs.body') }}</v-tab>
      <v-tab value="auth">{{ t('request.tabs.auth') }}</v-tab>
      <v-tab value="scripts">{{ t('request.tabs.scripts') }}</v-tab>
      <v-tab value="docs">{{ t('request.tabs.docs') }}</v-tab>
      <v-tab value="settings">{{ t('request.tabs.settings') }}</v-tab>
    </v-tabs>
    <v-window v-model="activeSection" class="flex-grow-1 overflow-y-auto antiphon-request-window">
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
      <!-- Scripts: solda dikey nav, sağda seçili script'in tam yükseklik editörü (Postman düzeni) -->
      <v-window-item value="scripts" class="h-100">
        <div class="d-flex h-100">
          <div class="antiphon-script-nav flex-shrink-0 bg-surface-light h-100">
            <v-list density="compact" bg-color="transparent" class="py-1">
              <v-list-item :active="activeScript === 'pre'" rounded="lg" class="mx-1" @click="activeScript = 'pre'">
                <v-list-item-title class="text-body-2">Pre-request</v-list-item-title>
              </v-list-item>
              <v-list-item :active="activeScript === 'post'" rounded="lg" class="mx-1" @click="activeScript = 'post'">
                <v-list-item-title class="text-body-2">Post-response</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
          <div class="flex-grow-1 overflow-hidden">
            <CodeMirrorEditor
              v-if="activeScript === 'pre'"
              v-model="tab.preRequestScript"
              language="javascript"
              placeholder="İstek gönderilmeden önce çalışır — ör. pm.environment.set('token', 'abc')"
              class="h-100"
            />
            <CodeMirrorEditor
              v-else
              v-model="tab.testScript"
              language="javascript"
              placeholder="Yanıt geldikten sonra çalışır — ör. pm.test('durum 200', () => pm.expect(pm.response.code).to.equal(200))"
              class="h-100"
            />
          </div>
        </div>
      </v-window-item>
      <v-window-item value="docs" class="h-100">
        <DocsEditor v-model="tab.docs" />
      </v-window-item>

      <!-- İstek-bazlı gönderim ayarları (Postman "Settings" düzeni: solda açıklama, sağda kontrol) -->
      <v-window-item value="settings" class="pa-4">
        <div class="d-flex flex-column ga-4" style="max-width: 820px">
          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">HTTP sürümü</div>
              <p class="text-caption text-medium-emphasis mb-0">
                İsteği göndermek için kullanılacak HTTP sürümü. Otomatik, ALPN ile HTTP/2 dener (proxy/özel TLS yokken).
              </p>
            </div>
            <v-select
              v-model="tab.settings.httpVersion"
              :items="httpVersionOptions"
              density="compact"
              hide-details
              class="flex-shrink-0"
              style="max-width: 140px"
            />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">SSL sertifika doğrulaması</div>
              <p class="text-caption text-medium-emphasis mb-0">
                İstek gönderilirken SSL sertifikaları doğrulanır; doğrulama hatası isteği iptal eder.
              </p>
            </div>
            <v-switch v-model="tab.settings.verifySsl" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Yönlendirmeleri otomatik izle</div>
              <p class="text-caption text-medium-emphasis mb-0">HTTP 3xx yanıtları yönlendirme olarak izlenir.</p>
            </div>
            <v-switch v-model="tab.settings.followRedirects" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Orijinal HTTP metoduyla yönlendir</div>
              <p class="text-caption text-medium-emphasis mb-0">
                Yönlendirmede GET'e çevirmek yerine isteğin orijinal HTTP metodu korunur.
              </p>
            </div>
            <v-switch
              v-model="tab.settings.followOriginalMethod"
              density="compact"
              hide-details
              color="primary"
              :disabled="!tab.settings.followRedirects"
              class="flex-shrink-0"
            />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Authorization başlığını koru</div>
              <p class="text-caption text-medium-emphasis mb-0">
                Farklı bir host'a yönlendirme olduğunda Authorization başlığı korunur.
              </p>
            </div>
            <v-switch
              v-model="tab.settings.keepAuthorizationOnRedirect"
              density="compact"
              hide-details
              color="primary"
              :disabled="!tab.settings.followRedirects"
              class="flex-shrink-0"
            />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Yönlendirmede referer başlığını kaldır</div>
              <p class="text-caption text-medium-emphasis mb-0">Bir yönlendirme olduğunda referer başlığı kaldırılır.</p>
            </div>
            <v-switch
              v-model="tab.settings.removeRefererOnRedirect"
              density="compact"
              hide-details
              color="primary"
              :disabled="!tab.settings.followRedirects"
              class="flex-shrink-0"
            />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Katı HTTP ayrıştırıcı</div>
              <p class="text-caption text-medium-emphasis mb-0">Geçersiz HTTP başlıkları içeren yanıtları reddet.</p>
            </div>
            <v-switch v-model="tab.settings.strictHttpParser" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">URL'yi otomatik kodla</div>
              <p class="text-caption text-medium-emphasis mb-0">
                URL'nin yolu ve sorgu parametreleri otomatik olarak yüzde-kodlanır.
              </p>
            </div>
            <v-switch v-model="tab.settings.encodeUrl" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Çerez kavanozunu devre dışı bırak</div>
              <p class="text-caption text-medium-emphasis mb-0">
                Bu isteğin çerezleri kavanoza yazılmaz ve kavanozdaki çerezler bu isteğe eklenmez.
              </p>
            </div>
            <v-switch v-model="tab.settings.disableCookieJar" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">El sıkışmada sunucu şifre takımı sırası</div>
              <p class="text-caption text-medium-emphasis mb-0">
                El sıkışma sırasında istemcinin yerine sunucunun şifre takımı sırası kullanılır.
              </p>
            </div>
            <v-switch v-model="tab.settings.useServerCipherOrder" density="compact" hide-details color="primary" class="flex-shrink-0" />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">En fazla yönlendirme sayısı</div>
              <p class="text-caption text-medium-emphasis mb-0">İzlenecek yönlendirme sayısına üst sınır koyar.</p>
            </div>
            <v-text-field
              v-model.number="tab.settings.maxRedirects"
              type="number"
              min="0"
              max="50"
              density="compact"
              hide-details
              :disabled="!tab.settings.followRedirects"
              class="flex-shrink-0"
              style="max-width: 96px"
            />
          </div>

          <div class="d-flex align-center justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Zaman aşımı (ms)</div>
              <p class="text-caption text-medium-emphasis mb-0">İsteğin toplam süresine üst sınır; 0 = sınırsız.</p>
            </div>
            <v-text-field
              v-model.number="tab.settings.timeoutMs"
              type="number"
              min="0"
              placeholder="0"
              density="compact"
              hide-details
              class="flex-shrink-0"
              style="max-width: 120px"
            />
          </div>

          <div class="d-flex align-start justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">El sıkışmada devre dışı TLS/SSL protokolleri</div>
              <p class="text-caption text-medium-emphasis mb-0">
                Seçilen protokol sürümleri el sıkışma sırasında devre dışı bırakılır; diğerleri etkin kalır.
              </p>
            </div>
            <v-select
              v-model="tab.settings.disabledTlsProtocols"
              :items="tlsProtocolOptions"
              multiple
              chips
              closable-chips
              density="compact"
              hide-details
              placeholder="Yok"
              class="flex-shrink-0"
              style="max-width: 280px"
            />
          </div>

          <div class="d-flex align-start justify-space-between ga-4">
            <div>
              <div class="text-subtitle-2">Şifre takımı seçimi</div>
              <p class="text-caption text-medium-emphasis mb-0">
                Güvenli bağlantı kurarken kullanılacak şifre takımları (virgül veya boşlukla ayırın); boş = sistem varsayılanı.
              </p>
            </div>
            <v-textarea
              v-model="tab.settings.cipherSuites"
              rows="2"
              density="compact"
              hide-details
              placeholder="ECDHE-RSA-AES128-GCM-SHA256, TLS_AES_256_GCM_SHA384…"
              class="antiphon-mono flex-shrink-0"
              style="max-width: 320px; width: 320px"
            />
          </div>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped>
.antiphon-script-nav {
  width: 150px;
}
/* v-window'un iç konteyneri yüksekliği iletmez; tam yükseklik isteyen
   bölümler (Scripts, Gövde, Dokümantasyon) için zorla. */
.antiphon-request-window :deep(.v-window__container),
.antiphon-request-window :deep(.v-window-item) {
  height: 100%;
}
</style>
