// Çalışma alanı dosya istemcisi — Rust `fs_*` komutlarını çağırır.
//
// İş bölümü: Rust dosya sistemi ayrıcalığını + slug/yol/ağaç işini sahiplenir; YAML
// ayrıştırma/dump (js-yaml) ve zod DOĞRULAMASI burada yapılır.

import type {
  Auth,
  EnvironmentFile,
  FolderMeta,
  FolderMetaInput,
  KeyValue,
  RequestFile
} from '@schema/request'
import type { EnvironmentSummary, WorkspaceNode } from '@shared/ipc-contract'
import type { UnlistenFn } from '@tauri-apps/api/event'
import {
  EnvironmentFileSchema,
  FolderMetaSchema,
  RequestFileSchema,
  SCHEMA_VERSION
} from '@schema/request'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import yaml from 'js-yaml'

const REQUEST_EXTENSION = '.req.yaml'
const ENVIRONMENT_EXTENSION = '.env.yaml'
const ENVIRONMENTS_DIR = 'environments'
const FOLDER_META_FILENAME = 'folder.meta.yaml'
const YAML_DUMP_OPTIONS = { indent: 2, lineWidth: 100, noRefs: true } as const

interface CreatedNode {
  path: string
  name: string
}
interface RenamedNode {
  path: string
  isRequest: boolean
}

// Rust-dönüşü yollar OS ayracı taşır; buradan Rust'a giden birleşimlerde '/' güvenli
// (Windows dahil Rust Path '/'i kabul eder).
function joinPath(base: string, child: string): string {
  return `${base.replace(/[\\/]+$/, '')}/${child}`
}

function environmentsDir(root: string): string {
  return joinPath(root, ENVIRONMENTS_DIR)
}

