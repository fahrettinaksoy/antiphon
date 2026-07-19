// Koleksiyon çalıştırıcı — webview'da koşar.
//
// Klasör altındaki istekleri sırayla sendHttpRequest pipeline'ından geçirir (pre-request/test
// script + şablon + auth dahil). İlerleme, in-webview bir emitter ile onCollectionRunProgress'e
// yayılır (ayrı süreç olmadığından Tauri event'ine gerek yok).

import type {
  CollectionRunProgressEvent,
  CollectionRunResultDto,
  HttpRequestPayload,
  WorkspaceNode
} from '@shared/ipc-contract'
import { sendHttpRequest } from './http-client'
import { buildWorkspaceTree, readRequestFile } from './workspace-client'

const progressListeners = new Set<(event: CollectionRunProgressEvent) => void>()

export function onCollectionRunProgress(
  callback: (event: CollectionRunProgressEvent) => void
): () => void {
  progressListeners.add(callback)
  return () => progressListeners.delete(callback)
}

function emitProgress(event: CollectionRunProgressEvent): void {
  for (const listener of progressListeners) listener(event)
}

// Ağaçtaki istek düğümlerini derinlik-öncelikli (sıralı) toplar.
function collectRequests(node: WorkspaceNode): WorkspaceNode[] {
  if (node.type === 'request') return [node]
  return (node.children ?? []).flatMap(collectRequests)
}

export async function runCollection(
  runId: string,
  folderPath: string,
  workspaceRoot: string,
  variables: Record<string, string>
): Promise<CollectionRunResultDto[]> {
  const tree = await buildWorkspaceTree(folderPath)
  const requests = collectRequests(tree)
  const results: CollectionRunResultDto[] = []

  for (let index = 0; index < requests.length; index++) {
    const node = requests[index]
    const startedAt = Date.now()
    let result: CollectionRunResultDto

    try {
      const file = await readRequestFile(node.path)
      const payload: HttpRequestPayload = {
        id: node.path,
        name: file.name,
        method: file.method,
        url: file.url,
        headers: file.headers,
        params: file.params,
        body: file.body,
        auth: file.auth,
        settings: file.settings,
        environmentVariables: variables,
        requestPath: node.path,
        workspaceRoot,
        preRequestScript: file.preRequestScript,
        testScript: file.testScript
      }
      const response = await sendHttpRequest(payload)
      result = {
        path: node.path,
        name: file.name,
        method: file.method,
        url: file.url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        tests: response.testResults ?? []
      }
    } catch (error) {
      result = {
        path: node.path,
        name: node.name,
        method: node.method ?? 'GET',
        url: '',
        status: null,
        durationMs: Date.now() - startedAt,
        tests: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }

    results.push(result)
    emitProgress({ runId, result, index, total: requests.length })
  }

  return results
}
