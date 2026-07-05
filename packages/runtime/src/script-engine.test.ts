import { describe, it, expect } from 'vitest'
import { runPreRequestScript, runTestScript } from './script-engine'

describe('runPreRequestScript', () => {
  it('mutates environment variables and request headers', () => {
    const result = runPreRequestScript(
      `
      pm.environment.set('token', 'abc-' + pm.environment.get('suffix'));
      pm.request.headers.push({ key: 'X-From-Script', value: pm.environment.get('token'), enabled: true });
      console.log('pre-request ran');
      `,
      { suffix: '123' },
      { method: 'GET', url: 'https://api.example.com', headers: [], params: [] }
    )

    expect(result.variables.token).toBe('abc-123')
    expect(result.request.headers[0]).toEqual({ key: 'X-From-Script', value: 'abc-123', enabled: true })
    expect(result.consoleLogs).toContain('pre-request ran')
  })

  it('returns the original request unchanged for an empty script', () => {
    const request = { method: 'GET', url: 'https://x.test', headers: [], params: [] }
    const result = runPreRequestScript('', {}, request)
    expect(result.request).toEqual(request)
    expect(result.variables).toEqual({})
  })

  it('captures a script error as a console log instead of throwing', () => {
    const result = runPreRequestScript('throw new Error("boom")', {}, { method: 'GET', url: '', headers: [], params: [] })
    expect(result.consoleLogs.some((log) => log.includes('boom'))).toBe(true)
  })
})

describe('runTestScript', () => {
  it('records passing and failing assertions with error messages', () => {
    const result = runTestScript(
      `
      pm.test('status ok', () => pm.expect(pm.response.code).to.equal(200));
      pm.test('body has id', () => pm.expect(pm.response.json().id).to.equal(1));
      pm.test('this fails', () => pm.expect(pm.response.code).to.equal(999));
      `,
      {},
      { status: 200, headers: {}, body: JSON.stringify({ id: 1 }) }
    )

    expect(result.tests).toHaveLength(3)
    expect(result.tests[0]).toEqual({ name: 'status ok', passed: true })
    expect(result.tests[1]).toEqual({ name: 'body has id', passed: true })
    expect(result.tests[2].passed).toBe(false)
    expect(result.tests[2].error).toContain('expected 200 to equal 999')
  })

  it('returns no tests for an empty script', () => {
    const result = runTestScript('', {}, { status: 200, headers: {}, body: '' })
    expect(result.tests).toEqual([])
  })

  it('supports expect().to.include and .to.be.ok', () => {
    const result = runTestScript(
      `
      pm.test('includes substring', () => pm.expect(pm.response.text()).to.include('hello'));
      pm.test('truthy check', () => pm.expect(pm.response.code).to.be.ok());
      `,
      {},
      { status: 200, headers: {}, body: 'hello world' }
    )
    expect(result.tests.every((t) => t.passed)).toBe(true)
  })
})
