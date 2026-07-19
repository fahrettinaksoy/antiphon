// İçe/dışa aktarma orkestrasyonu. Dialog + dosya oku + adapter + ağaç yenile.

import type { CurlParseResult, ImportResult } from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { parseCurlCommand } from './adapters/curl'
import { importOpenapiSpec as runOpenapiImport } from './adapters/openapi'
import { importPostmanCollection as runPostmanImport } from './adapters/postman'
import { buildWorkspaceTree } from './workspace-client'

interface DialogFilter {
  name: string
  extensions: string[]
}

const EMPTY_RESULT: ImportResult = { importedCount: 0, skipped: [], tree: null }

export function parseCurl(command: string): Promise<CurlParseResult> {
  return Promise.resolve(parseCurlCommand(command))
}

// Seçilen dosyanın metnini döndürür (iptal → null).
async function pickAndRead(filters: DialogFilter[]): Promise<string | null> {
  const picked = await open({ multiple: false, filters })
  if (typeof picked !== 'string') return null
  return invoke<string>('fs_read_text', { path: picked })
}

export async function importPostmanCollection(workspaceRoot: string): Promise<ImportResult> {
  const content = await pickAndRead([{ name: 'Postman Collection', extensions: ['json'] }])
  if (content === null) return EMPTY_RESULT
  const { importedCount, skipped } = await runPostmanImport(content, workspaceRoot)
  const tree = await buildWorkspaceTree(workspaceRoot)
  return { importedCount, skipped, tree }
}

export async function importOpenapiSpec(workspaceRoot: string): Promise<ImportResult> {
  const content = await pickAndRead([{ name: 'OpenAPI Spec', extensions: ['json', 'yaml', 'yml'] }])
  if (content === null) return EMPTY_RESULT
  const { importedCount, skipped } = await runOpenapiImport(content, workspaceRoot)
  const tree = await buildWorkspaceTree(workspaceRoot)
  return { importedCount, skipped, tree }
}
