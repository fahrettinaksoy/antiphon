// Script istemcisi — Rust `script_*` komutları (rquickjs sandbox). Faz 8b.

import type { Body, KeyValue } from '@schema/request'
import { invoke } from '@tauri-apps/api/core'

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

export interface PreRequestResult {
  variables: Record<string, string>
  request: ScriptRequestContext
  consoleLogs: string[]
}

export interface TestRunResult {
  tests: TestResult[]
  variables: Record<string, string>
  consoleLogs: string[]
}

export function runPreRequestScript(
  script: string,
  variables: Record<string, string>,
  request: ScriptRequestContext
): Promise<PreRequestResult> {
  return invoke<PreRequestResult>('script_pre_request', { script, variables, request })
}

export function runTestScript(
  script: string,
  variables: Record<string, string>,
  response: ScriptResponseContext
): Promise<TestRunResult> {
  return invoke<TestRunResult>('script_test', { script, variables, response })
}
