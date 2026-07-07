import { app } from 'electron'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CreateWorkspaceInput,
  WorkspaceMetaDto,
  WorkspaceSyncDirection,
  WorkspaceUpdateInput
} from '@shared/ipc-contract'
import { getSecret, setSecret, deleteSecret } from '../vault/secret-vault'
import { buildSnapshot, applySnapshot, parseSnapshot } from './storage/snapshot'
import { pushGist, pullGist } from './storage/gist'
import { pushWebdav, pullWebdav } from './storage/webdav'

interface RegistryFile {
  activeId: string | null
  workspaces: WorkspaceMetaDto[]
}

const DEFAULT_WORKSPACE_NAME = 'My Workspace'

function registryPath(): string {
  return join(app.getPath('userData'), 'workspaces.json')
}
function workspacesDir(): string {
  return join(app.getPath('userData'), 'workspaces')
}
function managedPath(id: string): string {
  return join(workspacesDir(), id)
}
function gistTokenKey(id: string): string {
  return `ws-secret:${id}:gist-token`
}
function webdavPasswordKey(id: string): string {
  return `ws-secret:${id}:webdav-password`
}

async function readRegistry(): Promise<RegistryFile> {
  try {
    const raw = await readFile(registryPath(), 'utf8')
    const parsed = JSON.parse(raw) as RegistryFile
    if (!Array.isArray(parsed.workspaces)) return { activeId: null, workspaces: [] }
    return parsed
  } catch {
    return { activeId: null, workspaces: [] }
  }
}

async function writeRegistry(reg: RegistryFile): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(registryPath(), JSON.stringify(reg, null, 2), 'utf8')
}

// Her zaman en az bir yerel çalışma alanı ("My Workspace") bulunmasını garanti eder ve
// geçerli bir aktif kimlik (activeId) olduğundan emin olur.
export async function ensureDefaultWorkspace(): Promise<RegistryFile> {
  const reg = await readRegistry()
  if (reg.workspaces.length === 0) {
    const id = randomUUID()
    const localPath = managedPath(id)
    await mkdir(localPath, { recursive: true })
    const now = Date.now()
    reg.workspaces.push({
      id,
      name: DEFAULT_WORKSPACE_NAME,
      type: 'personal',
      storage: { kind: 'local' },
      localPath,
      isDefault: true,
      createdAt: now,
      lastOpenedAt: now
    })
    reg.activeId = id
    await writeRegistry(reg)
  } else if (!reg.activeId || !reg.workspaces.some((w) => w.id === reg.activeId)) {
    reg.activeId = reg.workspaces[0].id
    await writeRegistry(reg)
  }
  return reg
}

export async function listWorkspaces(): Promise<WorkspaceMetaDto[]> {
  return (await ensureDefaultWorkspace()).workspaces
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  return (await ensureDefaultWorkspace()).activeId
}

export async function getWorkspace(id: string): Promise<WorkspaceMetaDto | null> {
  const reg = await ensureDefaultWorkspace()
  return reg.workspaces.find((w) => w.id === id) ?? null
}

