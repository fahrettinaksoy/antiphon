import vm from 'node:vm'
import type { Body, KeyValue } from '@schema/request'

export interface ScriptRequestContext {
  method: string
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body?: Body
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface ScriptResponseContext {
  status: number
  headers: Record<string, string>
  body: string
}

interface ExpectChain {
  to: {
    equal: (expected: unknown) => void
    eql: (expected: unknown) => void
    include: (expected: unknown) => void
    be: {
      above: (n: number) => void
      below: (n: number) => void
      ok: () => void
      a: (typeName: string) => void
    }
    not: {
      equal: (expected: unknown) => void
    }
  }
}

function buildExpect(actual: unknown): ExpectChain {
  const fail = (message: string): never => {
    throw new Error(message)
  }
  return {
    to: {
      equal: (expected) => {
        if (actual !== expected) fail(`expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`)
      },
      eql: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          fail(`expected ${JSON.stringify(actual)} to deep-equal ${JSON.stringify(expected)}`)
        }
      },
      include: (expected) => {
        const ok =
          typeof actual === 'string' || Array.isArray(actual) ? (actual as string | unknown[]).includes(expected as never) : false
        if (!ok) fail(`expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`)
      },
      be: {
        above: (n) => {
          if (!((actual as number) > n)) fail(`expected ${actual} to be above ${n}`)
        },
        below: (n) => {
          if (!((actual as number) < n)) fail(`expected ${actual} to be below ${n}`)
        },
        ok: () => {
          if (!actual) fail('expected value to be truthy')
        },
        a: (typeName) => {
          if (typeof actual !== typeName) fail(`expected ${actual} to be a ${typeName}`)
        }
      },
      not: {
        equal: (expected) => {
          if (actual === expected) fail(`expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`)
        }
      }
    }
  }
}

function makeEnvironmentApi(vars: Record<string, string>) {
  return {
    get: (key: string) => vars[key],
    set: (key: string, value: string) => {
      vars[key] = String(value)
    },
    unset: (key: string) => {
      delete vars[key]
    }
  }
}

export interface PreRequestResult {
  variables: Record<string, string>
  request: ScriptRequestContext
  consoleLogs: string[]
}

export function runPreRequestScript(
  script: string,
  variables: Record<string, string>,
  request: ScriptRequestContext
): PreRequestResult {
  const vars = { ...variables }
  const req: ScriptRequestContext = JSON.parse(JSON.stringify(request))
  const consoleLogs: string[] = []
  if (!script.trim()) return { variables: vars, request: req, consoleLogs }

  const sandbox = {
    pm: {
      environment: makeEnvironmentApi(vars),
      variables: makeEnvironmentApi(vars),
      request: req
    },
    console: { log: (...args: unknown[]) => consoleLogs.push(args.map(String).join(' ')) }
  }

  try {
    const context = vm.createContext(sandbox)
    new vm.Script(script, { filename: 'pre-request-script.js' }).runInContext(context, { timeout: 2000 })
  } catch (error) {
    consoleLogs.push(`Script hatası: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { variables: vars, request: req, consoleLogs }
}

export interface TestRunResult {
  tests: TestResult[]
  variables: Record<string, string>
  consoleLogs: string[]
}

export function runTestScript(script: string, variables: Record<string, string>, response: ScriptResponseContext): TestRunResult {
  const vars = { ...variables }
  const tests: TestResult[] = []
  const consoleLogs: string[] = []
  if (!script.trim()) return { tests, variables: vars, consoleLogs }

  let parsedJson: unknown
  let jsonParseFailed = false

  const sandbox = {
    pm: {
      environment: makeEnvironmentApi(vars),
      variables: makeEnvironmentApi(vars),
      response: {
        code: response.status,
        status: response.status,
        headers: response.headers,
        text: () => response.body,
        json: () => {
          if (parsedJson === undefined && !jsonParseFailed) {
            try {
              parsedJson = JSON.parse(response.body)
            } catch {
              jsonParseFailed = true
              throw new Error('Response body geçerli JSON değil')
            }
          }
          return parsedJson
        }
      },
      test: (name: string, fn: () => void) => {
        try {
          fn()
          tests.push({ name, passed: true })
        } catch (error) {
          tests.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
      expect: buildExpect
    },
    console: { log: (...args: unknown[]) => consoleLogs.push(args.map(String).join(' ')) }
  }

  try {
    const context = vm.createContext(sandbox)
    new vm.Script(script, { filename: 'test-script.js' }).runInContext(context, { timeout: 2000 })
  } catch (error) {
    consoleLogs.push(`Script hatası: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { tests, variables: vars, consoleLogs }
}
