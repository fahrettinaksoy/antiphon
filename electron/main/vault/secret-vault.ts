import { app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

interface SecretStoreFile {
  [key: string]: string // base64-encoded, safeStorage-encrypted (or plain, if unavailable)
}

function storePath(): string {
  return join(app.getPath('userData'), 'secrets.vault.json')
}

async function readStore(): Promise<SecretStoreFile> {
  try {
    const raw = await readFile(storePath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeStore(store: SecretStoreFile): Promise<void> {
  const path = storePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(store, null, 2), 'utf8')
}

export async function setSecret(key: string, value: string): Promise<void> {
  const store = await readStore()
  store[key] = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value).toString('base64')
    : Buffer.from(value, 'utf8').toString('base64')
  await writeStore(store)
}

export async function getSecret(key: string): Promise<string | undefined> {
  const store = await readStore()
  const stored = store[key]
  if (stored === undefined) return undefined

  const buffer = Buffer.from(stored, 'base64')
  return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buffer) : buffer.toString('utf8')
}

export async function listSecretKeys(): Promise<string[]> {
  return Object.keys(await readStore())
}

export async function deleteSecret(key: string): Promise<void> {
  const store = await readStore()
  delete store[key]
  await writeStore(store)
}
