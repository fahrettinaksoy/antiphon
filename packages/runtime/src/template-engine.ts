import { templateFunctions } from './functions'
import { getCachedResponse } from './response-cache'

export interface TemplateContext {
  variables: Record<string, string>
  resolveSecret: (key: string) => string | undefined
}

// İç ifade boşlukları tüketicide trim'lenir (regex'te çift-taraflı `\s*` süper-lineer
// backtracking'e yol açtığından bilinçli olarak sade tutuldu).
const TOKEN_PATTERN = /\{\{([^}]+)\}\}/g
const RESPONSE_PATTERN = /^response\(\s*['"]([^'"]+)['"]\s*\)(?:\.(.+))?$/

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return (acc as Record<string, unknown>)[key]
  }, source)
}

function resolveResponseReference(expression: string): string | undefined {
  const match = RESPONSE_PATTERN.exec(expression)
  if (!match) return undefined

  const [, requestName, accessor] = match
  const cached = getCachedResponse(requestName)
  if (!cached) return undefined
  if (!accessor || accessor === 'body') return cached.payload.body
  if (accessor === 'status') return String(cached.payload.status)

  if (accessor.startsWith('json.')) {
    const value = getByPath(cached.json, accessor.slice('json.'.length))
    if (value === undefined) return undefined
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  if (accessor.startsWith('headers.')) {
    return cached.payload.headers[accessor.slice('headers.'.length)]
  }

  return undefined
}

function resolveExpression(expression: string, ctx: TemplateContext): string | undefined {
  if (expression.startsWith('$')) {
    const fn = templateFunctions[expression.slice(1)]
    return fn?.()
  }
  if (expression.startsWith('secret:')) {
    return ctx.resolveSecret(expression.slice('secret:'.length).trim())
  }
  if (expression.startsWith('response(')) {
    return resolveResponseReference(expression)
  }
  return ctx.variables[expression]
}

// Çözülemeyen token'lar okunabilirlik için olduğu gibi bırakılır (silent boşluk yerine hata ayıklanabilir iz).
export function resolveTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(TOKEN_PATTERN, (match, rawExpression: string) => {
    const expression = rawExpression.trim()
    const resolved = resolveExpression(expression, ctx)
    return resolved !== undefined ? resolved : match
  })
}

// `getSecret` main process'te asenkron (safeStorage okuma); secret çözümü öncesinde ihtiyaç duyulan anahtarları toplar.
export function extractSecretKeys(texts: Array<string | undefined>): string[] {
  const keys = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      const expression = match[1].trim()
      if (expression.startsWith('secret:')) keys.add(expression.slice('secret:'.length).trim())
    }
  }
  return [...keys]
}
