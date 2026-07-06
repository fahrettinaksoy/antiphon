import type { Response as GotResponse } from 'got'
import type { HttpRequestPayload, HttpResponsePayload } from '@shared/ipc-contract'
import type { Auth, RequestSettings, TlsProtocol } from '@schema/request'
import {
  resolveAuth,
  resolveTemplate,
  extractSecretKeys,
  cacheResponse,
  runPreRequestScript,
  runTestScript,
  type TemplateContext
} from '@runtime/index'
import { getSecret } from '../vault/secret-vault'
import { resolveInheritedSettings } from '../workspace/inheritance'
import { getNetworkSettings, findClientCertificate } from '../network/network-settings'
import { getCookieJar } from '../network/cookie-jar'
import { getWorkspaceSettingsOverride, mergeNetworkSettings } from '../workspace/workspace-settings'
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import { readFile as readFileFs } from 'node:fs/promises'
import { constants as cryptoConstants } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'

interface Timings {
  dns: number
  tcp: number
  tls: number
  ttfb: number
  download: number
  total: number
}

// `got` v14+ is ESM-only; main process bundles as CJS, so it must be loaded via dynamic import.
async function loadGot() {
  const module = await import('got')
  return module.default
}

function extractTimings(res: GotResponse): Timings {
  const t = res.timings
  const start = t.start ?? 0
  const socket = t.socket ?? start
  const lookup = t.lookup ?? socket
  const connect = t.connect ?? lookup
  const secureConnect = t.secureConnect ?? connect
  const response = t.response ?? secureConnect
  const end = t.end ?? response

  return {
    dns: lookup - socket,
    tcp: connect - lookup,
    tls: secureConnect > connect ? secureConnect - connect : 0,
    ttfb: response - secureConnect,
    download: end - response,
    total: end - start
  }
}

