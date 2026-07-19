import type { TemplateContext } from './template-engine'
import { describe, expect, it } from 'vitest'
import { cacheResponse } from './response-cache'
import { extractSecretKeys, resolveTemplate } from './template-engine'

describe('resolveTemplate', () => {
  it('resolves plain variables', () => {
    const ctx: TemplateContext = {
      variables: { host: 'api.example.com' },
      resolveSecret: () => undefined
    }
    expect(resolveTemplate('https://{{host}}/ping', ctx)).toBe('https://api.example.com/ping')
  })

  it('leaves unresolved variables untouched', () => {
    const ctx: TemplateContext = { variables: {}, resolveSecret: () => undefined }
    expect(resolveTemplate('{{unknownVar}}', ctx)).toBe('{{unknownVar}}')
  })

  it('resolves built-in functions', () => {
    const ctx: TemplateContext = { variables: {}, resolveSecret: () => undefined }
    expect(resolveTemplate('{{$uuid}}', ctx)).toMatch(/^[0-9a-f-]{36}$/)
    expect(resolveTemplate('{{$timestamp}}', ctx)).toMatch(/^\d+$/)
  })

  it('resolves secrets via the injected resolver', () => {
    const ctx: TemplateContext = {
      variables: {},
      resolveSecret: (key) => (key === 'API_KEY' ? 'shh' : undefined)
    }
    expect(resolveTemplate('key={{secret:API_KEY}}', ctx)).toBe('key=shh')
  })

  it('resolves chained values from a cached response', () => {
    cacheResponse('Login', {
      requestId: 'r1',
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ token: 'abc123', user: { id: 42 } }),
      bodyEncoding: 'utf8',
      timing: {
        prepare: 0,
        socketInit: 0,
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        download: 0,
        process: 0,
        total: 1
      },
      sizeBytes: 10
    })
    const ctx: TemplateContext = { variables: {}, resolveSecret: () => undefined }
    expect(resolveTemplate("Bearer {{response('Login').json.token}}", ctx)).toBe('Bearer abc123')
    expect(resolveTemplate("{{response('Login').json.user.id}}", ctx)).toBe('42')
    expect(resolveTemplate("{{response('Login').status}}", ctx)).toBe('200')
  })
})

describe('extractSecretKeys', () => {
  it('finds unique secret keys referenced in text', () => {
    const keys = extractSecretKeys([
      '{{secret:API_KEY}}',
      'no secret here',
      '{{secret:API_KEY}}',
      '{{secret:OTHER}}'
    ])
    expect(keys.sort()).toEqual(['API_KEY', 'OTHER'])
  })

  it('returns an empty array when no secrets are referenced', () => {
    expect(extractSecretKeys(['plain text', undefined])).toEqual([])
  })
})
