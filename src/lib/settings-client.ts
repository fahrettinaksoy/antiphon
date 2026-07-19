// Secret vault + ağ ayarları + çerez istemcisi.
//
// Vault Rust'ta (OS anahtar zinciri); ağ ayarları app veri dizininde JSON (varsayılan
// birleştirme + host-eşlemeli istemci sertifikası seçimi burada).

import type { CookieSummaryDto, NetworkSettingsDto } from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'
import { getWorkspaceSettingsOverride } from './registry-client'

const NETWORK_SETTINGS_FILE = 'network-settings.json'

const DEFAULT_NETWORK_SETTINGS: NetworkSettingsDto = {
  proxyEnabled: false,
  proxyUrl: '',
  customCaPem: '',
  clientCertificates: [],
  rejectUnauthorized: true,
  cookieJarEnabled: true
}

// ---- Secret vault ----

export function getSecret(key: string): Promise<string | undefined> {
  return invoke<string | null>('vault_get', { key }).then((v) => v ?? undefined)
}

export function setSecret(key: string, value: string): Promise<void> {
  return invoke('vault_set', { key, value })
}

export function listSecretKeys(): Promise<string[]> {
  return invoke<string[]>('vault_list')
}

export function deleteSecret(key: string): Promise<void> {
  return invoke('vault_delete', { key })
}

// ---- Ağ ayarları ----

export async function getNetworkSettings(): Promise<NetworkSettingsDto> {
  const raw = await invoke<string | null>('appdata_read', { name: NETWORK_SETTINGS_FILE })
  if (!raw) return { ...DEFAULT_NETWORK_SETTINGS }
  try {
    return { ...DEFAULT_NETWORK_SETTINGS, ...(JSON.parse(raw) as Partial<NetworkSettingsDto>) }
  } catch {
    return { ...DEFAULT_NETWORK_SETTINGS }
  }
}

export function setNetworkSettings(settings: NetworkSettingsDto): Promise<void> {
  return invoke('appdata_write', {
    name: NETWORK_SETTINGS_FILE,
    content: JSON.stringify(settings, null, 2)
  })
}

// ---- Bir host için çözülmüş ağ ayarları (global + workspace override) ----

export interface EffectiveNetwork {
  proxyUrl?: string
  caPem?: string
  clientCertPem?: string
  clientKeyPem?: string
  verifySsl: boolean
  cookieJar: boolean
}

// Host eşleşmesi: tam eşleşme, `*` (tümü) veya `*.example.com` alt alan adı joker karakteri.
function matchesHostPattern(hostname: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1)
    return hostname.endsWith(suffix) || hostname === pattern.slice(2)
  }
  return hostname === pattern
}

// Global ayarlar + (varsa) workspace override alan-bazlı birleştirilir; host'a uyan istemci
// sertifikası seçilir. http_send'e geçirilecek somut değerleri döndürür.
export async function resolveNetwork(
  hostname: string,
  workspaceRoot?: string
): Promise<EffectiveNetwork> {
  const global = await getNetworkSettings()
  const override = workspaceRoot
    ? (await getWorkspaceSettingsOverride(workspaceRoot)).networkSettings
    : undefined
  const s: NetworkSettingsDto = { ...global, ...(override ?? {}) }
  const cert = s.clientCertificates.find((c) => matchesHostPattern(hostname, c.hostPattern))
  return {
    proxyUrl: s.proxyEnabled && s.proxyUrl ? s.proxyUrl : undefined,
    caPem: s.customCaPem || undefined,
    clientCertPem: cert?.certPem,
    clientKeyPem: cert?.keyPem,
    verifySsl: s.rejectUnauthorized,
    cookieJar: s.cookieJarEnabled
  }
}

// ---- Çerezler (gerçek — Rust cookie_store) ----

export function listCookies(): Promise<CookieSummaryDto[]> {
  return invoke<CookieSummaryDto[]>('cookie_list')
}

export function clearCookies(): Promise<void> {
  return invoke('cookie_clear')
}
