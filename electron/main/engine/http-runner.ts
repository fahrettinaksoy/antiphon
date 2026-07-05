import type { Response as GotResponse } from 'got'
import type { HttpRequestPayload, HttpResponsePayload } from '@shared/ipc-contract'
import type { Auth } from '@schema/request'
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

async function buildGotOptions(hostname: string, workspaceRoot: string | undefined) {
  const globalSettings = await getNetworkSettings()
  const override = workspaceRoot ? (await getWorkspaceSettingsOverride(workspaceRoot)).networkSettings : undefined
  const settings = mergeNetworkSettings(globalSettings, override)

  const agent = settings.proxyEnabled && settings.proxyUrl
    ? {
        http: new HttpProxyAgent({ proxy: settings.proxyUrl }),
        https: new HttpsProxyAgent({ proxy: settings.proxyUrl })
      }
    : undefined

  const clientCert = findClientCertificate(settings, hostname)

  return {
    agent,
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

  for (const param of preRequest.request.params) {
    if (param.enabled && param.key) url.searchParams.set(param.key, resolveTemplate(param.value, ctx))
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

  const bodyContent =
    preRequest.request.body?.mode === 'raw' || preRequest.request.body?.mode === 'json'
      ? resolveTemplate(preRequest.request.body.content ?? '', ctx)
      : undefined

  const gotOptions = await buildGotOptions(url.hostname, payload.workspaceRoot)

  const response = await got(url, {
    method: preRequest.request.method as never,
    headers,
    body: bodyContent,
    throwHttpErrors: false,
    retry: { limit: 0 },
    responseType: 'buffer',
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
