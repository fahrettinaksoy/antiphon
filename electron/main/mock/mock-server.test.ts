import { describe, it, expect, afterEach } from 'vitest'
import { startMockServer, stopMockServer, getMockServerStatus } from './mock-server'

const TEST_PORT = 41567

describe('mock-server', () => {
  afterEach(async () => {
    await stopMockServer()
  })

  it('generates routes from an OpenAPI spec and serves example or faked responses', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1' },
      paths: {
        '/ping': {
          get: { responses: { '200': { content: { 'application/json': { example: { status: 'ok' } } } } } }
        },
        '/users/{id}': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' } } }
                  }
                }
              }
            }
          }
        }
      }
    }

    const status = await startMockServer(JSON.stringify(spec), TEST_PORT)
    expect(status.running).toBe(true)
    expect(status.routes).toHaveLength(2)
    expect(status.routes).toContainEqual({ method: 'GET', path: '/users/:id' })

    const pingRes = await fetch(`http://127.0.0.1:${TEST_PORT}/ping`)
    expect(await pingRes.json()).toEqual({ status: 'ok' })

    const userRes = await fetch(`http://127.0.0.1:${TEST_PORT}/users/42`)
    const userJson = await userRes.json()
    expect(typeof userJson.id).toBe('string')
    expect(String(userJson.email)).toContain('@')
  })

  it('reports status accurately and actually closes the port on stop', async () => {
    const spec = { paths: { '/ping': { get: { responses: {} } } } }
    await startMockServer(JSON.stringify(spec), TEST_PORT + 1)
    expect(getMockServerStatus().running).toBe(true)

    await stopMockServer()
    expect(getMockServerStatus().running).toBe(false)

    await expect(fetch(`http://127.0.0.1:${TEST_PORT + 1}/ping`)).rejects.toThrow()
  })

  it('restarting the server replaces the previous route set', async () => {
    await startMockServer(JSON.stringify({ paths: { '/a': { get: { responses: {} } } } }), TEST_PORT + 2)
    expect(getMockServerStatus().routes).toHaveLength(1)

    await startMockServer(JSON.stringify({ paths: { '/b': { get: { responses: {} }, post: { responses: {} } } } }), TEST_PORT + 2)
    expect(getMockServerStatus().routes).toHaveLength(2)
  })
})
