import { describe, it, expect } from 'vitest'
import { matchesHostPattern, findClientCertificate, type NetworkSettings } from './network-settings'

describe('matchesHostPattern', () => {
  it('matches any host against the wildcard pattern', () => {
    expect(matchesHostPattern('anything.test', '*')).toBe(true)
  })

  it('matches subdomains and the bare domain against a *.domain pattern', () => {
    expect(matchesHostPattern('api.example.com', '*.example.com')).toBe(true)
    expect(matchesHostPattern('example.com', '*.example.com')).toBe(true)
    expect(matchesHostPattern('other.com', '*.example.com')).toBe(false)
  })

  it('requires an exact match for a plain hostname pattern', () => {
    expect(matchesHostPattern('api.example.com', 'api.example.com')).toBe(true)
    expect(matchesHostPattern('www.example.com', 'api.example.com')).toBe(false)
  })
})

describe('findClientCertificate', () => {
  const settings: NetworkSettings = {
    proxyEnabled: false,
    proxyUrl: '',
    customCaPem: '',
    rejectUnauthorized: true,
    cookieJarEnabled: true,
    clientCertificates: [
      { id: '1', hostPattern: '*.internal.corp', certPem: 'CERT_INTERNAL', keyPem: 'KEY_INTERNAL', passphrase: '' },
      { id: '2', hostPattern: 'api.example.com', certPem: 'CERT_API', keyPem: 'KEY_API', passphrase: '' }
    ]
  }

  it('selects the certificate matching the request host', () => {
    expect(findClientCertificate(settings, 'svc.internal.corp')?.certPem).toBe('CERT_INTERNAL')
    expect(findClientCertificate(settings, 'api.example.com')?.certPem).toBe('CERT_API')
  })

  it('returns undefined when no certificate matches', () => {
    expect(findClientCertificate(settings, 'unrelated.com')).toBeUndefined()
  })
})
