import { WebSocket } from 'ws'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-contract'
import type { WsEvent } from '@shared/ipc-contract'
import type { KeyValue } from '@schema/request'

const connections = new Map<string, WebSocket>()
let targetWindow: BrowserWindow | null = null

export function setWsWindow(window: BrowserWindow): void {
  targetWindow = window
}

function emit(event: WsEvent): void {
  targetWindow?.webContents.send(IpcChannels.wsEvent, event)
}

export function wsConnect(connectionId: string, url: string, headers: KeyValue[]): void {
  const headerRecord = Object.fromEntries(headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value]))
  const socket = new WebSocket(url, { headers: headerRecord })
  connections.set(connectionId, socket)

  socket.on('open', () => emit({ connectionId, type: 'open', timestamp: Date.now() }))

  socket.on('message', (data, isBinary) => {
    emit({
      connectionId,
      type: 'message',
      data: isBinary ? Buffer.from(data as Buffer).toString('base64') : data.toString('utf8'),
      isBinary,
      timestamp: Date.now()
    })
  })

  socket.on('close', (code, reason) => {
    emit({ connectionId, type: 'close', code, reason: reason.toString('utf8'), timestamp: Date.now() })
    connections.delete(connectionId)
  })

  socket.on('error', (err) => {
    emit({ connectionId, type: 'error', message: err.message, timestamp: Date.now() })
  })
}

export function wsSend(connectionId: string, data: string, isBinary = false): void {
  const socket = connections.get(connectionId)
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(isBinary ? Buffer.from(data, 'base64') : data)
}

export function wsClose(connectionId: string): void {
  connections.get(connectionId)?.close()
  connections.delete(connectionId)
}

export function closeAllWsConnections(): void {
  for (const socket of connections.values()) socket.close()
  connections.clear()
}
