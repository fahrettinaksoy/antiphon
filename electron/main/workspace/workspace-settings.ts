import { readFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { NetworkSettings } from '../network/network-settings'
import { atomicWriteFile, pathExists } from './workspace-service'

export interface GitIdentityOverride {
  name: string
  email: string
}

export interface WorkspaceSettingsOverride {
  networkSettings?: Partial<NetworkSettings>
  gitIdentity?: GitIdentityOverride
}

const SETTINGS_RELATIVE_PATH = join('.antiphon', 'settings.json')

function settingsPath(workspaceRoot: string): string {
  return join(workspaceRoot, SETTINGS_RELATIVE_PATH)
}

export async function getWorkspaceSettingsOverride(workspaceRoot: string): Promise<WorkspaceSettingsOverride> {
  const path = settingsPath(workspaceRoot)
  if (!(await pathExists(path))) return {}
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as WorkspaceSettingsOverride
  } catch {
    return {}
  }
}

export async function setWorkspaceSettingsOverride(workspaceRoot: string, override: WorkspaceSettingsOverride): Promise<void> {
  const path = settingsPath(workspaceRoot)
  await mkdir(dirname(path), { recursive: true })
  await atomicWriteFile(path, JSON.stringify(override, null, 2))
}

// Workspace override alanları, tanımlıysa global ayarların üzerine yazar (alan-bazlı, tam obje değil).
export function mergeNetworkSettings(global: NetworkSettings, override: Partial<NetworkSettings> | undefined): NetworkSettings {
  if (!override) return global
  return { ...global, ...override }
}
