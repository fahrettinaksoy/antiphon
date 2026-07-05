import type { Auth, Body, EnvironmentFile, FolderMeta, FolderMetaInput, HttpMethod, KeyValue, RequestFile } from '@schema/request'

export interface HttpRequestPayload {
  id: string
  name: string
  method: string
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body?: Body
  auth?: Auth
  environmentVariables?: Record<string, string>
  requestPath?: string
  workspaceRoot?: string
  preRequestScript?: string
  testScript?: string
}

export interface TestResultDto {
  name: string
  passed: boolean
  error?: string
}

export interface HttpResponsePayload {
  requestId: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyEncoding: 'utf8' | 'base64'
  timing: {
    dns: number
    tcp: number
    tls: number
    ttfb: number
    download: number
    total: number
  }
  sizeBytes: number
  testResults?: TestResultDto[]
}

export interface WorkspaceNode {
  id: string
  type: 'folder' | 'request'
  name: string
  path: string
  method?: string
  children?: WorkspaceNode[]
}

export type WorkspaceVisibility = 'personal' | 'internal' | 'public'

export interface WorkspaceStorageLocal {
  kind: 'local'
}
export interface WorkspaceStorageGist {
  kind: 'gist'
  gistId: string | null
}
export interface WorkspaceStorageWebdav {
  kind: 'webdav'
  url: string
  username: string
}
export type WorkspaceStorage = WorkspaceStorageLocal | WorkspaceStorageGist | WorkspaceStorageWebdav
export type WorkspaceStorageKind = WorkspaceStorage['kind']

export interface WorkspaceMetaDto {
  id: string
  name: string
  type: WorkspaceVisibility
  storage: WorkspaceStorage
  localPath: string
  isDefault: boolean
  createdAt: number
  lastOpenedAt: number
}

export type CreateWorkspaceInput = {
  name: string
  type: WorkspaceVisibility
  storage:
    | { kind: 'local'; sourceFolder?: string | null }
    | { kind: 'gist'; token: string; gistId?: string | null }
    | { kind: 'webdav'; url: string; username: string; password: string }
}

export interface OpenWorkspaceResult {
  meta: WorkspaceMetaDto
  tree: WorkspaceNode | null
}

export type WorkspaceSyncDirection = 'push' | 'pull'

export type Platform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd'

export interface AppInfo {
  version: string
  platform: Platform
}

export type RequestFileDto = RequestFile
export type EnvironmentFileDto = EnvironmentFile
export type FolderMetaDto = FolderMeta
// Yazma DTO'su: default'lu alanlar opsiyonel (bkz. FolderMetaInput).
export type FolderMetaInputDto = FolderMetaInput

export interface EnvironmentSummary {
  name: string
  path: string
}

export interface CurlParseResult {
  method: HttpMethod
  url: string
  headers: KeyValue[]
  body?: Body
}

export interface ImportResult {
  importedCount: number
  skipped: string[]
  tree: WorkspaceNode | null
}

export interface WsEvent {
  connectionId: string
  type: 'open' | 'message' | 'close' | 'error'
  data?: string
  isBinary?: boolean
  code?: number
  reason?: string
  message?: string
  timestamp: number
}

export interface SseEvent {
  connectionId: string
  type: 'open' | 'message' | 'close' | 'error'
  eventName?: string
  data?: string
  message?: string
  timestamp: number
}

export interface GraphqlSubscriptionEvent {
  connectionId: string
  type: 'open' | 'next' | 'error' | 'complete'
  data?: string
  message?: string
  timestamp: number
}

export interface GitFileStatusDto {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'untracked' | 'unmodified'
  staged: boolean
}

export interface GitStatusSummaryDto {
  branch: string | null
  files: GitFileStatusDto[]
  ahead: number
  behind: number
}

export interface GitCommitSummaryDto {
  oid: string
  message: string
  author: string
  timestamp: number
}

export interface GitCredentialsDto {
  username: string
  password: string
}

export interface CollectionRunResultDto {
  path: string
  name: string
  method: string
  url: string
  status: number | null
  durationMs: number
  tests: TestResultDto[]
  error?: string
}

export interface CollectionRunProgressEvent {
  runId: string
  result: CollectionRunResultDto
  index: number
  total: number
}

export interface ClientCertificateEntryDto {
  id: string
  hostPattern: string
  certPem: string
  keyPem: string
  passphrase: string
}

export interface NetworkSettingsDto {
  proxyEnabled: boolean
  proxyUrl: string
  customCaPem: string
  clientCertificates: ClientCertificateEntryDto[]
  rejectUnauthorized: boolean
  cookieJarEnabled: boolean
}

export interface CookieSummaryDto {
  domain: string
  path: string
  key: string
  value: string
  expires: string
}

export interface GitIdentityOverrideDto {
  name: string
  email: string
}

