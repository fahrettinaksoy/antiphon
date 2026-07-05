import { resolve } from 'node:path'
import got from 'got'
import { runCollection, type CollectionRequestItem, type HttpCallFn } from '@runtime/index'
import { listRequestFilesRecursive, readRequestFile } from '../../../electron/main/workspace/workspace-service'
import { resolveInheritedSettings } from '../../../electron/main/workspace/inheritance'
import { readEnvironment } from '../../../electron/main/workspace/environment-service'

interface CliArgs {
  command?: string
  target?: string
  envPath?: string
  bail: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const [command, target, ...rest] = argv
  let envPath: string | undefined
  let bail = false

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--env') envPath = rest[++i]
    else if (rest[i] === '--bail') bail = true
  }

  return { command, target, envPath, bail }
}

const httpCall: HttpCallFn = async ({ method, url, headers, body }) => {
  const response = await got(url, {
    method: method as never,
    headers,
    body,
    throwHttpErrors: false,
    retry: { limit: 0 },
    responseType: 'buffer'
  })
  const bodyBuffer = response.body as Buffer
  const isText = /json|text|xml|html|javascript/.test(response.headers['content-type'] ?? '')
  return {
    status: response.statusCode,
    statusText: response.statusMessage ?? '',
    headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
    body: isText ? bodyBuffer.toString('utf8') : bodyBuffer.toString('base64')
  }
}

function printUsage(): void {
  console.log('Kullanım: antiphon run <koleksiyon-klasörü> [--env <environment.env.yaml>] [--bail]')
  console.log('  {{secret:AD}} referansları ortam değişkenlerinden (process.env.AD) çözülür.')
}

async function main(): Promise<void> {
  const { command, target, envPath, bail } = parseArgs(process.argv.slice(2))

  if (command !== 'run' || !target) {
    printUsage()
    process.exitCode = 1
    return
  }

  const collectionPath = resolve(target)
  let variables: Record<string, string> = {}
  if (envPath) {
    const env = await readEnvironment(resolve(envPath))
    variables = env.variables
  }

  const filePaths = await listRequestFilesRecursive(collectionPath)
  if (filePaths.length === 0) {
    console.log(`Hiç .req.yaml dosyası bulunamadı: ${collectionPath}`)
    process.exitCode = 1
    return
  }

  const items: CollectionRequestItem[] = []
  for (const path of filePaths) {
    const file = await readRequestFile(path)
    const inherited = await resolveInheritedSettings(path, collectionPath)
    items.push({ path, file, inheritedHeaders: inherited.headers, inheritedAuth: inherited.auth })
  }

  console.log(`▶ ${items.length} istek çalıştırılıyor (${collectionPath})\n`)

  let failCount = 0

  const results = await runCollection(items, {
    variables,
    resolveSecret: (key) => process.env[key],
    httpCall,
    onProgress: (result) => {
      const ok = !result.error && result.status !== null && result.status < 400 && result.tests.every((t) => t.passed)
      if (!ok) failCount++

      const statusLabel = result.error ? 'ERR' : String(result.status)
      console.log(`${ok ? '✓' : '✗'} [${statusLabel}] ${result.method} ${result.name} (${result.durationMs.toFixed(0)}ms)`)
      if (result.error) console.log(`  hata: ${result.error}`)
      for (const test of result.tests) {
        console.log(`  ${test.passed ? '✓' : '✗'} ${test.name}${test.error ? ` — ${test.error}` : ''}`)
      }
    },
    shouldStop: (result) => {
      const ok = !result.error && result.status !== null && result.status < 400 && result.tests.every((t) => t.passed)
      if (!ok && bail) {
        console.log('\n--bail: ilk hatada durduruldu')
        return true
      }
      return false
    }
  })

  const passCount = results.length - failCount
  console.log(`\n${passCount}/${results.length} istek başarılı (${items.length} istekten ${results.length} tanesi çalıştı)`)
  process.exitCode = failCount > 0 ? 1 : 0
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
