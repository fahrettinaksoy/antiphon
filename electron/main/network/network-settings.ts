import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export interface ClientCertificateEntry {
  id: string
  hostPattern: string
  certPem: string
  keyPem: string
  passphrase: string
}

export interface NetworkSettings {
  proxyEnabled: boolean
  proxyUrl: string
  customCaPem: string
  clientCertificates: ClientCertificateEntry[]
  rejectUnauthorized: boolean
  cookieJarEnabled: boolean
}

const DEFAULT_SETTINGS: NetworkSettings = {
  proxyEnabled: false,
  proxyUrl: '',
  customCaPem: '',
  clientCertificates: [],
  rejectUnauthorized: true,
  cookieJarEnabled: true
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'network-settings.json')
}

export async function getNetworkSettings(): Promise<NetworkSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function setNetworkSettings(settings: NetworkSettings): Promise<void> {
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2), 'utf8')
}

// Host eşleşmesi: tam eşleşme, `*` (tümü) veya `*.example.com` alt alan adı joker karakteri.
export function matchesHostPattern(hostname: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1) // ".example.com"
    return hostname.endsWith(suffix) || hostname === pattern.slice(2)
  }
  return hostname === pattern
}

export function findClientCertificate(settings: NetworkSettings, hostname: string): ClientCertificateEntry | undefined {
  return settings.clientCertificates.find((entry) => matchesHostPattern(hostname, entry.hostPattern))
}
