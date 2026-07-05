import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildWorkspaceTree,
  createFolder,
  createRequestFile,
  readRequestFile,
  writeRequestFile,
  renameNode,
  deleteNode,
  listRequestFilesRecursive,
  readFolderMeta,
  writeFolderMeta,
  slugify
} from './workspace-service'

describe('slugify', () => {
  it('lowercases and hyphenates names', () => {
    expect(slugify('Kullanıcı Listele')).toBe('kullanıcı-listele')
  })

  it('falls back to a generated name for empty input', () => {
    expect(slugify('   ')).toMatch(/^request-/)
  })
})

describe('workspace-service file CRUD', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-ws-test-'))
  })

  it('creates a request file with sensible defaults', async () => {
    const node = await createRequestFile(dir, 'List Users')
    expect(node.type).toBe('request')
    const file = await readRequestFile(node.path)
    expect(file.name).toBe('List Users')
    expect(file.method).toBe('GET')
    expect(file.auth).toEqual({ type: 'none' })
  })

  it('round-trips edits through write and read', async () => {
    const node = await createRequestFile(dir, 'Ping')
    const file = await readRequestFile(node.path)
    file.method = 'POST'
    file.url = 'https://api.example.com/ping'
    file.headers.push({ key: 'Content-Type', value: 'application/json', enabled: true })
    await writeRequestFile(node.path, file)

    const reread = await readRequestFile(node.path)
    expect(reread.method).toBe('POST')
    expect(reread.url).toBe('https://api.example.com/ping')
    expect(reread.headers).toHaveLength(1)
  })

  it('renames a request file and updates its internal name field', async () => {
    const node = await createRequestFile(dir, 'Old Name')
    const renamed = await renameNode(node.path, 'New Name')
    const file = await readRequestFile(renamed.path)
    expect(file.name).toBe('New Name')
  })

  it('lists all request files recursively across nested folders', async () => {
    const sub = await createFolder(dir, 'users')
    await createRequestFile(dir, 'Root Request')
    await createRequestFile(sub.path, 'Nested Request')

    const paths = await listRequestFilesRecursive(dir)
    expect(paths).toHaveLength(2)
  })

  it('builds a workspace tree reflecting folders and requests', async () => {
    const sub = await createFolder(dir, 'users')
    await createRequestFile(sub.path, 'List Users')

    const tree = await buildWorkspaceTree(dir)
    expect(tree.type).toBe('folder')
    expect(tree.children).toHaveLength(1)
    expect(tree.children?.[0].type).toBe('folder')
    expect(tree.children?.[0].children).toHaveLength(1)
    expect(tree.children?.[0].children?.[0].name).toBe('List Users')
  })

  it('excludes the reserved "environments" directory from the tree', async () => {
    await createFolder(dir, 'environments')
    const tree = await buildWorkspaceTree(dir)
    expect(tree.children).toHaveLength(0)
  })

  it('deletes a folder and its contents', async () => {
    const sub = await createFolder(dir, 'temp')
    await createRequestFile(sub.path, 'Doomed')
    await deleteNode(sub.path)

    const tree = await buildWorkspaceTree(dir)
    expect(tree.children).toHaveLength(0)
  })

  it('reads and writes folder metadata (inheritable auth/headers)', async () => {
    const sub = await createFolder(dir, 'api')
    expect(await readFolderMeta(sub.path)).toBeNull()

    await writeFolderMeta(sub.path, {
      schema: 1,
      auth: { type: 'bearer', token: 'folder-token' },
      headers: [{ key: 'X-Trace', value: '1', enabled: true }]
    })

    const meta = await readFolderMeta(sub.path)
    expect(meta?.auth).toEqual({ type: 'bearer', token: 'folder-token' })
    expect(meta?.headers).toHaveLength(1)
  })
})
