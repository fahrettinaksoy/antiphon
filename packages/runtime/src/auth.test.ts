import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { resolveAuth } from './auth'

describe('resolveAuth', () => {
  it('returns no headers for type none or undefined', () => {
    expect(resolveAuth(undefined)).toEqual({ headers: {}, queryParams: {} })
    expect(resolveAuth({ type: 'none' })).toEqual({ headers: {}, queryParams: {} })
  })

  it('builds a Basic auth header', () => {
    const result = resolveAuth({ type: 'basic', username: 'admin', password: 'secret' })
    expect(result.headers.Authorization).toBe(
      `Basic ${Buffer.from('admin:secret').toString('base64')}`
    )
  })

  it('builds a Bearer auth header', () => {
    const result = resolveAuth({ type: 'bearer', token: 'tok_123' })
    expect(result.headers.Authorization).toBe('Bearer tok_123')
  })

  it('places an API key in a header when requested', () => {
    const result = resolveAuth({ type: 'apiKey', key: 'X-Api-Key', value: 'k1', in: 'header' })
    expect(result.headers['X-Api-Key']).toBe('k1')
    expect(result.queryParams).toEqual({})
  })

  it('places an API key in the query string when requested', () => {
    const result = resolveAuth({ type: 'apiKey', key: 'api_key', value: 'k2', in: 'query' })
    expect(result.queryParams.api_key).toBe('k2')
    expect(result.headers).toEqual({})
  })

  it('signs a valid HS256 JWT and embeds the payload', () => {
    const result = resolveAuth({ type: 'jwt', secret: 'shh', payload: { sub: 'user1' } })
    const token = result.headers.Authorization?.replace('Bearer ', '') ?? ''
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    expect(decodedPayload.sub).toBe('user1')
  })
})
