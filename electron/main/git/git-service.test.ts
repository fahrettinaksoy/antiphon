import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isGitRepo, initRepo, getStatus, stageFile, unstageFile, commit, getLog, diffFile } from './git-service'

describe('git-service', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-git-test-'))
  })

  it('reports not-a-repo before init, and a repo after', async () => {
    expect(await isGitRepo(dir)).toBe(false)
    await initRepo(dir)
    expect(await isGitRepo(dir)).toBe(true)
  })

  it('tracks the full status lifecycle: untracked -> staged -> committed -> modified', async () => {
    await initRepo(dir)
    await mkdir(join(dir, 'users'), { recursive: true })
    await writeFile(join(dir, 'users', 'list.req.yaml'), 'schema: 1\nname: List\nmethod: GET\nurl: https://x\n')

    let status = await getStatus(dir)
    expect(status.files).toHaveLength(1)
    expect(status.files[0].status).toBe('untracked')
    expect(status.files[0].staged).toBe(false)

    await stageFile(dir, 'users/list.req.yaml')
    status = await getStatus(dir)
    expect(status.files[0].status).toBe('added')
    expect(status.files[0].staged).toBe(true)

    const oid = await commit(dir, 'Add list request', 'Test Bot', 'bot@example.com')
    expect(oid).toBeTruthy()
    status = await getStatus(dir)
    expect(status.files).toHaveLength(0)

    await writeFile(join(dir, 'users', 'list.req.yaml'), 'schema: 1\nname: List\nmethod: POST\nurl: https://x\n')
    status = await getStatus(dir)
    expect(status.files[0].status).toBe('modified')
    expect(status.files[0].staged).toBe(false)
  })

  it('unstages a staged untracked file back to untracked', async () => {
    await initRepo(dir)
    await writeFile(join(dir, 'a.req.yaml'), 'schema: 1\nname: A\nmethod: GET\nurl: https://x\n')
    await stageFile(dir, 'a.req.yaml')
    let status = await getStatus(dir)
    expect(status.files[0].staged).toBe(true)

    await unstageFile(dir, 'a.req.yaml')
    status = await getStatus(dir)
    expect(status.files[0].staged).toBe(false)
    expect(status.files[0].status).toBe('untracked')
  })

  it('produces a unified diff between HEAD and the working directory', async () => {
    await initRepo(dir)
    await writeFile(join(dir, 'a.req.yaml'), 'method: GET\n')
    await stageFile(dir, 'a.req.yaml')
    await commit(dir, 'Initial', 'Test Bot', 'bot@example.com')

    await writeFile(join(dir, 'a.req.yaml'), 'method: POST\n')
    const diff = await diffFile(dir, 'a.req.yaml')
    expect(diff).toContain('-method: GET')
    expect(diff).toContain('+method: POST')
  })

  it('lists commit history with messages and authors', async () => {
    await initRepo(dir)
    await writeFile(join(dir, 'a.req.yaml'), 'x')
    await stageFile(dir, 'a.req.yaml')
    await commit(dir, 'First commit', 'Alice', 'alice@example.com')

    const log = await getLog(dir, 10)
    expect(log).toHaveLength(1)
    expect(log[0].message.trim()).toBe('First commit')
    expect(log[0].author).toBe('Alice')
  })
})