function basename(path: string, suffix?: string): string {
  const name = path.split(/[\\/]/).pop() ?? path
  return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

// ---- Dialog tabanlı çalışma alanı açma ----

export async function openWorkspace(): Promise<WorkspaceNode | null> {
  const picked = await open({ directory: true })
  if (typeof picked !== 'string') return null
  await watchWorkspace(picked)
  return invoke<WorkspaceNode>('fs_workspace_tree', { root: picked })
}

export async function pickDirectory(): Promise<string | null> {
  const picked = await open({ directory: true })
  return typeof picked === 'string' ? picked : null
}

export async function chooseFile(): Promise<string | null> {
  const picked = await open({ directory: false, multiple: false })
  return typeof picked === 'string' ? picked : null
}

export function buildWorkspaceTree(root: string): Promise<WorkspaceNode> {
  return invoke<WorkspaceNode>('fs_workspace_tree', { root })
}

// ---- İstek dosyaları ----

export async function readRequestFile(path: string): Promise<RequestFile> {
  const raw = await invoke<string>('fs_read_text', { path })
  return RequestFileSchema.parse(yaml.load(raw))
}

export async function writeRequestFile(path: string, data: RequestFile): Promise<void> {
  const validated = RequestFileSchema.parse(data)
  const content = yaml.dump(validated, YAML_DUMP_OPTIONS)
  await invoke('fs_write_text', { path, content })
}

export async function createRequest(folderPath: string, name: string): Promise<WorkspaceNode> {
  const initial: RequestFile = {
    schema: SCHEMA_VERSION,
    name,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { mode: 'none' }
  }
  const content = yaml.dump({ ...initial, name }, YAML_DUMP_OPTIONS)
  const created = await invoke<CreatedNode>('fs_create_file', {
    dir: folderPath,
    baseName: name,
    extension: REQUEST_EXTENSION,
    content
  })
  // Çakışma nedeniyle ad değiştiyse dosya içindeki `name` da güncellenir.
  if (created.name !== name) {
    await writeRequestFile(created.path, { ...initial, name: created.name })
  }
  return { id: created.path, type: 'request', name: created.name, path: created.path }
}

export async function createFolder(parentPath: string, name: string): Promise<WorkspaceNode> {
  const created = await invoke<CreatedNode>('fs_create_dir', { parent: parentPath, name })
  return { id: created.path, type: 'folder', name: created.name, path: created.path, children: [] }
}

// İçe aktarma için: verilen ada göre slug'lanmış YENİ bir istek dosyası yazar (çakışmada
// benzersizleştirilir). Oluşturulan dosyanın yolunu döndürür.
export async function writeNewRequestFile(
  dir: string,
  name: string,
  data: RequestFile
): Promise<string> {
  const validated = RequestFileSchema.parse(data)
  const content = yaml.dump(validated, YAML_DUMP_OPTIONS)
  const created = await invoke<CreatedNode>('fs_create_file', {
    dir,
    baseName: name,
    extension: REQUEST_EXTENSION,
    content
  })
  return created.path
}

export async function deleteNode(path: string): Promise<void> {
  await invoke('fs_delete_path', { path })
}

export async function renameNode(path: string, newName: string): Promise<WorkspaceNode> {
  const renamed = await invoke<RenamedNode>('fs_rename_path', { path, newName })
  if (renamed.isRequest) {
    const data = await readRequestFile(renamed.path)
    await writeRequestFile(renamed.path, { ...data, name: newName })
  }
  return {
    id: renamed.path,
    type: renamed.isRequest ? 'request' : 'folder',
    name: newName,
    path: renamed.path
  }
}

// ---- Klasör meta (miras alınabilir ayarlar) ----

export async function readFolderMeta(folderPath: string): Promise<FolderMeta | null> {
  const path = joinPath(folderPath, FOLDER_META_FILENAME)
  if (!(await invoke<boolean>('fs_path_exists', { path }))) return null
  try {
    const raw = await invoke<string>('fs_read_text', { path })
    return FolderMetaSchema.parse(yaml.load(raw))
  } catch {
    return null
  }
}

export async function writeFolderMeta(folderPath: string, data: FolderMetaInput): Promise<void> {
  const validated = FolderMetaSchema.parse(data)
  const content = yaml.dump(validated, YAML_DUMP_OPTIONS)
  await invoke('fs_write_text', { path: joinPath(folderPath, FOLDER_META_FILENAME), content })
}

// ---- Ortamlar (environments) ----

export async function listEnvironments(root: string): Promise<EnvironmentSummary[]> {
  const paths = await invoke<string[]>('fs_list_dir_files', {
    dir: environmentsDir(root),
    extension: ENVIRONMENT_EXTENSION
  })
  const summaries: EnvironmentSummary[] = []
  for (const path of paths) {
    try {
      const data = await readEnvironment(path)
      summaries.push({ name: data.name, path })
    } catch {
      summaries.push({ name: basename(path, ENVIRONMENT_EXTENSION), path })
    }
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readEnvironment(path: string): Promise<EnvironmentFile> {
  const raw = await invoke<string>('fs_read_text', { path })
  return EnvironmentFileSchema.parse(yaml.load(raw))
}

export async function writeEnvironment(path: string, data: EnvironmentFile): Promise<void> {
  const validated = EnvironmentFileSchema.parse(data)
  const content = yaml.dump(validated, YAML_DUMP_OPTIONS)
  await invoke('fs_write_text', { path, content })
}

export async function createEnvironment(root: string, name: string): Promise<EnvironmentSummary> {
  const initial: EnvironmentFile = { schema: SCHEMA_VERSION, name, variables: {} }
  const content = yaml.dump(initial, YAML_DUMP_OPTIONS)
  const created = await invoke<CreatedNode>('fs_create_file', {
    dir: environmentsDir(root),
    baseName: name,
    extension: ENVIRONMENT_EXTENSION,
    content
  })
  if (created.name !== name) {
    await writeEnvironment(created.path, {
      schema: SCHEMA_VERSION,
      name: created.name,
      variables: {}
    })
  }
  return { name: created.name, path: created.path }
}

export async function deleteEnvironment(path: string): Promise<void> {
  await invoke('fs_delete_path', { path })
}

// ---- Miras (inheritance) ----

export interface InheritedSettings {
  auth?: Auth
  headers: KeyValue[]
}

// En yakın klasör en son uygulanır: header'larda aynı anahtar için yakın klasör kazanır,
// auth için de en yakın tanımlı (none olmayan) olan geçerlidir.
export async function resolveInheritedSettings(
  requestPath: string,
  root: string
): Promise<InheritedSettings> {
  const folders = await invoke<string[]>('fs_folder_chain', { requestPath, root })
  const headerMap = new Map<string, KeyValue>()
  let auth: Auth | undefined
  for (const folder of folders) {
    const meta = await readFolderMeta(folder)
    if (!meta) continue
    for (const header of meta.headers) headerMap.set(header.key, header)
    if (meta.auth && meta.auth.type !== 'none') auth = meta.auth
  }
  return { auth, headers: [...headerMap.values()] }
}

// ---- Dosya izleyici (Faz 3) ----

export function watchWorkspace(root: string): Promise<void> {
  return invoke('fs_watch_workspace', { root })
}

export function stopWatching(): Promise<void> {
  return invoke('fs_stop_watching')
}

// Aktif çalışma alanı dış değişikliklerde `workspace-changed` yayar. Kurulumda çağrılır,
// SENKRON bir "aboneliği iptal et" fonksiyonu döndürür (kurulum çökmesin).
export function onWorkspaceChanged(callback: (tree: WorkspaceNode) => void): () => void {
  let unlisten: UnlistenFn | undefined
  let cancelled = false
  listen<WorkspaceNode>('workspace-changed', (event) => callback(event.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}
