// HTTP istek istemcisi — Rust `http_send` komutunu çağırır (tam pipeline).
//
// İş bölümü: pre-request/test script (Rust rquickjs sandbox), şablon/{{secret}} çözümü ve
// auth/gövde hazırlığı burada (JS, saf mantık); ağ I/O'su Rust'ta (reqwest).

import type { HttpRequestPayload, HttpResponsePayload, NetworkInfoDto } from '@shared/ipc-contract'
import type { TemplateContext } from './runtime'
import { invoke } from '@tauri-apps/api/core'
import {
  authTexts,
  cacheResponse,
  extractSecretKeys,
  resolveAuth,
  resolveAuthTemplate,
  resolveTemplate,
  signJwtHs256,
  utf8ToBase64
} from './runtime'
import { runPreRequestScript, runTestScript } from './script-client'
import { getSecret, resolveNetwork } from './settings-client'
import { resolveInheritedSettings } from './workspace-client'

interface HeaderPair {
  key: string
  value: string
}

interface HttpSendResponse {
  status: number
  statusText: string
  headers: HeaderPair[]
  bodyBase64: string
  sizeBytes: number
  ttfbMs: number
  downloadMs: number
  totalMs: number
  httpVersion: string
  remoteAddress?: string | null
}

const TEXT_CONTENT_TYPE = /json|text|xml|html|javascript/

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
}

// Aday metinlerdeki {{secret:...}} anahtarlarını vault'tan çözer (asenkron ön-getirme).
async function buildTemplateContext(
  variables: Record<string, string>,
  candidateTexts: Array<string | undefined>
): Promise<TemplateContext> {
  const secretKeys = extractSecretKeys(candidateTexts)
  const entries = await Promise.all(
    secretKeys.map(async (key) => [key, await getSecret(key)] as const)
  )
  const secrets = Object.fromEntries(entries)
  return { variables, resolveSecret: (key) => secrets[key] }
}

