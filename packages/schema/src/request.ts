import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
export type HttpMethod = z.infer<typeof HttpMethodSchema>

export const KeyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true)
})

export const AuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('basic'), username: z.string(), password: z.string() }),
  z.object({ type: z.literal('bearer'), token: z.string() }),
  z.object({ type: z.literal('apiKey'), key: z.string(), value: z.string(), in: z.enum(['header', 'query']) }),
  z.object({ type: z.literal('jwt'), secret: z.string(), payload: z.record(z.string(), z.unknown()).optional() })
])

export type Auth = z.infer<typeof AuthSchema>

export const BodySchema = z.object({
  mode: z.enum(['none', 'json', 'form', 'multipart', 'binary', 'raw']).default('none'),
  content: z.string().optional()
})

export type Body = z.infer<typeof BodySchema>
export type KeyValue = z.infer<typeof KeyValueSchema>

export const TlsProtocolSchema = z.enum(['SSLv3', 'TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'])
export type TlsProtocol = z.infer<typeof TlsProtocolSchema>

// İstek-bazlı gönderim ayarları (Postman "Settings" sekmesinin karşılığı).
// Dosyada yoksa tüm alanlar varsayılanlarıyla doldurulur — eski dosyalar geçerli kalır.
export const RequestSettingsSchema = z.object({
  /** HTTP sürümü: auto = ALPN ile HTTP/2 dene (proxy/özel TLS yokken), http1 = yalnızca HTTP/1.1. */
  httpVersion: z.enum(['auto', 'http1', 'http2']).default('auto'),
  /** SSL sertifika doğrulaması (kapatılırsa yalnızca bu istek için rejectUnauthorized=false). */
  verifySsl: z.boolean().default(true),
  /** HTTP 3xx yanıtlarını otomatik izle. */
  followRedirects: z.boolean().default(true),
  /** Yönlendirmede orijinal HTTP metodunu koru (kapalıyken GET'e çevrilir). */
  followOriginalMethod: z.boolean().default(false),
  /** Farklı host'a yönlendirmede Authorization başlığını koru. */
  keepAuthorizationOnRedirect: z.boolean().default(false),
  /** Yönlendirme olduğunda referer başlığını kaldır. */
  removeRefererOnRedirect: z.boolean().default(false),
  /** Katı HTTP ayrıştırıcı: geçersiz HTTP başlıklı yanıtları reddet. */
  strictHttpParser: z.boolean().default(true),
  /** URL yolu ve sorgu parametrelerini otomatik yüzde-kodla. */
  encodeUrl: z.boolean().default(true),
  /** Bu istek için çerez kavanozunu devre dışı bırak. */
  disableCookieJar: z.boolean().default(false),
  /** El sıkışmada istemci yerine sunucunun şifre takımı sırasını kullan. */
  useServerCipherOrder: z.boolean().default(false),
  /** İzlenecek en fazla yönlendirme sayısı. */
  maxRedirects: z.number().int().min(0).max(50).default(10),
  /** El sıkışma sırasında devre dışı bırakılacak TLS/SSL protokolleri. */
  disabledTlsProtocols: z.array(TlsProtocolSchema).default([]),
  /** Şifre takımı seçimi (virgül/boşluk ayrımlı); boş = sistem varsayılanı. */
  cipherSuites: z.string().default(''),
  /** İstek zaman aşımı (ms); 0 = sınırsız. */
  timeoutMs: z.number().int().min(0).default(0)
})

export type RequestSettings = z.infer<typeof RequestSettingsSchema>
export const defaultRequestSettings = (): RequestSettings => RequestSettingsSchema.parse({})

// Bir `.req.yaml` dosyasının tam şeması — request-başına-dosya modeli (bkz. rapor §6).
export const RequestFileSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  name: z.string(),
  method: HttpMethodSchema,
  url: z.string(),
  params: z.array(KeyValueSchema).default([]),
  headers: z.array(KeyValueSchema).default([]),
  auth: AuthSchema.default({ type: 'none' }),
  body: BodySchema.default({ mode: 'none' }),
  settings: RequestSettingsSchema.optional(),
  preRequestScript: z.string().optional(),
  testScript: z.string().optional(),
  docs: z.string().optional()
})

export type RequestFile = z.infer<typeof RequestFileSchema>

export const EnvironmentFileSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  name: z.string(),
  variables: z.record(z.string(), z.string()).default({})
})

export type EnvironmentFile = z.infer<typeof EnvironmentFileSchema>

export const CollectionMetaSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  name: z.string(),
  description: z.string().optional()
})

export type CollectionMeta = z.infer<typeof CollectionMetaSchema>

// Klasör/koleksiyon düzeyinde miras alınabilen ayarlar (Yaak paritesi — bkz. rapor §5).
// Koleksiyon = üst düzey klasör; description/variables/scriptler koleksiyon editöründe düzenlenir.
export const FolderMetaSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  description: z.string().optional(),
  auth: AuthSchema.optional(),
  headers: z.array(KeyValueSchema).default([]),
  variables: z.array(KeyValueSchema).default([]),
  preRequestScript: z.string().optional(),
  testScript: z.string().optional()
})

export type FolderMeta = z.infer<typeof FolderMetaSchema>
// Yazma tarafı: default'lu alanlar (headers/variables) çağrıda opsiyoneldir, parse sırasında dolar.
export type FolderMetaInput = z.input<typeof FolderMetaSchema>
