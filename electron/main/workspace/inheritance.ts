import { dirname, join, relative, sep } from 'node:path'
import type { Auth, KeyValue } from '@schema/request'
import { readFolderMeta } from './workspace-service'

export interface InheritedSettings {
  auth?: Auth
  headers: KeyValue[]
}

function foldersFromRootToLeaf(requestFilePath: string, workspaceRoot: string): string[] {
  const leafDir = dirname(requestFilePath)
  const rel = relative(workspaceRoot, leafDir)
  if (rel.startsWith('..')) return [workspaceRoot]

  const segments = rel.split(sep).filter(Boolean)
  const folders = [workspaceRoot]
  let current = workspaceRoot
  for (const segment of segments) {
    current = join(current, segment)
    folders.push(current)
  }
  return folders
}

// En yakın klasör en son uygulanır: header'larda aynı anahtar için yakın klasör kazanır, auth için de en yakın tanımlı olan geçerlidir.
export async function resolveInheritedSettings(requestFilePath: string, workspaceRoot: string): Promise<InheritedSettings> {
  const folders = foldersFromRootToLeaf(requestFilePath, workspaceRoot)
  const headerMap = new Map<string, KeyValue>()
  let auth: Auth | undefined

  for (const folder of folders) {
    const meta = await readFolderMeta(folder)
    if (!meta) continue
    for (const header of meta.headers) {
      headerMap.set(header.key, header)
    }
    if (meta.auth && meta.auth.type !== 'none') auth = meta.auth
  }

  return { auth, headers: [...headerMap.values()] }
}
