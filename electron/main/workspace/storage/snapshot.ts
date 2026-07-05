import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, relative, dirname, sep } from 'node:path'

// Uzak depolama (Gist/WebDAV) için çalışma alanının tüm dosya ağacını tek bir JSON
// "anlık görüntüye" (snapshot) serileştirir. Gist düz dosya listesi olduğundan (klasör
// yok) ve WebDAV için tek dosyalık senkron basit/güvenilir olduğundan bu model seçildi.
export interface WorkspaceSnapshot {
  schema: 1
  files: Record<string, string> // posix göreli yol -> içerik
}

function isIgnoredSegment(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules' || name.includes('.tmp-')
}

async function collect(root: string, current: string, out: Record<string, string>): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (isIgnoredSegment(entry.name)) continue
    const full = join(current, entry.name)
    if (entry.isDirectory()) {
      await collect(root, full, out)
    } else {
      const rel = relative(root, full).split(sep).join('/')
      out[rel] = await readFile(full, 'utf8')
    }
  }
}

export async function buildSnapshot(root: string): Promise<WorkspaceSnapshot> {
  const files: Record<string, string> = {}
  await collect(root, root, files)
  return { schema: 1, files }
}

export function parseSnapshot(content: string): WorkspaceSnapshot {
  const parsed = JSON.parse(content) as WorkspaceSnapshot
  if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object') {
    throw new Error('Geçersiz çalışma alanı anlık görüntüsü')
  }
  return parsed
}

// Yereldeki (gizli olmayan) içeriği uzaktakiyle değiştirir. `.git`, `secrets` gibi nokta
// ile başlayan dosya/klasörlere dokunulmaz.
export async function applySnapshot(root: string, snapshot: WorkspaceSnapshot): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    await rm(join(root, entry.name), { recursive: true, force: true })
  }
  for (const [rel, content] of Object.entries(snapshot.files)) {
    if (rel.split('/').some((seg) => seg === '..' || seg === '')) continue
    const dest = join(root, rel)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, content, 'utf8')
  }
}