export interface WorkspaceSettingsOverrideDto {
  networkSettings?: Partial<NetworkSettingsDto>
  gitIdentity?: GitIdentityOverrideDto
}

export interface McpConnectionConfigDto {
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
}

export interface McpToolSummaryDto {
  name: string
  description?: string
  inputSchema?: unknown
}

export interface McpResourceSummaryDto {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface McpPromptSummaryDto {
  name: string
  description?: string
}

export interface MockRouteSummaryDto {
  method: string
  path: string
}

export interface MockServerStatusDto {
  running: boolean
  port: number | null
  routes: MockRouteSummaryDto[]
}

export const IpcChannels = {
  requestSend: 'request:send',
  requestCancel: 'request:cancel',
  workspaceOpen: 'workspace:open',
  workspaceTree: 'workspace:tree',
  workspaceRegistryList: 'workspace:registry-list',
  workspaceRegistryActive: 'workspace:registry-active',
  workspaceRegistryCreate: 'workspace:registry-create',
  workspaceRegistryOpen: 'workspace:registry-open',
  workspaceRegistryDelete: 'workspace:registry-delete',
  workspaceRegistryRename: 'workspace:registry-rename',
  workspaceRegistrySync: 'workspace:registry-sync',
  workspacePickDirectory: 'workspace:pick-directory',
  workspaceWatch: 'workspace:watch-changed',
  workspaceReadRequest: 'workspace:read-request',
  workspaceWriteRequest: 'workspace:write-request',
  workspaceCreateRequest: 'workspace:create-request',
  workspaceCreateFolder: 'workspace:create-folder',
  workspaceDelete: 'workspace:delete',
  workspaceRename: 'workspace:rename',
  workspaceReadFolderMeta: 'workspace:read-folder-meta',
  workspaceWriteFolderMeta: 'workspace:write-folder-meta',
  environmentList: 'environment:list',
  environmentRead: 'environment:read',
  environmentWrite: 'environment:write',
  environmentCreate: 'environment:create',
  environmentDelete: 'environment:delete',
  importCurlParse: 'import:curl-parse',
  importPostman: 'import:postman',
  importOpenapi: 'import:openapi',
  secretGet: 'secret:get',
  secretSet: 'secret:set',
  secretList: 'secret:list',
  secretDelete: 'secret:delete',
  wsConnect: 'ws:connect',
  wsSend: 'ws:send',
  wsClose: 'ws:close',
  wsEvent: 'ws:event',
  sseConnect: 'sse:connect',
  sseClose: 'sse:close',
  sseEvent: 'sse:event',
  graphqlSubscribe: 'graphql:subscribe',
  graphqlUnsubscribe: 'graphql:unsubscribe',
  graphqlSubscriptionEvent: 'graphql:subscription-event',
  gitIsRepo: 'git:is-repo',
  gitInit: 'git:init',
  gitStatus: 'git:status',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitStageAll: 'git:stage-all',
  gitCommit: 'git:commit',
  gitLog: 'git:log',
  gitDiff: 'git:diff',
  gitPull: 'git:pull',
  gitPush: 'git:push',
  collectionRun: 'collection:run',
  collectionRunProgress: 'collection:run-progress',
  networkGetSettings: 'network:get-settings',
  networkSetSettings: 'network:set-settings',
  networkListCookies: 'network:list-cookies',
  networkClearCookies: 'network:clear-cookies',
  workspaceGetSettingsOverride: 'workspace:get-settings-override',
  workspaceSetSettingsOverride: 'workspace:set-settings-override',
  mcpConnect: 'mcp:connect',
  mcpDisconnect: 'mcp:disconnect',
  mcpListTools: 'mcp:list-tools',
  mcpListResources: 'mcp:list-resources',
  mcpListPrompts: 'mcp:list-prompts',
  mcpCallTool: 'mcp:call-tool',
  mcpReadResource: 'mcp:read-resource',
  mcpGetPrompt: 'mcp:get-prompt',
  mockStart: 'mock:start',
  mockStop: 'mock:stop',
  mockStatus: 'mock:status',
  appInfo: 'app:info'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface AntiphonApi {
  getAppInfo(): Promise<AppInfo>
  openWorkspace(): Promise<WorkspaceNode | null>
  listWorkspaces(): Promise<WorkspaceMetaDto[]>
  getActiveWorkspaceId(): Promise<string | null>
  createWorkspace(input: CreateWorkspaceInput): Promise<OpenWorkspaceResult>
  openWorkspaceById(id: string): Promise<OpenWorkspaceResult | null>
  deleteWorkspace(id: string): Promise<WorkspaceMetaDto[]>
  renameWorkspace(id: string, name: string): Promise<void>
  syncWorkspace(id: string, direction: WorkspaceSyncDirection): Promise<WorkspaceNode | null>
  pickDirectory(): Promise<string | null>
  sendRequest(payload: HttpRequestPayload): Promise<HttpResponsePayload>
  cancelRequest(requestId: string): Promise<void>
  onWorkspaceChanged(callback: (tree: WorkspaceNode) => void): () => void
  readRequestFile(path: string): Promise<RequestFileDto>
  writeRequestFile(path: string, data: RequestFileDto): Promise<void>
  createRequest(folderPath: string, name: string): Promise<WorkspaceNode>
  createFolder(parentPath: string, name: string): Promise<WorkspaceNode>
  deleteNode(path: string): Promise<void>
  renameNode(path: string, newName: string): Promise<WorkspaceNode>
  readFolderMeta(folderPath: string): Promise<FolderMetaDto | null>
  writeFolderMeta(folderPath: string, data: FolderMetaInputDto): Promise<void>
  parseCurl(command: string): Promise<CurlParseResult>
  importPostmanCollection(workspaceRoot: string): Promise<ImportResult>
  importOpenapiSpec(workspaceRoot: string): Promise<ImportResult>
  listEnvironments(workspaceRoot: string): Promise<EnvironmentSummary[]>
  readEnvironment(path: string): Promise<EnvironmentFileDto>
  writeEnvironment(path: string, data: EnvironmentFileDto): Promise<void>
  createEnvironment(workspaceRoot: string, name: string): Promise<EnvironmentSummary>
  deleteEnvironment(path: string): Promise<void>
  getSecret(key: string): Promise<string | undefined>
  setSecret(key: string, value: string): Promise<void>
  listSecretKeys(): Promise<string[]>
  deleteSecret(key: string): Promise<void>
  connectWebSocket(connectionId: string, url: string, headers: KeyValue[]): Promise<void>
  sendWebSocketMessage(connectionId: string, data: string, isBinary?: boolean): Promise<void>
  closeWebSocket(connectionId: string): Promise<void>
  onWebSocketEvent(callback: (event: WsEvent) => void): () => void
  connectSse(connectionId: string, url: string, headers: KeyValue[]): Promise<void>
  closeSse(connectionId: string): Promise<void>
  onSseEvent(callback: (event: SseEvent) => void): () => void
  subscribeGraphql(connectionId: string, url: string, query: string, variables: Record<string, unknown>, headers: KeyValue[]): Promise<void>
  unsubscribeGraphql(connectionId: string): Promise<void>
  onGraphqlSubscriptionEvent(callback: (event: GraphqlSubscriptionEvent) => void): () => void
  isGitRepo(dir: string): Promise<boolean>
  initGitRepo(dir: string): Promise<void>
  getGitStatus(dir: string): Promise<GitStatusSummaryDto>
  stageGitFile(dir: string, filepath: string): Promise<void>
  unstageGitFile(dir: string, filepath: string): Promise<void>
  stageAllGitFiles(dir: string): Promise<void>
  commitGit(dir: string, message: string, authorName: string, authorEmail: string): Promise<string>
  getGitLog(dir: string, depth?: number): Promise<GitCommitSummaryDto[]>
  diffGitFile(dir: string, filepath: string): Promise<string>
  pullGit(dir: string, authorName: string, authorEmail: string, credentials?: GitCredentialsDto): Promise<void>
  pushGit(dir: string, credentials?: GitCredentialsDto): Promise<void>
  runCollection(runId: string, folderPath: string, workspaceRoot: string, variables: Record<string, string>): Promise<CollectionRunResultDto[]>
  onCollectionRunProgress(callback: (event: CollectionRunProgressEvent) => void): () => void
  getNetworkSettings(): Promise<NetworkSettingsDto>
  setNetworkSettings(settings: NetworkSettingsDto): Promise<void>
  listCookies(): Promise<CookieSummaryDto[]>
  clearCookies(): Promise<void>
  getWorkspaceSettingsOverride(workspaceRoot: string): Promise<WorkspaceSettingsOverrideDto>
  setWorkspaceSettingsOverride(workspaceRoot: string, override: WorkspaceSettingsOverrideDto): Promise<void>
  connectMcp(connectionId: string, config: McpConnectionConfigDto): Promise<void>
  disconnectMcp(connectionId: string): Promise<void>
  listMcpTools(connectionId: string): Promise<McpToolSummaryDto[]>
  listMcpResources(connectionId: string): Promise<McpResourceSummaryDto[]>
  listMcpPrompts(connectionId: string): Promise<McpPromptSummaryDto[]>
  callMcpTool(connectionId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>
  readMcpResource(connectionId: string, uri: string): Promise<unknown>
  getMcpPrompt(connectionId: string, promptName: string, args: Record<string, string>): Promise<unknown>
  startMockServer(port: number): Promise<MockServerStatusDto>
  stopMockServer(): Promise<void>
  getMockServerStatus(): Promise<MockServerStatusDto>
}
