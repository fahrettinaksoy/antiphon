import { request as httpRequest, type ClientRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-contract'
import type { SseEvent } from '@shared/ipc-contract'
import type { KeyValue } from '@schema/request'

const connections = new Map<string, ClientRequest>()
let targetWindow: BrowserWindow | null = null

export function setSseWindow(window: BrowserWindow): void {
  targetWindow = window
}

function emit(event: SseEvent): void {
  targetWindow?.webContents.send(IpcChannels.sseEvent, event)
}

// SSE akışı `\n\n` ile ayrılan event bloklarından oluşur; her blokta `event:`/`data:` satırları olabilir.
function parseSseBuffer(buffer: string, onEvent: (eventName: string | undefined, data: string) => void): string {
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop() ?? ''

  for (const block of blocks) {
    let eventName: string | undefined
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length > 0) onEvent(eventName, dataLines.join('\n'))
  }

  return remainder
}

export function sseConnect(connectionId: string, url: string, headers: KeyValue[]): void {
  const parsedUrl = new URL(url)
  const requestFn = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest
  const headerRecord = Object.fromEntries(headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value]))

  const req = requestFn(
    url,
    { headers: { Accept: 'text/event-stream', ...headerRecord } },
    (res) => {
      let buffer = ''
      emit({ connectionId, type: 'open', timestamp: Date.now() })

      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        buffer += chunk
        buffer = parseSseBuffer(buffer, (eventName, data) => {
          emit({ connectionId, type: 'message', eventName, data, timestamp: Date.now() })
        })
      })

      res.on('end', () => {
        emit({ connectionId, type: 'close', timestamp: Date.now() })
        connections.delete(connectionId)
      })
    }
  )

  req.on('error', (err) => {
    emit({ connectionId, type: 'error', message: err.message, timestamp: Date.now() })
    connections.delete(connectionId)
  })

  req.end()
  connections.set(connectionId, req)
}

export function sseClose(connectionId: string): void {
  connections.get(connectionId)?.destroy()
  connections.delete(connectionId)
}

export function closeAllSseConnections(): void {
  for (const req of connections.values()) req.destroy()
  connections.clear()
}
