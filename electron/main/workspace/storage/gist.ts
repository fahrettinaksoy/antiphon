// GitHub Gist deposu: çalışma alanı anlık görüntüsü, gizli (secret) bir gist içindeki
// tek bir dosyada tutulur. Token OS keychain'de (secret vault) saklanır.
const GIST_API = 'https://api.github.com'
const SNAPSHOT_FILENAME = 'antiphon-workspace.json'

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Antiphon',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

interface GistResponse {
  id: string
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>
}

export async function pushGist(
  token: string,
  gistId: string | null,
  content: string,
  description: string
): Promise<string> {
  const url = gistId ? `${GIST_API}/gists/${gistId}` : `${GIST_API}/gists`
  const res = await fetch(url, {
    method: gistId ? 'PATCH' : 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, public: false, files: { [SNAPSHOT_FILENAME]: { content } } })
  })
  if (!res.ok) {
    throw new Error(`GitHub Gist gönderimi başarısız (${res.status}): ${await res.text()}`)
  }
  const json = (await res.json()) as GistResponse
  return json.id
}

export async function pullGist(token: string, gistId: string): Promise<string | null> {
  const res = await fetch(`${GIST_API}/gists/${gistId}`, { headers: authHeaders(token) })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`GitHub Gist okuması başarısız (${res.status}): ${await res.text()}`)
  }
  const json = (await res.json()) as GistResponse
  const file = json.files[SNAPSHOT_FILENAME]
  if (!file) return null
  // Gist 1MB üzerinde içeriği kırpar; ham URL'den tam içeriği çek.
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url, { headers: authHeaders(token) })
    if (!raw.ok) throw new Error(`Gist ham içerik okuması başarısız (${raw.status})`)
    return raw.text()
  }
  return file.content ?? null
}
