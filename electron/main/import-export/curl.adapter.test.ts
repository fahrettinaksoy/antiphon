import { describe, it, expect } from 'vitest'
import { parseCurlCommand } from './curl.adapter'

describe('parseCurlCommand', () => {
  it('parses a POST request with JSON body and headers', () => {
    const result = parseCurlCommand(
      `curl -X POST https://api.example.com/login -H "Content-Type: application/json" -d '{"user":"a","pass":"b"}'`
    )
    expect(result.method).toBe('POST')
    expect(result.url).toBe('https://api.example.com/login')
    expect(result.body).toEqual({ mode: 'json', content: '{"user":"a","pass":"b"}' })
    expect(result.headers).toContainEqual({ key: 'Content-Type', value: 'application/json', enabled: true })
  })

  it('defaults to GET when no method or body is given', () => {
    const result = parseCurlCommand('curl https://api.example.com/ping -H "Authorization: Bearer xyz"')
    expect(result.method).toBe('GET')
    expect(result.headers).toContainEqual({ key: 'Authorization', value: 'Bearer xyz', enabled: true })
  })

  it('defaults to POST when a body is given without an explicit method', () => {
    const result = parseCurlCommand(`curl https://api.example.com/items -d 'name=test'`)
    expect(result.method).toBe('POST')
    expect(result.body?.mode).toBe('raw')
  })

  it('converts --user credentials into a Basic auth header', () => {
    const result = parseCurlCommand('curl -u admin:secret https://api.example.com/private')
    const expectedToken = Buffer.from('admin:secret').toString('base64')
    expect(result.headers).toContainEqual({ key: 'Authorization', value: `Basic ${expectedToken}`, enabled: true })
  })

  it('handles -I as a HEAD request', () => {
    const result = parseCurlCommand('curl -I https://api.example.com/status')
    expect(result.method).toBe('HEAD')
  })
})
