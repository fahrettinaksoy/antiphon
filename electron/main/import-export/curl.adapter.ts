import type { CurlParseResult } from '@shared/ipc-contract'
import type { HttpMethod, KeyValue } from '@schema/request'

const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function toHttpMethod(value: string, fallback: HttpMethod): HttpMethod {
  const upper = value.toUpperCase()
  return (VALID_METHODS as string[]).includes(upper) ? (upper as HttpMethod) : fallback
}

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (quote) {
      if (char === quote) {
        quote = null
      } else if (char === '\\' && quote === '"' && i + 1 < command.length) {
        current += command[++i]
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '\\' && i + 1 < command.length) {
      current += command[++i]
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  if (current) tokens.push(current)

  return tokens.filter((token) => token !== '\\' && token !== '\n')
}

export function parseCurlCommand(command: string): CurlParseResult {
  const tokens = tokenize(command.trim()).filter((t) => t !== 'curl')

  let method = ''
  let url = ''
  const headers: KeyValue[] = []
  let bodyContent: string | undefined
  let hasBodyFlag = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    switch (token) {
      case '-X':
      case '--request':
        method = tokens[++i]?.toUpperCase() ?? method
        break
      case '-H':
      case '--header': {
        const raw = tokens[++i] ?? ''
        const separatorIndex = raw.indexOf(':')
        if (separatorIndex > -1) {
          headers.push({
            key: raw.slice(0, separatorIndex).trim(),
            value: raw.slice(separatorIndex + 1).trim(),
            enabled: true
          })
        }
        break
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
        bodyContent = tokens[++i] ?? ''
        hasBodyFlag = true
        break
      case '-u':
      case '--user': {
        const credentials = tokens[++i] ?? ''
        const token64 = Buffer.from(credentials).toString('base64')
        headers.push({ key: 'Authorization', value: `Basic ${token64}`, enabled: true })
        break
      }
      case '-A':
      case '--user-agent':
        headers.push({ key: 'User-Agent', value: tokens[++i] ?? '', enabled: true })
        break
      case '-I':
      case '--head':
        method = 'HEAD'
        break
      default:
        if (!token.startsWith('-') && !url) {
          url = token
        }
        break
    }
  }

  const isJsonBody =
    hasBodyFlag &&
    (headers.some((h) => h.key.toLowerCase() === 'content-type' && h.value.includes('json')) ||
      (bodyContent?.trim().startsWith('{') ?? false))

  return {
    method: toHttpMethod(method, hasBodyFlag ? 'POST' : 'GET'),
    url,
    headers,
    body: hasBodyFlag ? { mode: isJsonBody ? 'json' : 'raw', content: bodyContent } : { mode: 'none' }
  }
}
