// Realtime istemcisi — Rust `ws_*`/`sse_*`/`graphql_*` komutları + Tauri event'leri.
// Bağlantı Rust'ta kurulur; olaylar `ws-event`/`sse-event`/`graphql-sub-event` ile gelir.

import type { KeyValue } from '@schema/request'
import type { GraphqlSubscriptionEvent, SseEvent, WsEvent } from '@shared/ipc-contract'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Tauri event aboneliğini SENKRON bir "aboneliği iptal et" fonksiyonuna sarar
// (kurulum sırasında Promise beklemeden temizlik döndürülebilsin).
function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | undefined
  let cancelled = false
  listen<T>(event, (e) => callback(e.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}

// ---- WebSocket ----

export function connectWebSocket(
  connectionId: string,
  url: string,
  headers: KeyValue[]
): Promise<void> {
  return invoke('ws_connect', { connectionId, url, headers })
}

export function sendWebSocketMessage(
  connectionId: string,
  data: string,
  isBinary?: boolean
): Promise<void> {
  return invoke('ws_send', { connectionId, data, isBinary: isBinary ?? false })
}

export function closeWebSocket(connectionId: string): Promise<void> {
  return invoke('ws_close', { connectionId })
}

export function onWebSocketEvent(callback: (event: WsEvent) => void): () => void {
  return subscribe<WsEvent>('ws-event', callback)
}

// ---- SSE ----

export function connectSse(connectionId: string, url: string, headers: KeyValue[]): Promise<void> {
  return invoke('sse_connect', { connectionId, url, headers })
}

export function closeSse(connectionId: string): Promise<void> {
  return invoke('sse_close', { connectionId })
}

export function onSseEvent(callback: (event: SseEvent) => void): () => void {
  return subscribe<SseEvent>('sse-event', callback)
}

// ---- GraphQL subscription ----

export function subscribeGraphql(
  connectionId: string,
  url: string,
  query: string,
  variables: Record<string, unknown>,
  headers: KeyValue[]
): Promise<void> {
  return invoke('graphql_subscribe', { connectionId, url, query, variables, headers })
}

export function unsubscribeGraphql(connectionId: string): Promise<void> {
  return invoke('graphql_unsubscribe', { connectionId })
}

export function onGraphqlSubscriptionEvent(
  callback: (event: GraphqlSubscriptionEvent) => void
): () => void {
  return subscribe<GraphqlSubscriptionEvent>('graphql-sub-event', callback)
}
