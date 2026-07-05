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
