// Çalışma alanı kayıt defteri istemcisi — Rust `registry_*` komutlarını çağırır.
//
// Rust kayıt defterini (workspaces.json + yönetilen dizinler) sahiplenir; ağaç kurma, isim
// atama ve izleyici başlatma burada (activate) birleştirilir. Uzak depolama (gist/webdav)
// orkestrasyonu (snapshot pull/push + secret) burada yürütülür.

import type {
  CreateWorkspaceInput,
  OpenWorkspaceResult,
  WorkspaceMetaDto,
  WorkspaceNode,
  WorkspaceSettingsOverrideDto,
  WorkspaceSyncDirection,
  WorkspaceUpdateInput
} from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'
import {
  applySnapshot,
  buildSnapshot,
  pullGist,
  pullWebdav,
  pushGist,
  pushWebdav
} from './storage-client'
import { buildWorkspaceTree, watchWorkspace } from './workspace-client'

// Vault çağrıları doğrudan invoke (settings-client ↔ registry-client döngüsünden kaçınmak için).
function gistTokenKey(id: string): string {
  return `ws-secret:${id}:gist-token`
}
function webdavPasswordKey(id: string): string {
  return `ws-secret:${id}:webdav-password`
}

function settingsPath(root: string): string {
  return `${root.replace(/[\\/]+$/, '')}/.antiphon/settings.json`
}

// Bir çalışma alanını etkinleştirir: izleyiciyi başlat, ağacı kur, kök adını kullanıcı
// dostu ada çevir (UUID/dizin adı yerine). Rust tarafı dizini zaten garanti eder.
async function activate(meta: WorkspaceMetaDto): Promise<WorkspaceNode> {
  await watchWorkspace(meta.localPath)
  const tree = await buildWorkspaceTree(meta.localPath)
  tree.name = meta.name
  return tree
}

export function listWorkspaces(): Promise<WorkspaceMetaDto[]> {
  return invoke<WorkspaceMetaDto[]>('registry_list')
}

export function getActiveWorkspaceId(): Promise<string | null> {
  return invoke<string | null>('registry_active_id')
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<OpenWorkspaceResult> {
  const meta = await invoke<WorkspaceMetaDto>('registry_create', { input })
  const storage = input.storage

  if (storage.kind === 'gist') {
    await invoke('vault_set', { key: gistTokenKey(meta.id), value: storage.token })
    if (storage.gistId) {
      const content = await pullGist(storage.token, storage.gistId)
      if (content) await applySnapshot(meta.localPath, JSON.parse(content))
    } else {
      const snapshot = await buildSnapshot(meta.localPath)
      const gistId = await pushGist(
        storage.token,
        null,
        JSON.stringify(snapshot),
        `Antiphon: ${input.name}`
      )
      await invoke('registry_set_storage', { id: meta.id, storage: { kind: 'gist', gistId } })
      meta.storage = { kind: 'gist', gistId }
    }
  } else if (storage.kind === 'webdav') {
    await invoke('vault_set', { key: webdavPasswordKey(meta.id), value: storage.password })
    const existing = await pullWebdav(storage.url, storage.username, storage.password)
    if (existing) {
      await applySnapshot(meta.localPath, JSON.parse(existing))
    } else {
      const snapshot = await buildSnapshot(meta.localPath)
      await pushWebdav(storage.url, storage.username, storage.password, JSON.stringify(snapshot))
    }
  }

  const tree = await activate(meta)
  return { meta, tree }
}

export async function openWorkspaceById(id: string): Promise<OpenWorkspaceResult | null> {
  const meta = await invoke<WorkspaceMetaDto | null>('registry_set_active', { id })
  if (!meta) return null
  const tree = await activate(meta)
  return { meta, tree }
}

export async function deleteWorkspace(id: string): Promise<WorkspaceMetaDto[]> {
  // Uzak depolama secret'larını en-iyi-çaba ile temizle.
  await invoke('vault_delete', { key: gistTokenKey(id) }).catch(() => undefined)
  await invoke('vault_delete', { key: webdavPasswordKey(id) }).catch(() => undefined)
  return invoke<WorkspaceMetaDto[]>('registry_delete', { id })
}

export function renameWorkspace(id: string, name: string): Promise<void> {
  return invoke('registry_rename', { id, name })
}

export function updateWorkspace(id: string, patch: WorkspaceUpdateInput): Promise<void> {
  return invoke('registry_update', { id, patch })
}

// Uzak depolamalı çalışma alanını uzaktakiyle senkronlar. 'push' = yerel→uzak, 'pull' =
// uzak→yerel. Yerel depolamada no-op. Sonra ağaç yeniden kurulup döndürülür.
export async function syncWorkspace(
  id: string,
  direction: WorkspaceSyncDirection
): Promise<WorkspaceNode | null> {
  const meta = await invoke<WorkspaceMetaDto | null>('registry_get', { id })
  if (!meta) return null
  const storage = meta.storage

  if (storage.kind === 'gist') {
    const token = await invoke<string | null>('vault_get', { key: gistTokenKey(id) })
    if (!token) throw new Error('GitHub token bulunamadı')
    if (direction === 'push') {
      const snapshot = await buildSnapshot(meta.localPath)
      const gistId = await pushGist(
        token,
        storage.gistId,
        JSON.stringify(snapshot),
        `Antiphon: ${meta.name}`
      )
      if (gistId !== storage.gistId) {
        await invoke('registry_set_storage', { id, storage: { kind: 'gist', gistId } })
      }
    } else {
      if (!storage.gistId) throw new Error('Gist kimliği yok')
      const content = await pullGist(token, storage.gistId)
      if (content) await applySnapshot(meta.localPath, JSON.parse(content))
    }
  } else if (storage.kind === 'webdav') {
    const password = await invoke<string | null>('vault_get', { key: webdavPasswordKey(id) })
    if (!password) throw new Error('WebDAV parolası bulunamadı')
    if (direction === 'push') {
      const snapshot = await buildSnapshot(meta.localPath)
      await pushWebdav(storage.url, storage.username, password, JSON.stringify(snapshot))
    } else {
      const content = await pullWebdav(storage.url, storage.username, password)
      if (content) await applySnapshot(meta.localPath, JSON.parse(content))
    }
  }

  const tree = await buildWorkspaceTree(meta.localPath)
  tree.name = meta.name
  return tree
}

// ---- Çalışma alanı ayar geçersizkılması (.antiphon/settings.json) ----

export async function getWorkspaceSettingsOverride(
  root: string
): Promise<WorkspaceSettingsOverrideDto> {
  const path = settingsPath(root)
  if (!(await invoke<boolean>('fs_path_exists', { path }))) return {}
  try {
    const raw = await invoke<string>('fs_read_text', { path })
    return JSON.parse(raw) as WorkspaceSettingsOverrideDto
  } catch {
    return {}
  }
}

export async function setWorkspaceSettingsOverride(
  root: string,
  override: WorkspaceSettingsOverrideDto
): Promise<void> {
  await invoke('fs_write_text', {
    path: settingsPath(root),
    content: JSON.stringify(override, null, 2)
  })
}
