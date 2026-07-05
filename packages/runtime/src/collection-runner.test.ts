import { describe, it, expect, vi } from 'vitest'
import { runCollectionItem, runCollection, type CollectionRequestItem, type HttpCallFn } from './collection-runner'
import { SCHEMA_VERSION, type RequestFile } from '@schema/request'

function makeFile(overrides: Partial<RequestFile> = {}): RequestFile {
  return {
    schema: SCHEMA_VERSION,
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/ping',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { mode: 'none' },
    ...overrides
  }
}

describe('runCollectionItem', () => {
  it('executes a request and reports success with no tests', async () => {
    const httpCall: HttpCallFn = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })

    const item: CollectionRequestItem = { path: '/a.req.yaml', file: makeFile(), inheritedHeaders: [], inheritedAuth: undefined }
    const result = await runCollectionItem(item, { variables: {}, resolveSecret: () => undefined, httpCall })

    expect(result.status).toBe(200)
    expect(result.tests).toEqual([])
    expect(result.error).toBeUndefined()
    expect(httpCall).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: expect.any(URL) })
    )
  })

  it('runs the test script against the real response and reports failures', async () => {
    const httpCall: HttpCallFn = vi.fn().mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      body: '{}'
    })

    const item: CollectionRequestItem = {
      path: '/b.req.yaml',
      file: makeFile({ testScript: `pm.test('is 200', () => pm.expect(pm.response.code).to.equal(200))` }),
      inheritedHeaders: [],
      inheritedAuth: undefined
    }
    const result = await runCollectionItem(item, { variables: {}, resolveSecret: () => undefined, httpCall })

    expect(result.status).toBe(500)
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0].passed).toBe(false)
  })

  it('captures thrown errors (e.g. network failure) without throwing', async () => {
    const httpCall: HttpCallFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const item: CollectionRequestItem = { path: '/c.req.yaml', file: makeFile(), inheritedHeaders: [], inheritedAuth: undefined }
    const result = await runCollectionItem(item, { variables: {}, resolveSecret: () => undefined, httpCall })

    expect(result.status).toBeNull()
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('applies inherited headers and auth, overridden by the request itself', async () => {
    const httpCall: HttpCallFn = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' })
    const item: CollectionRequestItem = {
      path: '/d.req.yaml',
      file: makeFile({ headers: [{ key: 'X-Own', value: 'own-value', enabled: true }] }),
      inheritedHeaders: [{ key: 'X-Inherited', value: 'inherited-value', enabled: true }],
      inheritedAuth: { type: 'bearer', token: 'inherited-token' }
    }
    await runCollectionItem(item, { variables: {}, resolveSecret: () => undefined, httpCall })

    const callArgs = (httpCall as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.headers['X-Inherited']).toBe('inherited-value')
    expect(callArgs.headers['X-Own']).toBe('own-value')
    expect(callArgs.headers.Authorization).toBe('Bearer inherited-token')
  })
})

describe('runCollection', () => {
  it('runs all items in order and reports progress', async () => {
    const httpCall: HttpCallFn = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' })
    const items: CollectionRequestItem[] = [
      { path: '/1.req.yaml', file: makeFile({ name: 'First' }), inheritedHeaders: [], inheritedAuth: undefined },
      { path: '/2.req.yaml', file: makeFile({ name: 'Second' }), inheritedHeaders: [], inheritedAuth: undefined }
    ]
    const progressCalls: number[] = []
    const results = await runCollection(items, {
      variables: {},
      resolveSecret: () => undefined,
      httpCall,
      onProgress: (_result, index) => progressCalls.push(index)
    })

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.name)).toEqual(['First', 'Second'])
    expect(progressCalls).toEqual([0, 1])
  })

  it('stops early when shouldStop returns true', async () => {
    const httpCall: HttpCallFn = vi
      .fn()
      .mockResolvedValueOnce({ status: 500, statusText: 'Err', headers: {}, body: '{}' })
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}' })

    const items: CollectionRequestItem[] = [
      { path: '/1.req.yaml', file: makeFile({ name: 'Fails' }), inheritedHeaders: [], inheritedAuth: undefined },
      { path: '/2.req.yaml', file: makeFile({ name: 'Never Runs' }), inheritedHeaders: [], inheritedAuth: undefined }
    ]
    const results = await runCollection(items, {
      variables: {},
      resolveSecret: () => undefined,
      httpCall,
      shouldStop: (result) => (result.status ?? 0) >= 400
    })

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Fails')
  })
})
