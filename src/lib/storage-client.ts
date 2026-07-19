// Uzak depolama istemcisi (gist/webdav) — snapshot + HTTP.
//
// HTTP webview CSP'sini değil Rust `http_send`'i geçer (dış host'lar için browser fetch
// engelli). Snapshot dosya I/O'su Rust'ta (fs_snapshot/fs_apply_snapshot). Token/parola vault'ta.

import { invoke } from '@tauri-apps/api/core'
import { utf8ToBase64 } from './runtime'

const GIST_API = 'https://api.github.com'
const SNAPSHOT_FILENAME = 'antiphon-workspace.json'

interface RawResponse {
  status: number
  body: string
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64)
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

// Dış host'a HTTP — Rust http_send üzerinden (CSP connect-src 'self' bypass).
async function rawHttp(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string
): Promise<RawResponse> {
  const res = await invoke<{ status: number; bodyBase64: string }>('http_send', {
    req: {
      method,
      url,
      headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
      bodyBase64: body !== undefined ? utf8ToBase64(body) : undefined,
      followRedirects: true,
      verifySsl: true
    }
  })
  return { status: res.status, body: base64ToUtf8(res.bodyBase64) }
}

function ok(status: number): boolean {
  return status >= 200 && status < 300
}

// ---- Snapshot (Rust fs) ----

export function buildSnapshot(root: string): Promise<unknown> {
  return invoke('fs_snapshot', { root })
}

export function applySnapshot(root: string, snapshot: unknown): Promise<void> {
  return invoke('fs_apply_snapshot', { root, snapshot })
}

// ---- GitHub Gist ----

function gistHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Antiphon',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

export async function pushGist(
  token: string,
  gistId: string | null,
  content: string,
  description: string
): Promise<string> {
  const url = gistId ? `${GIST_API}/gists/${gistId}` : `${GIST_API}/gists`
  const res = await rawHttp(
    gistId ? 'PATCH' : 'POST',
    url,
    { ...gistHeaders(token), 'Content-Type': 'application/json' },
    JSON.stringify({ description, public: false, files: { [SNAPSHOT_FILENAME]: { content } } })
  )
  if (!ok(res.status))
    throw new Error(`GitHub Gist gönderimi başarısız (${res.status}): ${res.body}`)
  return (JSON.parse(res.body) as { id: string }).id
}

export async function pullGist(token: string, gistId: string): Promise<string | null> {
  const res = await rawHttp('GET', `${GIST_API}/gists/${gistId}`, gistHeaders(token))
  if (res.status === 404) return null
  if (!ok(res.status)) throw new Error(`GitHub Gist okuması başarısız (${res.status}): ${res.body}`)
  const json = JSON.parse(res.body) as {
    files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>
  }
  const file = json.files[SNAPSHOT_FILENAME]
  if (!file) return null
  // Gist 1MB üzerinde içeriği kırpar; ham URL'den tam içeriği çek.
  if (file.truncated && file.raw_url) {
    const raw = await rawHttp('GET', file.raw_url, gistHeaders(token))
    if (!ok(raw.status)) throw new Error(`Gist ham içerik okuması başarısız (${raw.status})`)
    return raw.body
  }
  return file.content ?? null
}

// ---- WebDAV ----

function snapshotUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${SNAPSHOT_FILENAME}`
}

function basicAuth(username: string, password: string): string {
  return `Basic ${utf8ToBase64(`${username}:${password}`)}`
}

export async function pushWebdav(
  url: string,
  username: string,
  password: string,
  content: string
): Promise<void> {
  const res = await rawHttp(
    'PUT',
    snapshotUrl(url),
    { Authorization: basicAuth(username, password), 'Content-Type': 'application/json' },
    content
  )
  if (!ok(res.status) && res.status !== 201 && res.status !== 204) {
    throw new Error(`WebDAV gönderimi başarısız (${res.status}): ${res.body}`)
  }
}

export async function pullWebdav(
  url: string,
  username: string,
  password: string
): Promise<string | null> {
  const res = await rawHttp('GET', snapshotUrl(url), {
    Authorization: basicAuth(username, password)
  })
  if (res.status === 404) return null
  if (!ok(res.status)) throw new Error(`WebDAV okuması başarısız (${res.status}): ${res.body}`)
  return res.body
}
