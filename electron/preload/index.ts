import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/ipc-contract'
import type {
  AntiphonApi,
  CollectionRunProgressEvent,
  CreateWorkspaceInput,
  EnvironmentFileDto,
  FolderMetaInputDto,
  GitCredentialsDto,
  GraphqlSubscriptionEvent,
  HttpRequestPayload,
  McpConnectionConfigDto,
  NetworkSettingsDto,
  RequestFileDto,
  SseEvent,
  WorkspaceNode,
  WorkspaceSettingsOverrideDto,
  WorkspaceSyncDirection,
  WsEvent
} from '@shared/ipc-contract'
import type { KeyValue } from '@schema/request'

const api: AntiphonApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
  openWorkspace: () => ipcRenderer.invoke(IpcChannels.workspaceOpen),
  listWorkspaces: () => ipcRenderer.invoke(IpcChannels.workspaceRegistryList),
  getActiveWorkspaceId: () => ipcRenderer.invoke(IpcChannels.workspaceRegistryActive),
  createWorkspace: (input: CreateWorkspaceInput) => ipcRenderer.invoke(IpcChannels.workspaceRegistryCreate, input),
  openWorkspaceById: (id: string) => ipcRenderer.invoke(IpcChannels.workspaceRegistryOpen, id),
  deleteWorkspace: (id: string) => ipcRenderer.invoke(IpcChannels.workspaceRegistryDelete, id),
  renameWorkspace: (id: string, name: string) => ipcRenderer.invoke(IpcChannels.workspaceRegistryRename, id, name),
  syncWorkspace: (id: string, direction: WorkspaceSyncDirection) =>
    ipcRenderer.invoke(IpcChannels.workspaceRegistrySync, id, direction),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.workspacePickDirectory),
  sendRequest: (payload: HttpRequestPayload) => ipcRenderer.invoke(IpcChannels.requestSend, payload),
  cancelRequest: (requestId: string) => ipcRenderer.invoke(IpcChannels.requestCancel, requestId),
  onWorkspaceChanged: (callback: (tree: WorkspaceNode) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, tree: WorkspaceNode) => callback(tree)
    ipcRenderer.on(IpcChannels.workspaceWatch, listener)
    return () => ipcRenderer.removeListener(IpcChannels.workspaceWatch, listener)
  },
  readRequestFile: (path: string) => ipcRenderer.invoke(IpcChannels.workspaceReadRequest, path),
  writeRequestFile: (path: string, data: RequestFileDto) => ipcRenderer.invoke(IpcChannels.workspaceWriteRequest, path, data),
  createRequest: (folderPath: string, name: string) => ipcRenderer.invoke(IpcChannels.workspaceCreateRequest, folderPath, name),
  createFolder: (parentPath: string, name: string) => ipcRenderer.invoke(IpcChannels.workspaceCreateFolder, parentPath, name),
  deleteNode: (path: string) => ipcRenderer.invoke(IpcChannels.workspaceDelete, path),
  renameNode: (path: string, newName: string) => ipcRenderer.invoke(IpcChannels.workspaceRename, path, newName),
  readFolderMeta: (folderPath: string) => ipcRenderer.invoke(IpcChannels.workspaceReadFolderMeta, folderPath),
  writeFolderMeta: (folderPath: string, data: FolderMetaInputDto) =>
    ipcRenderer.invoke(IpcChannels.workspaceWriteFolderMeta, folderPath, data),
  parseCurl: (command: string) => ipcRenderer.invoke(IpcChannels.importCurlParse, command),
  chooseFile: () => ipcRenderer.invoke(IpcChannels.dialogChooseFile),
  importPostmanCollection: (workspaceRoot: string) => ipcRenderer.invoke(IpcChannels.importPostman, workspaceRoot),
  importOpenapiSpec: (workspaceRoot: string) => ipcRenderer.invoke(IpcChannels.importOpenapi, workspaceRoot),
  listEnvironments: (workspaceRoot: string) => ipcRenderer.invoke(IpcChannels.environmentList, workspaceRoot),
  readEnvironment: (path: string) => ipcRenderer.invoke(IpcChannels.environmentRead, path),
  writeEnvironment: (path: string, data: EnvironmentFileDto) => ipcRenderer.invoke(IpcChannels.environmentWrite, path, data),
  createEnvironment: (workspaceRoot: string, name: string) => ipcRenderer.invoke(IpcChannels.environmentCreate, workspaceRoot, name),
  deleteEnvironment: (path: string) => ipcRenderer.invoke(IpcChannels.environmentDelete, path),
  getSecret: (key: string) => ipcRenderer.invoke(IpcChannels.secretGet, key),
  setSecret: (key: string, value: string) => ipcRenderer.invoke(IpcChannels.secretSet, key, value),
  listSecretKeys: () => ipcRenderer.invoke(IpcChannels.secretList),
  deleteSecret: (key: string) => ipcRenderer.invoke(IpcChannels.secretDelete, key),
  connectWebSocket: (connectionId: string, url: string, headers: KeyValue[]) =>
    ipcRenderer.invoke(IpcChannels.wsConnect, connectionId, url, headers),
  sendWebSocketMessage: (connectionId: string, data: string, isBinary?: boolean) =>
    ipcRenderer.invoke(IpcChannels.wsSend, connectionId, data, isBinary),
  closeWebSocket: (connectionId: string) => ipcRenderer.invoke(IpcChannels.wsClose, connectionId),
  onWebSocketEvent: (callback: (event: WsEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, wsEvent: WsEvent) => callback(wsEvent)
    ipcRenderer.on(IpcChannels.wsEvent, listener)
    return () => ipcRenderer.removeListener(IpcChannels.wsEvent, listener)
  },
  connectSse: (connectionId: string, url: string, headers: KeyValue[]) =>
    ipcRenderer.invoke(IpcChannels.sseConnect, connectionId, url, headers),
  closeSse: (connectionId: string) => ipcRenderer.invoke(IpcChannels.sseClose, connectionId),
  onSseEvent: (callback: (event: SseEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sseEvent: SseEvent) => callback(sseEvent)
    ipcRenderer.on(IpcChannels.sseEvent, listener)
    return () => ipcRenderer.removeListener(IpcChannels.sseEvent, listener)
  },
  subscribeGraphql: (connectionId: string, url: string, query: string, variables: Record<string, unknown>, headers: KeyValue[]) =>
    ipcRenderer.invoke(IpcChannels.graphqlSubscribe, connectionId, url, query, variables, headers),
  unsubscribeGraphql: (connectionId: string) => ipcRenderer.invoke(IpcChannels.graphqlUnsubscribe, connectionId),
  onGraphqlSubscriptionEvent: (callback: (event: GraphqlSubscriptionEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, subEvent: GraphqlSubscriptionEvent) => callback(subEvent)
    ipcRenderer.on(IpcChannels.graphqlSubscriptionEvent, listener)
    return () => ipcRenderer.removeListener(IpcChannels.graphqlSubscriptionEvent, listener)
  },
  isGitRepo: (dir: string) => ipcRenderer.invoke(IpcChannels.gitIsRepo, dir),
  initGitRepo: (dir: string) => ipcRenderer.invoke(IpcChannels.gitInit, dir),
  getGitStatus: (dir: string) => ipcRenderer.invoke(IpcChannels.gitStatus, dir),
  stageGitFile: (dir: string, filepath: string) => ipcRenderer.invoke(IpcChannels.gitStage, dir, filepath),
  unstageGitFile: (dir: string, filepath: string) => ipcRenderer.invoke(IpcChannels.gitUnstage, dir, filepath),
  stageAllGitFiles: (dir: string) => ipcRenderer.invoke(IpcChannels.gitStageAll, dir),
  commitGit: (dir: string, message: string, authorName: string, authorEmail: string) =>
    ipcRenderer.invoke(IpcChannels.gitCommit, dir, message, authorName, authorEmail),
  getGitLog: (dir: string, depth?: number) => ipcRenderer.invoke(IpcChannels.gitLog, dir, depth),
  diffGitFile: (dir: string, filepath: string) => ipcRenderer.invoke(IpcChannels.gitDiff, dir, filepath),
  pullGit: (dir: string, authorName: string, authorEmail: string, credentials?: GitCredentialsDto) =>
    ipcRenderer.invoke(IpcChannels.gitPull, dir, authorName, authorEmail, credentials),
  pushGit: (dir: string, credentials?: GitCredentialsDto) => ipcRenderer.invoke(IpcChannels.gitPush, dir, credentials),
  runCollection: (runId: string, folderPath: string, workspaceRoot: string, variables: Record<string, string>) =>
    ipcRenderer.invoke(IpcChannels.collectionRun, runId, folderPath, workspaceRoot, variables),
  onCollectionRunProgress: (callback: (event: CollectionRunProgressEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: CollectionRunProgressEvent) => callback(progress)
    ipcRenderer.on(IpcChannels.collectionRunProgress, listener)
    return () => ipcRenderer.removeListener(IpcChannels.collectionRunProgress, listener)
  },
  getNetworkSettings: () => ipcRenderer.invoke(IpcChannels.networkGetSettings),
  setNetworkSettings: (settings: NetworkSettingsDto) => ipcRenderer.invoke(IpcChannels.networkSetSettings, settings),
  listCookies: () => ipcRenderer.invoke(IpcChannels.networkListCookies),
  clearCookies: () => ipcRenderer.invoke(IpcChannels.networkClearCookies),
  getWorkspaceSettingsOverride: (workspaceRoot: string) =>
    ipcRenderer.invoke(IpcChannels.workspaceGetSettingsOverride, workspaceRoot),
  setWorkspaceSettingsOverride: (workspaceRoot: string, override: WorkspaceSettingsOverrideDto) =>
    ipcRenderer.invoke(IpcChannels.workspaceSetSettingsOverride, workspaceRoot, override),
  connectMcp: (connectionId: string, config: McpConnectionConfigDto) => ipcRenderer.invoke(IpcChannels.mcpConnect, connectionId, config),
  disconnectMcp: (connectionId: string) => ipcRenderer.invoke(IpcChannels.mcpDisconnect, connectionId),
  listMcpTools: (connectionId: string) => ipcRenderer.invoke(IpcChannels.mcpListTools, connectionId),
  listMcpResources: (connectionId: string) => ipcRenderer.invoke(IpcChannels.mcpListResources, connectionId),
  listMcpPrompts: (connectionId: string) => ipcRenderer.invoke(IpcChannels.mcpListPrompts, connectionId),
  callMcpTool: (connectionId: string, toolName: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke(IpcChannels.mcpCallTool, connectionId, toolName, args),
  readMcpResource: (connectionId: string, uri: string) => ipcRenderer.invoke(IpcChannels.mcpReadResource, connectionId, uri),
  getMcpPrompt: (connectionId: string, promptName: string, args: Record<string, string>) =>
    ipcRenderer.invoke(IpcChannels.mcpGetPrompt, connectionId, promptName, args),
  startMockServer: (port: number) => ipcRenderer.invoke(IpcChannels.mockStart, port),
  stopMockServer: () => ipcRenderer.invoke(IpcChannels.mockStop),
  getMockServerStatus: () => ipcRenderer.invoke(IpcChannels.mockStatus)
}

// Vue'nun reactive Proxy nesneleri IPC'nin structured clone algoritmasından geçemez
// ("An object could not be cloned") — kaydetme/gönderme gibi nesne taşıyan tüm çağrılar
// sessizce başarısız olur. Köprüden geçen her argüman burada düz (plain) veriye indirgenir;
// fonksiyon argümanları (event callback'leri) aynen bırakılır.
function toPlain(value: unknown): unknown {
  return value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value
}

const safeApi = Object.fromEntries(
  Object.entries(api).map(([key, fn]) => [
    key,
    (...args: unknown[]) =>
      (fn as (...fnArgs: unknown[]) => unknown)(...args.map((arg) => (typeof arg === 'function' ? arg : toPlain(arg))))
  ])
) as unknown as AntiphonApi

contextBridge.exposeInMainWorld('antiphon', safeApi)
