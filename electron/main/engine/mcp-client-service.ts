import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface McpConnectionConfig {
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
}

export interface McpToolSummary {
  name: string
  description?: string
  inputSchema?: unknown
}

export interface McpResourceSummary {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface McpPromptSummary {
  name: string
  description?: string
}

const clients = new Map<string, Client>()

function requireClient(connectionId: string): Client {
  const client = clients.get(connectionId)
  if (!client) throw new Error('MCP bağlantısı bulunamadı veya kapatılmış')
  return client
}

export async function mcpConnect(connectionId: string, config: McpConnectionConfig): Promise<void> {
  const client = new Client({ name: 'antiphon', version: '0.1.0' }, { capabilities: {} })

  const transport =
    config.transport === 'stdio'
      ? new StdioClientTransport({ command: config.command ?? '', args: config.args ?? [] })
      : new StreamableHTTPClientTransport(new URL(config.url ?? ''))

  await client.connect(transport)
  clients.set(connectionId, client)
}

export async function mcpDisconnect(connectionId: string): Promise<void> {
  const client = clients.get(connectionId)
  if (!client) return
  await client.close()
  clients.delete(connectionId)
}

export async function mcpListTools(connectionId: string): Promise<McpToolSummary[]> {
  const { tools } = await requireClient(connectionId).listTools()
  return tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
}

export async function mcpListResources(connectionId: string): Promise<McpResourceSummary[]> {
  const { resources } = await requireClient(connectionId).listResources()
  return resources.map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType
  }))
}

export async function mcpListPrompts(connectionId: string): Promise<McpPromptSummary[]> {
  const { prompts } = await requireClient(connectionId).listPrompts()
  return prompts.map((prompt) => ({ name: prompt.name, description: prompt.description }))
}

export async function mcpCallTool(connectionId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  return requireClient(connectionId).callTool({ name: toolName, arguments: args })
}

export async function mcpReadResource(connectionId: string, uri: string): Promise<unknown> {
  return requireClient(connectionId).readResource({ uri })
}

export async function mcpGetPrompt(connectionId: string, promptName: string, args: Record<string, string>): Promise<unknown> {
  return requireClient(connectionId).getPrompt({ name: promptName, arguments: args })
}

export async function disposeAllMcpConnections(): Promise<void> {
  await Promise.all([...clients.values()].map((client) => client.close()))
  clients.clear()
}
