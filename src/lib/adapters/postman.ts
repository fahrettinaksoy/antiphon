// Postman koleksiyonu → istek dosyaları. Dosya/klasör oluşturma workspace-client
// (createFolder + writeNewRequestFile) üzerinden (slug/mkdir Rust'ta).

import type { Auth, KeyValue, RequestFile } from '@schema/request'
import { SCHEMA_VERSION } from '@schema/request'
import { createFolder, writeNewRequestFile } from '../workspace-client'

interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
}
interface PostmanUrl {
  raw?: string
}
interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql'
  raw?: string
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>
  options?: { raw?: { language?: string } }
}
interface PostmanAuth {
  type?: string
  basic?: Array<{ key: string; value: string }>
  bearer?: Array<{ key: string; value: string }>
  apikey?: Array<{ key: string; value: string }>
}
interface PostmanRequest {
  method?: string
  url?: string | PostmanUrl
  header?: PostmanHeader[]
  body?: PostmanBody
  auth?: PostmanAuth
}
interface PostmanItem {
  name: string
  item?: PostmanItem[]
  request?: PostmanRequest
}
interface PostmanCollection {
  info?: { name?: string }
  item?: PostmanItem[]
}

function toKeyValues(headers: PostmanHeader[] | undefined): KeyValue[] {
  return (headers ?? []).map((h) => ({ key: h.key, value: h.value, enabled: !h.disabled }))
}

function findAuthValue(
  entries: Array<{ key: string; value: string }> | undefined,
  key: string
): string {
  return entries?.find((e) => e.key === key)?.value ?? ''
}

function toAuth(auth: PostmanAuth | undefined): Auth {
  if (!auth || !auth.type || auth.type === 'noauth') return { type: 'none' }
  switch (auth.type) {
    case 'basic':
      return {
        type: 'basic',
        username: findAuthValue(auth.basic, 'username'),
        password: findAuthValue(auth.basic, 'password')
      }
    case 'bearer':
      return { type: 'bearer', token: findAuthValue(auth.bearer, 'token') }
    case 'apikey':
      return {
        type: 'apiKey',
        key: findAuthValue(auth.apikey, 'key'),
        value: findAuthValue(auth.apikey, 'value'),
        in: (findAuthValue(auth.apikey, 'in') || 'header') as 'header' | 'query'
      }
    default:
      return { type: 'none' }
  }
}

function toBody(body: PostmanBody | undefined): RequestFile['body'] {
  if (!body || !body.mode) return { mode: 'none' }
  if (body.mode === 'raw') {
    const language = body.options?.raw?.language
    return { mode: language === 'json' ? 'json' : 'raw', content: body.raw ?? '' }
  }
  if (body.mode === 'urlencoded') {
    const content = (body.urlencoded ?? [])
      .filter((entry) => !entry.disabled)
      .map((entry) => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`)
      .join('&')
    return { mode: 'form', content }
  }
  return { mode: 'raw', content: body.raw ?? '' }
}

function extractUrl(url: string | PostmanUrl | undefined): string {
  if (!url) return ''
  return typeof url === 'string' ? url : (url.raw ?? '')
}

interface ImportContext {
  importedCount: number
  skipped: string[]
}

async function importItem(
  item: PostmanItem,
  folderPath: string,
  ctx: ImportContext
): Promise<void> {
  if (item.item) {
    const subFolder = await createFolder(folderPath, item.name)
    for (const child of item.item) {
      await importItem(child, subFolder.path, ctx)
    }
    return
  }

  if (!item.request) {
    ctx.skipped.push(item.name)
    return
  }

  const requestFile: RequestFile = {
    schema: SCHEMA_VERSION,
    name: item.name,
    method: (item.request.method?.toUpperCase() ?? 'GET') as RequestFile['method'],
    url: extractUrl(item.request.url),
    params: [],
    headers: toKeyValues(item.request.header),
    auth: toAuth(item.request.auth),
    body: toBody(item.request.body)
  }

  await writeNewRequestFile(folderPath, item.name, requestFile)
  ctx.importedCount++
}

export async function importPostmanCollection(
  collectionJson: string,
  targetFolderPath: string
): Promise<{ importedCount: number; skipped: string[] }> {
  const collection = JSON.parse(collectionJson) as PostmanCollection
  const ctx: ImportContext = { importedCount: 0, skipped: [] }
  for (const item of collection.item ?? []) {
    await importItem(item, targetFolderPath, ctx)
  }
  return ctx
}
