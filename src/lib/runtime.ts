// Webview çalışma-zamanı yardımcıları (Faz 8b) — şablon çözümü, auth, yanıt önbelleği.
//
// packages/runtime'daki template-engine + auth + functions + response-cache'in tarayıcı-güvenli
// karşılığı (node:crypto/node:vm YOK). Script motoru artık Rust'ta (rquickjs); bu dosya yalnız
// SAF mantığı (şablon/auth/önbellek) taşır. JWT auth şimdilik ertelendi (Web Crypto async gerekir).

import type { Auth } from '@schema/request'
import type { HttpResponsePayload } from '@shared/ipc-contract'

// ---- UTF-8 base64 (Node Buffer yerine) ----

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// JWT HS256 imzalama (Node createHmac yerine Web Crypto — webview secure context).
export async function signJwtHs256(
  secret: string,
  payload: Record<string, unknown>
): Promise<string> {
  const enc = new TextEncoder()
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = toBase64Url(enc.encode(JSON.stringify(payload)))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return `${data}.${toBase64Url(new Uint8Array(signature))}`
}

// ---- Yanıt önbelleği ({{response(...)}} referansları için) ----

interface CachedResponse {
  payload: HttpResponsePayload
  json: unknown
}

const responseCache = new Map<string, CachedResponse>()

export function cacheResponse(requestName: string, payload: HttpResponsePayload): void {
  let json: unknown
  if (payload.bodyEncoding === 'utf8') {
    try {
      json = JSON.parse(payload.body)
    } catch {
      json = undefined
    }
  }
  responseCache.set(requestName, { payload, json })
}

export function clearResponseCache(): void {
  responseCache.clear()
}

// ---- Şablon fonksiyonları ({{$uuid}} vb.) ----

function uuidv4(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

const templateFunctions: Record<string, () => string> = {
  uuid: () => uuidv4(),
  guid: () => uuidv4(),
  timestamp: () => String(Date.now()),
  isoTimestamp: () => new Date().toISOString(),
  randomInt: () => String(Math.floor(Math.random() * 1000))
}

// ---- Şablon çözümü ----

export interface TemplateContext {
  variables: Record<string, string>
  resolveSecret: (key: string) => string | undefined
}

const TOKEN_PATTERN = /\{\{([^}]+)\}\}/g
const RESPONSE_PATTERN = /^response\(\s*['"]([^'"]+)['"]\s*\)(?:\.(.+))?$/

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

function resolveResponseReference(expression: string): string | undefined {
  const match = RESPONSE_PATTERN.exec(expression)
  if (!match) return undefined
  const [, requestName, accessor] = match
  const cached = responseCache.get(requestName)
  if (!cached) return undefined
  if (!accessor || accessor === 'body') return cached.payload.body
  if (accessor === 'status') return String(cached.payload.status)
  if (accessor.startsWith('json.')) {
    const value = getByPath(cached.json, accessor.slice('json.'.length))
    if (value === undefined) return undefined
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  if (accessor.startsWith('headers.')) {
    return cached.payload.headers[accessor.slice('headers.'.length)]
  }
  return undefined
}

function resolveExpression(expression: string, ctx: TemplateContext): string | undefined {
  if (expression.startsWith('$')) return templateFunctions[expression.slice(1)]?.()
  if (expression.startsWith('secret:'))
    return ctx.resolveSecret(expression.slice('secret:'.length).trim())
  if (expression.startsWith('response(')) return resolveResponseReference(expression)
  return ctx.variables[expression]
}

export function resolveTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(TOKEN_PATTERN, (match, rawExpression: string) => {
    const resolved = resolveExpression(rawExpression.trim(), ctx)
    return resolved !== undefined ? resolved : match
  })
}

export function extractSecretKeys(texts: Array<string | undefined>): string[] {
  const keys = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      const expression = match[1].trim()
      if (expression.startsWith('secret:')) keys.add(expression.slice('secret:'.length).trim())
    }
  }
  return [...keys]
}

// ---- Auth uygulaması ----

export interface AppliedAuth {
  headers: Record<string, string>
  queryParams: Record<string, string>
}

export function resolveAuth(auth: Auth | undefined): AppliedAuth {
  const headers: Record<string, string> = {}
  const queryParams: Record<string, string> = {}
  if (!auth || auth.type === 'none') return { headers, queryParams }

  switch (auth.type) {
    case 'basic':
      headers.Authorization = `Basic ${utf8ToBase64(`${auth.username}:${auth.password}`)}`
      break
    case 'bearer':
      headers.Authorization = `Bearer ${auth.token}`
      break
    case 'apiKey':
      if (auth.in === 'header') headers[auth.key] = auth.value
      else queryParams[auth.key] = auth.value
      break
    // jwt: http-client'ta async imzalanıp bearer'a çevrildiği için burada gelmez.
    default:
      break
  }
  return { headers, queryParams }
}

export function authTexts(auth: Auth | undefined): string[] {
  if (!auth) return []
  switch (auth.type) {
    case 'basic':
      return [auth.username, auth.password]
    case 'bearer':
      return [auth.token]
    case 'apiKey':
      return [auth.key, auth.value]
    case 'jwt':
      return [auth.secret]
    default:
      return []
  }
}

export function resolveAuthTemplate(
  auth: Auth | undefined,
  ctx: TemplateContext
): Auth | undefined {
  if (!auth) return auth
  switch (auth.type) {
    case 'basic':
      return {
        ...auth,
        username: resolveTemplate(auth.username, ctx),
        password: resolveTemplate(auth.password, ctx)
      }
    case 'bearer':
      return { ...auth, token: resolveTemplate(auth.token, ctx) }
    case 'apiKey':
      return {
        ...auth,
        key: resolveTemplate(auth.key, ctx),
        value: resolveTemplate(auth.value, ctx)
      }
    case 'jwt':
      return { ...auth, secret: resolveTemplate(auth.secret, ctx) }
    default:
      return auth
  }
}
