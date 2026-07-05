import type { HttpResponsePayload } from '@shared/ipc-contract'

interface CachedResponse {
  payload: HttpResponsePayload
  json: unknown
}

const cache = new Map<string, CachedResponse>()

export function cacheResponse(requestName: string, payload: HttpResponsePayload): void {
  let json: unknown
  if (payload.bodyEncoding === 'utf8') {
    try {
      json = JSON.parse(payload.body)
    } catch {
      json = undefined
    }
  }
  cache.set(requestName, { payload, json })
}

export function getCachedResponse(requestName: string): CachedResponse | undefined {
  return cache.get(requestName)
}

export function clearResponseCache(): void {
  cache.clear()
}
