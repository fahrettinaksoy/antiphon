import { createClient, type Client } from 'graphql-ws'
import { WebSocket } from 'ws'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-contract'
import type { GraphqlSubscriptionEvent } from '@shared/ipc-contract'
import type { KeyValue } from '@schema/request'

interface SubscriptionEntry {
  client: Client
  dispose: () => void
}

const subscriptions = new Map<string, SubscriptionEntry>()
let targetWindow: BrowserWindow | null = null

export function setGraphqlSubscriptionWindow(window: BrowserWindow): void {
  targetWindow = window
}

function emit(event: GraphqlSubscriptionEvent): void {
  targetWindow?.webContents.send(IpcChannels.graphqlSubscriptionEvent, event)
}

export function graphqlSubscribe(
  connectionId: string,
  url: string,
  query: string,
  variables: Record<string, unknown>,
  headers: KeyValue[]
): void {
  const headerRecord = Object.fromEntries(headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value]))

  const client = createClient({
    url,
    webSocketImpl: WebSocket,
    connectionParams: () => headerRecord,
    on: {
      connected: () => emit({ connectionId, type: 'open', timestamp: Date.now() }),
      closed: () => emit({ connectionId, type: 'complete', timestamp: Date.now() })
    }
  })

  const dispose = client.subscribe(
    { query, variables },
    {
      next: (result) => emit({ connectionId, type: 'next', data: JSON.stringify(result), timestamp: Date.now() }),
      error: (error) => emit({ connectionId, type: 'error', message: error instanceof Error ? error.message : String(error), timestamp: Date.now() }),
      complete: () => emit({ connectionId, type: 'complete', timestamp: Date.now() })
    }
  )

  subscriptions.set(connectionId, { client, dispose })
}

export function graphqlUnsubscribe(connectionId: string): void {
  const entry = subscriptions.get(connectionId)
  if (!entry) return
  entry.dispose()
  entry.client.dispose()
  subscriptions.delete(connectionId)
}

export function disposeAllGraphqlSubscriptions(): void {
  for (const entry of subscriptions.values()) {
    entry.dispose()
    entry.client.dispose()
  }
  subscriptions.clear()
}
