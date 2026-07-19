import type { Auth, KeyValue, RequestFile } from '@schema/request'
import type { TestResult } from './script-engine'
import type { TemplateContext } from './template-engine'
import { resolveAuth } from './auth'
import { cacheResponse } from './response-cache'
import { runPreRequestScript, runTestScript } from './script-engine'
import { extractSecretKeys, resolveTemplate } from './template-engine'

export interface CollectionRequestItem {
  path: string
  file: RequestFile
  inheritedHeaders: KeyValue[]
  inheritedAuth?: Auth
}

export interface HttpCallResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export type HttpCallFn = (args: {
  method: string
  url: URL
  headers: Record<string, string>
  body?: string
}) => Promise<HttpCallResult>

export interface CollectionRunResult {
  path: string
  name: string
  method: string
  url: string
  status: number | null
  durationMs: number
  tests: TestResult[]
  error?: string
}

export interface CollectionRunOptions {
  variables: Record<string, string>
  resolveSecret: (key: string) => string | undefined | Promise<string | undefined>
  httpCall: HttpCallFn
  onProgress?: (result: CollectionRunResult, index: number, total: number) => void
  shouldStop?: (result: CollectionRunResult) => boolean
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

export async function runCollectionItem(
  item: CollectionRequestItem,
  options: CollectionRunOptions
): Promise<CollectionRunResult> {
  const startedAt = Date.now()
  const { file } = item

  try {
    const preRequest = runPreRequestScript(file.preRequestScript ?? '', options.variables, {
      method: file.method,
      url: file.url,
      headers: [...item.inheritedHeaders, ...file.headers],
      params: file.params,
      body: file.body
    })

    const effectiveAuth = file.auth.type !== 'none' ? file.auth : item.inheritedAuth
    const candidateTexts = [
      preRequest.request.url,
      preRequest.request.body?.content,
      ...preRequest.request.headers.map((h) => h.value),
      ...preRequest.request.params.map((p) => p.value),
      ...authTexts(effectiveAuth)
    ]
    const secretKeys = extractSecretKeys(candidateTexts)
    const secretEntries = await Promise.all(
      secretKeys.map(async (key) => [key, await options.resolveSecret(key)] as const)
    )
    const secrets = Object.fromEntries(secretEntries)
    const ctx: TemplateContext = {
      variables: preRequest.variables,
      resolveSecret: (key) => secrets[key]
    }

    const url = new URL(resolveTemplate(preRequest.request.url, ctx))
    for (const param of preRequest.request.params) {
      if (param.enabled && param.key)
        url.searchParams.set(param.key, resolveTemplate(param.value, ctx))
    }

    const headers: Record<string, string> = {}
    for (const header of preRequest.request.headers) {
      if (header.enabled && header.key) headers[header.key] = resolveTemplate(header.value, ctx)
    }

    const auth = resolveAuthTemplate(effectiveAuth, ctx)
    const applied = resolveAuth(auth)
    Object.assign(headers, applied.headers)
    for (const [key, value] of Object.entries(applied.queryParams)) {
      url.searchParams.set(key, value)
    }

    const bodyContent =
      preRequest.request.body?.mode === 'raw' || preRequest.request.body?.mode === 'json'
        ? resolveTemplate(preRequest.request.body.content ?? '', ctx)
        : undefined

    const response = await options.httpCall({
      method: preRequest.request.method,
      url,
      headers,
      body: bodyContent
    })
    const durationMs = Date.now() - startedAt

    const testRun = runTestScript(file.testScript ?? '', preRequest.variables, response)

    cacheResponse(file.name, {
      requestId: item.path,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      bodyEncoding: 'utf8',
      timing: {
        prepare: 0,
        socketInit: 0,
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        download: 0,
        process: 0,
        total: durationMs
      },
      sizeBytes: response.body.length
    })

    return {
      path: item.path,
      name: file.name,
      method: file.method,
      url: url.toString(),
      status: response.status,
      durationMs,
      tests: testRun.tests
    }
  } catch (error) {
    return {
      path: item.path,
      name: file.name,
      method: file.method,
      url: file.url,
      status: null,
      durationMs: Date.now() - startedAt,
      tests: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function runCollection(
  items: CollectionRequestItem[],
  options: CollectionRunOptions
): Promise<CollectionRunResult[]> {
  const results: CollectionRunResult[] = []
  for (let i = 0; i < items.length; i++) {
    const result = await runCollectionItem(items[i], options)
    results.push(result)
    options.onProgress?.(result, i, items.length)
    if (options.shouldStop?.(result)) break
  }
  return results
}