export async function sendHttpRequest(payload: HttpRequestPayload): Promise<HttpResponsePayload> {
  // prepare: hazırlık (miras/script/şablon/auth, http_send'den ÖNCE); process: yanıt işleme
  // (gövde çözümleme + test script, http_send'den SONRA) — ikisi de webview'da duvar saatiyle.
  const startedAt = Date.now()

  const inherited =
    payload.requestPath && payload.workspaceRoot
      ? await resolveInheritedSettings(payload.requestPath, payload.workspaceRoot)
      : { headers: [], auth: undefined }

  // Pre-request script (şablon çözümünden ÖNCE): değişkenleri ve istek alanlarını değiştirebilir.
  const preRequest = await runPreRequestScript(
    payload.preRequestScript ?? '',
    payload.environmentVariables ?? {},
    {
      method: payload.method,
      url: payload.url,
      headers: [...inherited.headers, ...payload.headers],
      params: payload.params,
      body: payload.body
    }
  )

  const effectiveHeaders = preRequest.request.headers
  const effectiveAuthBase =
    payload.auth && payload.auth.type !== 'none' ? payload.auth : inherited.auth

  const ctx = await buildTemplateContext(preRequest.variables, [
    preRequest.request.url,
    preRequest.request.body?.content,
    ...effectiveHeaders.map((h) => h.value),
    ...preRequest.request.params.map((p) => p.value),
    ...authTexts(effectiveAuthBase)
  ])

  const url = new URL(resolveTemplate(preRequest.request.url, ctx))
  for (const param of preRequest.request.params) {
    if (param.enabled && param.key)
      url.searchParams.set(param.key, resolveTemplate(param.value, ctx))
  }

  const headers: Record<string, string> = {}
  for (const header of effectiveHeaders) {
    if (header.enabled && header.key) headers[header.key] = resolveTemplate(header.value, ctx)
  }

  let effectiveAuth = resolveAuthTemplate(effectiveAuthBase, ctx)
  // JWT: HS256 imzası async (Web Crypto) → bearer token'a çevir, sonra normal uygula.
  if (effectiveAuth?.type === 'jwt') {
    const token = await signJwtHs256(effectiveAuth.secret, effectiveAuth.payload ?? {})
    effectiveAuth = { type: 'bearer', token }
  }
  const applied = resolveAuth(effectiveAuth)
  Object.assign(headers, applied.headers)
  for (const [key, value] of Object.entries(applied.queryParams)) url.searchParams.set(key, value)

  const hasContentType = () => Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')
  const bodyMode = preRequest.request.body?.mode ?? 'none'
  const rawBody = preRequest.request.body?.content ?? ''
  let bodyBase64: string | undefined
  if (bodyMode === 'json' || bodyMode === 'raw') {
    bodyBase64 = utf8ToBase64(resolveTemplate(rawBody, ctx))
    if (bodyMode === 'json' && !hasContentType()) headers['Content-Type'] = 'application/json'
  } else if (bodyMode === 'form') {
    bodyBase64 = utf8ToBase64(resolveTemplate(rawBody, ctx))
    if (!hasContentType()) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (bodyMode === 'multipart') {
    // Gerçek multipart/form-data: content urlencoded çiftlerinden alan bloklarına çevrilir.
    const boundary = `----antiphon${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    let body = ''
    for (const [key, value] of new URLSearchParams(resolveTemplate(rawBody, ctx))) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
    }
    body += `--${boundary}--\r\n`
    bodyBase64 = utf8ToBase64(body)
    if (!hasContentType()) headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`
  } else if (bodyMode === 'binary' && rawBody) {
    // İkili gövde: content bir dosya yolu; Rust base64 olarak okur.
    bodyBase64 = await invoke<string>('fs_read_base64', { path: rawBody })
    if (!hasContentType()) headers['Content-Type'] = 'application/octet-stream'
  }

  const settings = payload.settings
  const requestHeaders: HeaderPair[] = Object.entries(headers).map(([key, value]) => ({
    key,
    value
  }))

  // Ağ ayarları (global + workspace override): proxy/CA/istemci-sertifikası/çerez kavanozu.
  const net = await resolveNetwork(url.hostname, payload.workspaceRoot)

  const prepareMs = Date.now() - startedAt
  const response = await invoke<HttpSendResponse>('http_send', {
    req: {
      method: preRequest.request.method,
      url: url.toString(),
      headers: requestHeaders,
      bodyBase64,
      timeoutMs: settings?.timeoutMs && settings.timeoutMs > 0 ? settings.timeoutMs : undefined,
      followRedirects: settings?.followRedirects ?? true,
      maxRedirects: settings?.maxRedirects ?? 10,
      // İstek-bazlı verifySsl=false ağ ayarının üzerine yazar (yalnız bu istek).
      verifySsl: (settings?.verifySsl ?? true) && net.verifySsl,
      proxyUrl: net.proxyUrl,
      caPem: net.caPem,
      clientCertPem: net.clientCertPem,
      clientKeyPem: net.clientKeyPem,
      cookieJar: net.cookieJar && !(settings?.disableCookieJar ?? false),
      httpVersion: settings?.httpVersion
    }
  })

  const networkDoneAt = Date.now()
  const responseHeaders: Record<string, string> = {}
  for (const header of response.headers) responseHeaders[header.key] = header.value

  const contentType = responseHeaders['content-type'] ?? ''
  const isText = TEXT_CONTENT_TYPE.test(contentType)
  const bytes = base64ToBytes(response.bodyBase64)
  const body = isText ? new TextDecoder().decode(bytes) : response.bodyBase64

  const network: NetworkInfoDto = {
    httpVersion: response.httpVersion,
    remoteAddress: response.remoteAddress ?? undefined
  }

  const requestHeaderBytes = requestHeaders.reduce(
    (sum, h) => sum + h.key.length + h.value.length + 4,
    0
  )
  const requestBodyBytes = bodyBase64 ? base64ToBytes(bodyBase64).byteLength : 0

  // Test script (yanıt sonrası): pm.test/pm.expect ile doğrulamalar.
  const testRun = await runTestScript(payload.testScript ?? '', preRequest.variables, {
    status: response.status,
    headers: responseHeaders,
    body: isText ? body : ''
  })

  const result: HttpResponsePayload = {
    requestId: payload.id,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body,
    bodyEncoding: isText ? 'utf8' : 'base64',
    // dns/tcp/tls/socketInit: reqwest ayrı vermez (0). ttfb DNS+TCP+TLS+istek+ilk-baytı içerir.
    timing: {
      prepare: prepareMs,
      socketInit: 0,
      dns: 0,
      tcp: 0,
      tls: 0,
      ttfb: response.ttfbMs,
      download: response.downloadMs,
      process: Date.now() - networkDoneAt,
      total: prepareMs + response.totalMs + (Date.now() - networkDoneAt)
    },
    sizeBytes: response.sizeBytes,
    testResults: testRun.tests,
    requestSize: { headers: requestHeaderBytes, body: requestBodyBytes },
    network
  }

  cacheResponse(payload.name, result)
  return result
}
