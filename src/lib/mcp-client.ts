// MCP istemcisi (Faz 9). Rust `mcp_*` komutları (stdio JSON-RPC). Ham JSON-RPC sonuçları
// burada DTO'lara şekillendirilir (Rust generic Value döndürür).

import type {
  McpConnectionConfigDto,
  McpPromptSummaryDto,
  McpResourceSummaryDto,
  McpToolSummaryDto
} from '@shared/ipc-contract'
import { invoke } from '@tauri-apps/api/core'

interface RawTool {
  name: string
  description?: string
  inputSchema?: unknown
}
interface RawResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}
interface RawPrompt {
  name: string
  description?: string
}

export function connectMcp(connectionId: string, config: McpConnectionConfigDto): Promise<void> {
  return invoke('mcp_connect', { connectionId, config })
}

export function disconnectMcp(connectionId: string): Promise<void> {
  return invoke('mcp_disconnect', { connectionId })
}

export async function listMcpTools(connectionId: string): Promise<McpToolSummaryDto[]> {
  const result = await invoke<{ tools?: RawTool[] }>('mcp_list_tools', { connectionId })
  return (result.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
}

export async function listMcpResources(connectionId: string): Promise<McpResourceSummaryDto[]> {
  const result = await invoke<{ resources?: RawResource[] }>('mcp_list_resources', { connectionId })
  return (result.resources ?? []).map((r) => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType
  }))
}

export async function listMcpPrompts(connectionId: string): Promise<McpPromptSummaryDto[]> {
  const result = await invoke<{ prompts?: RawPrompt[] }>('mcp_list_prompts', { connectionId })
  return (result.prompts ?? []).map((p) => ({ name: p.name, description: p.description }))
}

export function callMcpTool(
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return invoke('mcp_call_tool', { connectionId, toolName, args })
}

export function readMcpResource(connectionId: string, uri: string): Promise<unknown> {
  return invoke('mcp_read_resource', { connectionId, uri })
}

export function getMcpPrompt(
  connectionId: string,
  promptName: string,
  args: Record<string, string>
): Promise<unknown> {
  return invoke('mcp_get_prompt', { connectionId, promptName, args })
}
