// Mock server istemcisi. OpenAPI'yi webview'da ayrıştırıp (js-yaml) faker gövdeleriyle
// rota tablosu üretir; Rust axum sunucusunu (mock_start) bu tabloyla başlatır.

import type { MockServerStatusDto } from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import yaml from 'js-yaml'
import { generateFromSchema } from './adapters/schema-faker'

interface OpenApiOperation {
  responses?: Record<string, { content?: Record<string, { schema?: unknown; example?: unknown }> }>
}
interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation>>
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

interface MockRoute {
  method: string
  path: string
  body: unknown
}

function pickSuccessResponse(
  operation: OpenApiOperation
): { schema?: unknown; example?: unknown } | undefined {
  const responses = operation.responses ?? {}
  const successKey =
    Object.keys(responses).find((code) => code.startsWith('2')) ?? Object.keys(responses)[0]
  if (!successKey) return undefined
  return responses[successKey]?.content?.['application/json']
}

export async function startMockServer(port: number): Promise<MockServerStatusDto> {
  const picked = await open({
    multiple: false,
    filters: [{ name: 'OpenAPI Spec', extensions: ['json', 'yaml', 'yml'] }]
  })
  // İptal → mevcut durumu döndür.
  if (typeof picked !== 'string') return invoke<MockServerStatusDto>('mock_status')

  const specText = await invoke<string>('fs_read_text', { path: picked })
  const doc = (
    specText.trim().startsWith('{') ? JSON.parse(specText) : yaml.load(specText)
  ) as OpenApiDocument

  const routes: MockRoute[] = []
  for (const [path, operations] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method]
      if (!operation) continue
      const content = pickSuccessResponse(operation)
      const body = content?.example ?? generateFromSchema(content?.schema as never) ?? {}
      routes.push({ method: method.toUpperCase(), path, body })
    }
  }

  return invoke<MockServerStatusDto>('mock_start', { routes, port })
}

export function stopMockServer(): Promise<void> {
  return invoke('mock_stop')
}

export function getMockServerStatus(): Promise<MockServerStatusDto> {
  return invoke<MockServerStatusDto>('mock_status')
}
