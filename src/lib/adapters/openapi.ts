// OpenAPI spec → istek dosyaları. Dosya yazımı workspace-client üzerinden.

import type { KeyValue, RequestFile } from '@schema/request'
import { SCHEMA_VERSION } from '@schema/request'
import yaml from 'js-yaml'
import { createFolder, writeNewRequestFile } from '../workspace-client'

interface OpenApiParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  required?: boolean
  example?: unknown
  schema?: { example?: unknown; default?: unknown }
}
interface OpenApiOperation {
  summary?: string
  operationId?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: { content?: Record<string, { schema?: unknown; example?: unknown }> }
}
interface OpenApiDocument {
  info?: { title?: string }
  servers?: Array<{ url: string }>
  paths?: Record<string, Record<string, OpenApiOperation>>
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

function exampleValue(param: OpenApiParameter): string {
  const value = param.example ?? param.schema?.example ?? param.schema?.default
  return value !== undefined ? String(value) : ''
}

function toParamKeyValues(
  parameters: OpenApiParameter[] | undefined,
  location: 'query' | 'header'
): KeyValue[] {
  return (parameters ?? [])
    .filter((p) => p.in === location)
    .map((p) => ({ key: p.name, value: exampleValue(p), enabled: true }))
}

function toBody(operation: OpenApiOperation): RequestFile['body'] {
  const jsonContent = operation.requestBody?.content?.['application/json']
  if (!jsonContent) return { mode: 'none' }
  const example = jsonContent.example
  return { mode: 'json', content: example !== undefined ? JSON.stringify(example, null, 2) : '{}' }
}

export async function importOpenapiSpec(
  specText: string,
  targetFolderPath: string
): Promise<{ importedCount: number; skipped: string[] }> {
  const doc = (
    specText.trim().startsWith('{') ? JSON.parse(specText) : yaml.load(specText)
  ) as OpenApiDocument
  const baseUrl = doc.servers?.[0]?.url ?? ''
  const skipped: string[] = []
  let importedCount = 0

  // Grup (tag) → oluşturulmuş klasör yolu (bir kez oluştur).
  const groupFolders = new Map<string, string>()

  for (const [path, operations] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method]
      if (!operation) continue

      const groupName = operation.tags?.[0] ?? path.split('/').filter(Boolean)[0] ?? 'default'
      let groupPath = groupFolders.get(groupName)
      if (!groupPath) {
        groupPath = (await createFolder(targetFolderPath, groupName)).path
        groupFolders.set(groupName, groupPath)
      }

      const name = operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`
      const requestFile: RequestFile = {
        schema: SCHEMA_VERSION,
        name,
        method: method.toUpperCase() as RequestFile['method'],
        url: `${baseUrl}${path}`,
        params: toParamKeyValues(operation.parameters, 'query'),
        headers: toParamKeyValues(operation.parameters, 'header'),
        auth: { type: 'none' },
        body: toBody(operation)
      }

      try {
        await writeNewRequestFile(groupPath, name, requestFile)
        importedCount++
      } catch {
        skipped.push(name)
      }
    }
  }

  return { importedCount, skipped }
}
