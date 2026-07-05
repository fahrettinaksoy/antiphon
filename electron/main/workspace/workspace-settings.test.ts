import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getWorkspaceSettingsOverride, setWorkspaceSettingsOverride, mergeNetworkSettings } from './workspace-settings'
import type { NetworkSettings } from '../network/network-settings'

describe('workspace settings override', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-wssettings-test-'))
  })

  it('returns an empty override when no file exists yet', async () => {
    expect(await getWorkspaceSettingsOverride(dir)).toEqual({})
  })

  it('round-trips a git identity override', async () => {
    await setWorkspaceSettingsOverride(dir, { gitIdentity: { name: 'Proj Bot', email: 'bot@proj.com' } })
    const override = await getWorkspaceSettingsOverride(dir)
    expect(override.gitIdentity).toEqual({ name: 'Proj Bot', email: 'bot@proj.com' })
  })
})

describe('mergeNetworkSettings', () => {
  const globalSettings: NetworkSettings = {
    proxyEnabled: false,
    proxyUrl: '',
    customCaPem: '',
    clientCertificates: [],
    rejectUnauthorized: true,
    cookieJarEnabled: true
  }

  it('returns the global settings untouched when no override is given', () => {
    expect(mergeNetworkSettings(globalSettings, undefined)).toEqual(globalSettings)
  })

  it('overrides only the fields present in the partial override', () => {
    const merged = mergeNetworkSettings(globalSettings, { proxyEnabled: true, proxyUrl: 'http://p:8080' })
    expect(merged.proxyEnabled).toBe(true)
    expect(merged.proxyUrl).toBe('http://p:8080')
    expect(merged.cookieJarEnabled).toBe(true)
  })
})
