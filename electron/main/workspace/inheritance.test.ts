import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFolder, createRequestFile, writeFolderMeta } from './workspace-service'
import { resolveInheritedSettings } from './inheritance'

describe('resolveInheritedSettings', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-inherit-test-'))
  })

  it('returns empty settings when no folder.meta.yaml exists', async () => {
    const node = await createRequestFile(dir, 'Ping')
    const result = await resolveInheritedSettings(node.path, dir)
    expect(result.headers).toEqual([])
    expect(result.auth).toBeUndefined()
  })

  it('inherits auth and headers from the immediate parent folder', async () => {
    const folder = await createFolder(dir, 'api')
    await writeFolderMeta(folder.path, {
      schema: 1,
      auth: { type: 'bearer', token: 'folder-token' },
      headers: [{ key: 'X-Trace', value: 'from-folder', enabled: true }]
    })
    const node = await createRequestFile(folder.path, 'List Users')

    const result = await resolveInheritedSettings(node.path, dir)
    expect(result.auth).toEqual({ type: 'bearer', token: 'folder-token' })
    expect(result.headers.find((h) => h.key === 'X-Trace')?.value).toBe('from-folder')
  })

  it('lets the nearest ancestor folder win over a farther one', async () => {
    const outer = await createFolder(dir, 'api')
    await writeFolderMeta(outer.path, {
      schema: 1,
      auth: { type: 'bearer', token: 'outer-token' },
      headers: [{ key: 'X-Trace', value: 'from-outer', enabled: true }]
    })
    const inner = await createFolder(outer.path, 'users')
    await writeFolderMeta(inner.path, {
      schema: 1,
      headers: [{ key: 'X-Trace', value: 'from-inner', enabled: true }]
    })
    const node = await createRequestFile(inner.path, 'List Users')

    const result = await resolveInheritedSettings(node.path, dir)
    // auth only defined on the outer folder, so it still applies
    expect(result.auth).toEqual({ type: 'bearer', token: 'outer-token' })
    // header defined on both: nearest (inner) wins
    expect(result.headers.find((h) => h.key === 'X-Trace')?.value).toBe('from-inner')
  })
})
