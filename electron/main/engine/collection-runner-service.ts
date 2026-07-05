import type { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-contract'
import { runCollection, type CollectionRequestItem, type HttpCallFn, type CollectionRunResult } from '@runtime/index'
import { getSecret } from '../vault/secret-vault'
import { listRequestFilesRecursive, readRequestFile } from '../workspace/workspace-service'
import { resolveInheritedSettings } from '../workspace/inheritance'

let targetWindow: BrowserWindow | null = null

export function setCollectionRunnerWindow(window: BrowserWindow): void {
  targetWindow = window
}

async function loadGot() {
  const module = await import('got')
  return module.default
}

async function buildHttpCall(): Promise<HttpCallFn> {
  const got = await loadGot()
  return async ({ method, url, headers, body }) => {
    const response = await got(url, {
      method: method as never,
      headers,
      body,
      throwHttpErrors: false,
      retry: { limit: 0 },
      responseType: 'buffer'
    })
    const bodyBuffer = response.body as unknown as Buffer
    const isText = /json|text|xml|html|javascript/.test(response.headers['content-type'] ?? '')
    return {
      status: response.statusCode,
      statusText: response.statusMessage ?? '',
      headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
      body: isText ? bodyBuffer.toString('utf8') : bodyBuffer.toString('base64')
    }
  }
}

export async function runFolderCollection(
  runId: string,
  folderPath: string,
  workspaceRoot: string,
  variables: Record<string, string>
): Promise<CollectionRunResult[]> {
  const filePaths = await listRequestFilesRecursive(folderPath)
  const items: CollectionRequestItem[] = []

  for (const path of filePaths) {
    const file = await readRequestFile(path)
    const inherited = await resolveInheritedSettings(path, workspaceRoot)
    items.push({ path, file, inheritedHeaders: inherited.headers, inheritedAuth: inherited.auth })
  }

  const httpCall = await buildHttpCall()

  return runCollection(items, {
    variables,
    resolveSecret: (key) => getSecret(key),
    httpCall,
    onProgress: (result, index, total) => {
      targetWindow?.webContents.send(IpcChannels.collectionRunProgress, { runId, result, index, total })
    }
  })
}