// Çalışma alanının yerel dizininin var olduğundan emin olur (dışarıdan silinmiş
// veya hiç oluşturulmamışsa yeniden yaratır) — böylece açılışta ENOENT alınmaz.
export async function ensureWorkspaceDir(meta: WorkspaceMetaDto): Promise<void> {
  await mkdir(meta.localPath, { recursive: true })
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceMetaDto> {
  const reg = await ensureDefaultWorkspace()
  const id = randomUUID()
  const now = Date.now()
  let localPath: string
  let storage: WorkspaceMetaDto['storage']

  if (input.storage.kind === 'local') {
    // "Mevcut klasörden başla" veya "sıfırdan başla" (yönetilen dizin).
    if (input.storage.sourceFolder) {
      localPath = input.storage.sourceFolder
    } else {
      localPath = managedPath(id)
      await mkdir(localPath, { recursive: true })
    }
    storage = { kind: 'local' }
  } else if (input.storage.kind === 'gist') {
    localPath = managedPath(id)
    await mkdir(localPath, { recursive: true })
    await setSecret(gistTokenKey(id), input.storage.token)
    let gistId = input.storage.gistId ?? null
    if (gistId) {
      const content = await pullGist(input.storage.token, gistId)
      if (content) await applySnapshot(localPath, parseSnapshot(content))
    } else {
      const snapshot = await buildSnapshot(localPath)
      gistId = await pushGist(input.storage.token, null, JSON.stringify(snapshot), `Antiphon: ${input.name}`)
    }
    storage = { kind: 'gist', gistId }
  } else {
    localPath = managedPath(id)
    await mkdir(localPath, { recursive: true })
    await setSecret(webdavPasswordKey(id), input.storage.password)
    const existing = await pullWebdav(input.storage.url, input.storage.username, input.storage.password)
    if (existing) {
      await applySnapshot(localPath, parseSnapshot(existing))
    } else {
      const snapshot = await buildSnapshot(localPath)
      await pushWebdav(input.storage.url, input.storage.username, input.storage.password, JSON.stringify(snapshot))
    }
    storage = { kind: 'webdav', url: input.storage.url, username: input.storage.username }
  }

  const meta: WorkspaceMetaDto = {
    id,
    name: input.name,
    type: input.type,
    storage,
    localPath,
    isDefault: false,
    createdAt: now,
    lastOpenedAt: now
  }
  reg.workspaces.push(meta)
  reg.activeId = id
  await writeRegistry(reg)
  return meta
}

export async function deleteWorkspace(id: string): Promise<WorkspaceMetaDto[]> {
  const reg = await ensureDefaultWorkspace()
  const target = reg.workspaces.find((w) => w.id === id)
  if (!target) return reg.workspaces
  if (target.isDefault) throw new Error('Varsayılan çalışma alanı silinemez')

  // Yalnızca uygulamanın yönettiği dizinleri sil; kullanıcının kendi klasörüne dokunma.
  if (target.localPath.startsWith(workspacesDir())) {
    await rm(target.localPath, { recursive: true, force: true }).catch(() => undefined)
  }
  await deleteSecret(gistTokenKey(id)).catch(() => undefined)
  await deleteSecret(webdavPasswordKey(id)).catch(() => undefined)

  reg.workspaces = reg.workspaces.filter((w) => w.id !== id)
  if (reg.activeId === id) reg.activeId = reg.workspaces[0]?.id ?? null
  await writeRegistry(reg)
  return reg.workspaces
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const reg = await ensureDefaultWorkspace()
  const target = reg.workspaces.find((w) => w.id === id)
  if (target) {
    target.name = name
    await writeRegistry(reg)
  }
}

// Ad ve/veya görünürlük güncellemesi (Çalışma Alanını Düzenle diyaloğu).
export async function updateWorkspace(id: string, patch: WorkspaceUpdateInput): Promise<void> {
  const reg = await ensureDefaultWorkspace()
  const target = reg.workspaces.find((w) => w.id === id)
  if (!target) return
  if (patch.name?.trim()) target.name = patch.name.trim()
  if (patch.type) target.type = patch.type
  await writeRegistry(reg)
}

export async function setActiveWorkspace(id: string): Promise<WorkspaceMetaDto | null> {
  const reg = await ensureDefaultWorkspace()
  const target = reg.workspaces.find((w) => w.id === id)
  if (!target) return null
  target.lastOpenedAt = Date.now()
  reg.activeId = id
  await writeRegistry(reg)
  return target
}

// Uzak depolamalı çalışma alanlarını uzaktakiyle senkronlar. 'push' = yerel → uzak,
// 'pull' = uzak → yerel. Yerel depolamalı alanlarda no-op'tur.
export async function syncWorkspace(id: string, direction: WorkspaceSyncDirection): Promise<void> {
  const meta = await getWorkspace(id)
  if (!meta) throw new Error('Çalışma alanı bulunamadı')
  if (meta.storage.kind === 'local') return
  await ensureWorkspaceDir(meta)

  if (meta.storage.kind === 'gist') {
    const token = await getSecret(gistTokenKey(id))
    if (!token) throw new Error('GitHub token bulunamadı')
    if (direction === 'push') {
      const snapshot = await buildSnapshot(meta.localPath)
      const newGistId = await pushGist(token, meta.storage.gistId, JSON.stringify(snapshot), `Antiphon: ${meta.name}`)
      if (newGistId !== meta.storage.gistId) {
        const reg = await readRegistry()
        const t = reg.workspaces.find((w) => w.id === id)
        if (t && t.storage.kind === 'gist') {
          t.storage.gistId = newGistId
          await writeRegistry(reg)
        }
      }
    } else {
      if (!meta.storage.gistId) throw new Error('Gist kimliği yok')
      const content = await pullGist(token, meta.storage.gistId)
      if (content) await applySnapshot(meta.localPath, parseSnapshot(content))
    }
  } else {
    const password = await getSecret(webdavPasswordKey(id))
    if (!password) throw new Error('WebDAV parolası bulunamadı')
    if (direction === 'push') {
      const snapshot = await buildSnapshot(meta.localPath)
      await pushWebdav(meta.storage.url, meta.storage.username, password, JSON.stringify(snapshot))
    } else {
      const content = await pullWebdav(meta.storage.url, meta.storage.username, password)
      if (content) await applySnapshot(meta.localPath, parseSnapshot(content))
    }
  }
}
