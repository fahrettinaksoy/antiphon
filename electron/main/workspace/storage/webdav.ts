// WebDAV deposu: çalışma alanı anlık görüntüsü, verilen WebDAV dizinindeki tek bir
// dosyaya PUT/GET edilir. Parola OS keychain'de (secret vault) saklanır.
const SNAPSHOT_FILENAME = 'antiphon-workspace.json'

function snapshotUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${SNAPSHOT_FILENAME}`
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export async function pushWebdav(
  url: string,
  username: string,
  password: string,
  content: string
): Promise<void> {
  const res = await fetch(snapshotUrl(url), {
    method: 'PUT',
    headers: { Authorization: basicAuth(username, password), 'Content-Type': 'application/json' },
    body: content
  })
  // WebDAV PUT: 200/201 (oluşturuldu) veya 204 (güncellendi).
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`WebDAV gönderimi başarısız (${res.status}): ${await res.text()}`)
  }
}

export async function pullWebdav(url: string, username: string, password: string): Promise<string | null> {
  const res = await fetch(snapshotUrl(url), {
    method: 'GET',
    headers: { Authorization: basicAuth(username, password) }
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`WebDAV okuması başarısız (${res.status}): ${await res.text()}`)
  }
  return res.text()
}