function authTexts(auth: Auth | undefined): string[] {
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

function resolveAuthTemplate(auth: Auth | undefined, ctx: TemplateContext): Auth | undefined {
  if (!auth) return auth
  switch (auth.type) {
    case 'basic':
      return { ...auth, username: resolveTemplate(auth.username, ctx), password: resolveTemplate(auth.password, ctx) }
    case 'bearer':
      return { ...auth, token: resolveTemplate(auth.token, ctx) }
    case 'apiKey':
      return { ...auth, key: resolveTemplate(auth.key, ctx), value: resolveTemplate(auth.value, ctx) }
    case 'jwt':
      return { ...auth, secret: resolveTemplate(auth.secret, ctx) }
    default:
      return auth
  }
}

// İstek-bazlı TLS ayarlarını (devre dışı protokoller, cipher takımı, sunucu sırası)
// Node TLS soket seçeneklerine çevirir. Boşsa undefined döner (özel agent gerekmez).
function buildTlsSocketOptions(rs: RequestSettings | undefined): Record<string, unknown> | undefined {
  if (!rs) return undefined
  const options: Record<string, unknown> = {}
  if (rs.cipherSuites.trim()) options.ciphers = rs.cipherSuites.split(/[\s,]+/).filter(Boolean).join(':')
  let secureOptions = 0
  const flags: Record<TlsProtocol, number> = {
    SSLv3: cryptoConstants.SSL_OP_NO_SSLv3,
    TLSv1: cryptoConstants.SSL_OP_NO_TLSv1,
    'TLSv1.1': cryptoConstants.SSL_OP_NO_TLSv1_1,
    'TLSv1.2': cryptoConstants.SSL_OP_NO_TLSv1_2,
    'TLSv1.3': cryptoConstants.SSL_OP_NO_TLSv1_3
  }
  for (const protocol of rs.disabledTlsProtocols) secureOptions |= flags[protocol]
  if (rs.useServerCipherOrder) secureOptions |= cryptoConstants.SSL_OP_CIPHER_SERVER_PREFERENCE
  if (secureOptions) options.secureOptions = secureOptions
  return Object.keys(options).length > 0 ? options : undefined
}

async function buildGotOptions(hostname: string, workspaceRoot: string | undefined, requestSettings?: RequestSettings) {
  const globalSettings = await getNetworkSettings()
  const override = workspaceRoot ? (await getWorkspaceSettingsOverride(workspaceRoot)).networkSettings : undefined
  const settings = mergeNetworkSettings(globalSettings, override)

  const tlsOptions = buildTlsSocketOptions(requestSettings)
  const hasProxy = Boolean(settings.proxyEnabled && settings.proxyUrl)

  // Özel TLS seçenekleri proxy'li/proxy'siz HTTPS agent'ına gömülür (got'un https bloğu bunları taşımaz).
  const agent = hasProxy
    ? {
        http: new HttpProxyAgent({ proxy: settings.proxyUrl }),
        https: new HttpsProxyAgent({ proxy: settings.proxyUrl, ...(tlsOptions ?? {}) })
      }
    : tlsOptions
      ? { https: new HttpsAgent(tlsOptions) }
      : undefined

  const clientCert = findClientCertificate(settings, hostname)

  // HTTP/2: got'un h2 yolu özel agent/proxy ile birlikte çalışmaz — yalnızca ikisi de yokken etkin.
  const http2 = (requestSettings?.httpVersion ?? 'auto') !== 'http1' && !agent

  return {
    agent,
    http2,
    https: {
      certificateAuthority: settings.customCaPem || undefined,
      certificate: clientCert?.certPem || undefined,
      key: clientCert?.keyPem || undefined,
      passphrase: clientCert?.passphrase || undefined,
      rejectUnauthorized: settings.rejectUnauthorized
    },
    cookieJar: settings.cookieJarEnabled ? getCookieJar() : undefined
  }
}

async function buildTemplateContext(variables: Record<string, string>, candidateTexts: Array<string | undefined>): Promise<TemplateContext> {
  const secretKeys = extractSecretKeys(candidateTexts)
  const secretEntries = await Promise.all(secretKeys.map(async (key) => [key, await getSecret(key)] as const))
  const secrets = Object.fromEntries(secretEntries)

  return {
    variables,
    resolveSecret: (key) => secrets[key]
  }
}

export async function runHttpRequest(payload: HttpRequestPayload): Promise<HttpResponsePayload> {
  const got = await loadGot()

  const inherited =
    payload.requestPath && payload.workspaceRoot
      ? await resolveInheritedSettings(payload.requestPath, payload.workspaceRoot)
      : { headers: [], auth: undefined }

  // Pre-request script'i şablon çözümlemesinden ÖNCE çalıştır: değişkenleri ve istek alanlarını değiştirebilir.
  const preRequest = runPreRequestScript(payload.preRequestScript ?? '', payload.environmentVariables ?? {}, {
    method: payload.method,
    url: payload.url,
    headers: [...inherited.headers, ...payload.headers],
    params: payload.params,
    body: payload.body
  })

  const effectiveHeaders = preRequest.request.headers
  const effectiveAuthBase = payload.auth && payload.auth.type !== 'none' ? payload.auth : inherited.auth

  const ctx = await buildTemplateContext(preRequest.variables, [
    preRequest.request.url,
    preRequest.request.body?.content,
    ...effectiveHeaders.map((h) => h.value),
    ...preRequest.request.params.map((p) => p.value),
    ...authTexts(effectiveAuthBase)
  ])

  const url = new URL(resolveTemplate(preRequest.request.url, ctx))

  // encodeUrl kapalıysa parametreler yüzde-kodlama uygulanmadan ham olarak eklenir.
  if (payload.settings?.encodeUrl === false) {
    const rawPairs = preRequest.request.params
      .filter((param) => param.enabled && param.key)
      .map((param) => `${param.key}=${resolveTemplate(param.value, ctx)}`)
    if (rawPairs.length > 0) {
      const existing = url.search ? `${url.search.slice(1)}&` : ''
      url.search = existing + rawPairs.join('&')
    }
  } else {
    for (const param of preRequest.request.params) {
      if (param.enabled && param.key) url.searchParams.set(param.key, resolveTemplate(param.value, ctx))
    }
  }

  const headers: Record<string, string> = {}
  for (const header of effectiveHeaders) {
    if (header.enabled && header.key) headers[header.key] = resolveTemplate(header.value, ctx)
  }

  const auth = resolveAuthTemplate(effectiveAuthBase, ctx)
  const applied = resolveAuth(auth)
  Object.assign(headers, applied.headers)
  for (const [key, value] of Object.entries(applied.queryParams)) {
    url.searchParams.set(key, value)
  }

  // Gövde modları: raw/json metin olarak; form urlencoded; multipart FormData;
  // binary content'teki dosya yolundan okunur. Content-Type yalnızca kullanıcı belirtmediyse eklenir.
  const bodyMode = preRequest.request.body?.mode ?? 'none'
  const rawBody = preRequest.request.body?.content ?? ''
  const hasContentType = () => Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')
  let bodyContent: string | Buffer | FormData | undefined
  if (bodyMode === 'raw' || bodyMode === 'json') {
    bodyContent = resolveTemplate(rawBody, ctx)
    if (bodyMode === 'json' && !hasContentType()) headers['Content-Type'] = 'application/json'
  } else if (bodyMode === 'form') {
    bodyContent = resolveTemplate(rawBody, ctx)
    if (!hasContentType()) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (bodyMode === 'multipart') {
    const formData = new FormData()
    for (const [key, value] of new URLSearchParams(rawBody)) formData.append(key, resolveTemplate(value, ctx))
    bodyContent = formData
  } else if (bodyMode === 'binary' && rawBody) {
    bodyContent = await readFileFs(rawBody)
    if (!hasContentType()) headers['Content-Type'] = 'application/octet-stream'
  }

  // İstek-bazlı ayarlar (Settings sekmesi): ağ ayarlarının üzerine yalnızca bu istek için uygulanır.
  const requestSettings = payload.settings
  const gotOptions = await buildGotOptions(url.hostname, payload.workspaceRoot, requestSettings)
  if (requestSettings?.verifySsl === false) {
    gotOptions.https = { ...gotOptions.https, rejectUnauthorized: false }
  }
  if (requestSettings?.disableCookieJar) {
    gotOptions.cookieJar = undefined
  }

  // Katı ayrıştırıcı kapalıysa geçersiz HTTP başlıklı yanıtlar tolere edilir (insecureHTTPParser).
  // got bunu public seçenek olarak taşımadığından native request fonksiyonu sarmalanır (HTTP/1.1 yolu).
  let lenientRequest: unknown
  if (requestSettings?.strictHttpParser === false) {
    gotOptions.http2 = false
    lenientRequest = (target: URL, options: Record<string, unknown>, callback?: () => void) =>
      (target.protocol === 'https:' ? httpsRequest : httpRequest)(
        target,
        { ...options, insecureHTTPParser: true } as never,
        callback as never
      )
  }

  // Yönlendirme davranışları: Authorization başlığını koru / referer'ı kaldır.
  const originalAuthorization = Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
  const beforeRedirect = [
    (options: { headers?: Record<string, unknown> }) => {
      if (!options.headers) return
      if (requestSettings?.removeRefererOnRedirect) {
        delete options.headers.referer
        delete options.headers.referrer
      }
      if (requestSettings?.keepAuthorizationOnRedirect && originalAuthorization !== undefined) {
        options.headers.authorization = originalAuthorization
      }
    }
  ]

  const response = await got(url, {
    method: preRequest.request.method as never,
    headers,
    body: bodyContent,
    throwHttpErrors: false,
    retry: { limit: 0 },
    responseType: 'buffer',
    followRedirect: requestSettings?.followRedirects ?? true,
    maxRedirects: requestSettings?.maxRedirects ?? 10,
    // Kapalıyken (Postman varsayılanı) 301/302 yönlendirmeleri GET'e çevrilir.
    methodRewriting: !(requestSettings?.followOriginalMethod ?? false),
    hooks: { beforeRedirect },
    ...(requestSettings?.timeoutMs ? { timeout: { request: requestSettings.timeoutMs } } : {}),
    ...(lenientRequest ? { request: lenientRequest as never } : {}),
    ...gotOptions
  })

  const bodyBuffer = response.body as unknown as Buffer
  const isText = /json|text|xml|html|javascript/.test(response.headers['content-type'] ?? '')
  const responseBody = isText ? bodyBuffer.toString('utf8') : bodyBuffer.toString('base64')
  const responseHeaders = Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)]))

  const testRun = runTestScript(payload.testScript ?? '', preRequest.variables, {
    status: response.statusCode,
    headers: responseHeaders,
    body: responseBody
  })

  const result: HttpResponsePayload = {
    requestId: payload.id,
    status: response.statusCode,
    statusText: response.statusMessage ?? '',
    headers: responseHeaders,
    body: responseBody,
    bodyEncoding: isText ? 'utf8' : 'base64',
    timing: extractTimings(response),
    sizeBytes: bodyBuffer.byteLength,
    testResults: testRun.tests
  }

  cacheResponse(payload.name, result)
  return result
}
