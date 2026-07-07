import { readdir, readFile, writeFile, rename, rm, mkdir, access } from 'node:fs/promises'
import { join, basename, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import yaml from 'js-yaml'
import { RequestFileSchema, FolderMetaSchema, SCHEMA_VERSION, type RequestFile, type FolderMeta, type FolderMetaInput } from '@schema/request'
import type { WorkspaceNode } from '@shared/ipc-contract'

export const REQUEST_EXTENSION = '.req.yaml'
export const FOLDER_META_FILENAME = 'folder.meta.yaml'

export async function buildWorkspaceTree(rootPath: string): Promise<WorkspaceNode> {
  return walk(rootPath)
}

async function walk(currentPath: string): Promise<WorkspaceNode> {
  const entries = await readdir(currentPath, { withFileTypes: true })
  const children: WorkspaceNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'environments') continue
    const entryPath = join(currentPath, entry.name)

    if (entry.isDirectory()) {
      children.push(await walk(entryPath))
    } else if (entry.name.endsWith(REQUEST_EXTENSION)) {
      const { name, method } = await peekRequest(entryPath, basename(entry.name, REQUEST_EXTENSION))
      children.push({ id: entryPath, type: 'request', name, method, path: entryPath })
    }
  }

  return {
    id: currentPath,
    type: 'folder',
    name: basename(currentPath),
    path: currentPath,
    children
  }
}

// Ağaçta method rozetini (GET/POST…) göstermek için ad ve method'u dosyadan hafifçe okur.
async function peekRequest(filePath: string, fallback: string): Promise<{ name: string; method: string }> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = yaml.load(raw) as { name?: unknown; method?: unknown }
    const name = typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name : fallback
    const method = typeof parsed?.method === 'string' && parsed.method.trim() ? parsed.method : 'GET'
    return { name, method }
  } catch {
    return { name: fallback, method: 'GET' }
  }
}

// Klasördeki tüm `.req.yaml` dosyalarını dosya sistemi sırasına göre (derinlik-öncelikli) toplar; koleksiyon runner'ı için kullanılır.
export async function listRequestFilesRecursive(folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true })
  const paths: string[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'environments') continue
    const entryPath = join(folderPath, entry.name)

    if (entry.isDirectory()) {
      paths.push(...(await listRequestFilesRecursive(entryPath)))
    } else if (entry.name.endsWith(REQUEST_EXTENSION)) {
      paths.push(entryPath)
    }
  }

  return paths
}

export async function readRequestFile(filePath: string): Promise<RequestFile> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = yaml.load(raw)
  return RequestFileSchema.parse(parsed)
}

// Geçici dosyaya yazıp yeniden adlandırma: yarım yazılmış dosyanın Git/watcher tarafından okunmasını önler.
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp-${randomUUID()}`
  await writeFile(tmpPath, content, 'utf8')
  await rename(tmpPath, filePath)
}

export async function writeRequestFile(filePath: string, data: RequestFile): Promise<void> {
  const validated = RequestFileSchema.parse(data)
  const content = yaml.dump(validated, { indent: 2, lineWidth: 100, noRefs: true })
  await atomicWriteFile(filePath, content)
}

export async function createRequestFile(folderPath: string, name: string): Promise<WorkspaceNode> {
  // Aynı ad varsa mevcut dosyayı EZME — "Ad 2", "Ad 3"… olarak benzersizleştir.
  let finalName = name
  let filePath = join(folderPath, `${slugify(finalName)}${REQUEST_EXTENSION}`)
  for (let counter = 2; await pathExists(filePath); counter++) {
    finalName = `${name} ${counter}`
    filePath = join(folderPath, `${slugify(name)}-${counter}${REQUEST_EXTENSION}`)
  }

  const initial: RequestFile = {
    schema: SCHEMA_VERSION,
    name: finalName,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { mode: 'none' }
  }
  await writeRequestFile(filePath, initial)
  return { id: filePath, type: 'request', name: finalName, path: filePath }
}

export async function createFolder(parentPath: string, name: string): Promise<WorkspaceNode> {
  const folderPath = join(parentPath, slugify(name))
  await mkdir(folderPath, { recursive: true })
  return { id: folderPath, type: 'folder', name, path: folderPath, children: [] }
}

export async function deleteNode(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}

export async function renameNode(targetPath: string, newName: string): Promise<WorkspaceNode> {
  const isRequest = targetPath.endsWith(REQUEST_EXTENSION)
  const parent = dirname(targetPath)
  const newPath = isRequest ? join(parent, `${slugify(newName)}${REQUEST_EXTENSION}`) : join(parent, slugify(newName))
  await rename(targetPath, newPath)

  if (isRequest) {
    const data = await readRequestFile(newPath)
    await writeRequestFile(newPath, { ...data, name: newName })
  }

  return { id: newPath, type: isRequest ? 'request' : 'folder', name: newName, path: newPath }
}

export async function readFolderMeta(folderPath: string): Promise<FolderMeta | null> {
  const filePath = join(folderPath, FOLDER_META_FILENAME)
  if (!(await pathExists(filePath))) return null
  try {
    const raw = await readFile(filePath, 'utf8')
    return FolderMetaSchema.parse(yaml.load(raw))
  } catch {
    return null
  }
}

export async function writeFolderMeta(folderPath: string, data: FolderMetaInput): Promise<void> {
  const validated = FolderMetaSchema.parse(data)
  const content = yaml.dump(validated, { indent: 2, lineWidth: 100, noRefs: true })
  await atomicWriteFile(join(folderPath, FOLDER_META_FILENAME), content)
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export function slugify(name: string): string {
  const trimmed = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, '')
    .replace(/\s+/g, '-')
  return trimmed.length > 0 ? trimmed : `request-${randomUUID().slice(0, 8)}`
}
