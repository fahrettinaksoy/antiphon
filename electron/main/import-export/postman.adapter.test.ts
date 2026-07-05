import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importPostmanCollection } from './postman.adapter'
import { buildWorkspaceTree, readRequestFile } from '../workspace/workspace-service'

describe('importPostmanCollection', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-postman-test-'))
  })

  it('imports nested folders and requests, preserving auth and body', async () => {
    const collection = {
      info: { name: 'Sample' },
      item: [
        {
          name: 'Auth',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                url: { raw: 'https://api.example.com/login' },
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: { mode: 'raw', raw: '{"user":"a"}', options: { raw: { language: 'json' } } },
                auth: { type: 'bearer', bearer: [{ key: 'token', value: 'abc123' }] }
              }
            }
          ]
        },
        { name: 'Ping', request: { method: 'GET', url: { raw: 'https://api.example.com/ping' } } }
      ]
    }

    const result = await importPostmanCollection(JSON.stringify(collection), dir)
    expect(result.importedCount).toBe(2)
    expect(result.skipped).toEqual([])

    const tree = await buildWorkspaceTree(dir)
    const authFolder = tree.children?.find((c) => c.name === 'auth')
    expect(authFolder).toBeDefined()
    expect(authFolder?.children).toHaveLength(1)

    const loginFile = await readRequestFile(authFolder!.children![0].path)
    expect(loginFile.method).toBe('POST')
    expect(loginFile.auth).toEqual({ type: 'bearer', token: 'abc123' })
    expect(loginFile.body).toEqual({ mode: 'json', content: '{"user":"a"}' })

    const pingNode = tree.children?.find((c) => c.name === 'Ping' || c.name === 'ping')
    expect(pingNode).toBeDefined()
  })

  it('converts urlencoded bodies into form-mode content', async () => {
    const collection = {
      item: [
        {
          name: 'Create',
          request: {
            method: 'POST',
            url: 'https://api.example.com/create',
            body: { mode: 'urlencoded', urlencoded: [{ key: 'name', value: 'test' }] }
          }
        }
      ]
    }
    await importPostmanCollection(JSON.stringify(collection), dir)
    const tree = await buildWorkspaceTree(dir)
    const file = await readRequestFile(tree.children![0].path)
    expect(file.body).toEqual({ mode: 'form', content: 'name=test' })
  })
})
