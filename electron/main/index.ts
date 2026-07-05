import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { is } from './utils/platform'
import { IpcChannels } from '@shared/ipc-contract'
import type {
  EnvironmentFileDto,
  FolderMetaInputDto,
  HttpRequestPayload,
  NetworkSettingsDto,
  RequestFileDto,
  WorkspaceSettingsOverrideDto
} from '@shared/ipc-contract'
import { runHttpRequest } from './engine/http-runner'
import {
  buildWorkspaceTree,
  readRequestFile,
  writeRequestFile,
  createRequestFile,
  createFolder,
  deleteNode,
  renameNode,
  readFolderMeta,
  writeFolderMeta
} from './workspace/workspace-service'
import {
  listEnvironments,
  readEnvironment,
  writeEnvironment,
  createEnvironment,
  deleteEnvironment
} from './workspace/environment-service'
import { watchWorkspace, stopWatching } from './workspace/watcher'
import {
  listWorkspaces,
  getActiveWorkspaceId,
  getWorkspace,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  setActiveWorkspace,
  syncWorkspace,
  ensureWorkspaceDir
} from './workspace/workspace-registry'
import type { CreateWorkspaceInput, WorkspaceMetaDto, WorkspaceSyncDirection } from '@shared/ipc-contract'
import { parseCurlCommand } from './import-export/curl.adapter'
import { importPostmanCollection } from './import-export/postman.adapter'
import { importOpenapiSpec } from './import-export/openapi.adapter'
import { getSecret, setSecret, listSecretKeys, deleteSecret } from './vault/secret-vault'
import { setWsWindow, wsConnect, wsSend, wsClose, closeAllWsConnections } from './engine/ws-runner'
import { setSseWindow, sseConnect, sseClose, closeAllSseConnections } from './engine/sse-runner'
import {
  setGraphqlSubscriptionWindow,
  graphqlSubscribe,
  graphqlUnsubscribe,
  disposeAllGraphqlSubscriptions
} from './engine/graphql-subscription-runner'
import type { KeyValue } from '@schema/request'
import {
  isGitRepo,
  initRepo,
  getStatus,
  stageFile,
  unstageFile,
  stageAll,
  commit,
  getLog,
  diffFile,
  pull,
  push,
  type GitCredentials
} from './git/git-service'
import { setCollectionRunnerWindow, runFolderCollection } from './engine/collection-runner-service'
import { getNetworkSettings, setNetworkSettings } from './network/network-settings'
import { listCookies, clearCookies } from './network/cookie-jar'
import { getWorkspaceSettingsOverride, setWorkspaceSettingsOverride } from './workspace/workspace-settings'
import {
  mcpConnect,
  mcpDisconnect,
  mcpListTools,
  mcpListResources,
  mcpListPrompts,
  mcpCallTool,
  mcpReadResource,
  mcpGetPrompt,
  disposeAllMcpConnections,
  type McpConnectionConfig
} from './engine/mcp-client-service'
import { startMockServer, stopMockServer, getMockServerStatus } from './mock/mock-server'

let mainWindow: BrowserWindow | null = null
let currentWorkspaceRoot: string | null = null
let currentWorkspaceName: string | null = null

// Aktif çalışma alanını izlemeye başlar; kök adını (UUID yerine) kullanıcı dostu adla değiştirir.
// Yerel dizin dışarıdan silinmiş olabileceği için önce varlığından emin olunur.
async function activateWorkspace(meta: WorkspaceMetaDto): Promise<void> {
  await ensureWorkspaceDir(meta)
  currentWorkspaceRoot = meta.localPath
  currentWorkspaceName = meta.name
  watchWorkspace(meta.localPath, refreshWorkspaceTree)
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setWsWindow(mainWindow)
  setSseWindow(mainWindow)
  setGraphqlSubscriptionWindow(mainWindow)
  setCollectionRunnerWindow(mainWindow)
}

async function refreshWorkspaceTree(): Promise<void> {
  if (!currentWorkspaceRoot || !mainWindow) return
  const tree = await buildWorkspaceTree(currentWorkspaceRoot)
  if (currentWorkspaceName) tree.name = currentWorkspaceName
  mainWindow.webContents.send(IpcChannels.workspaceWatch, tree)
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform
  }))

  ipcMain.handle(IpcChannels.workspaceOpen, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    currentWorkspaceRoot = result.filePaths[0]
    currentWorkspaceName = null
    watchWorkspace(currentWorkspaceRoot, refreshWorkspaceTree)
    return buildWorkspaceTree(currentWorkspaceRoot)
  })

  ipcMain.handle(IpcChannels.workspaceRegistryList, () => listWorkspaces())

  ipcMain.handle(IpcChannels.workspaceRegistryActive, () => getActiveWorkspaceId())

  ipcMain.handle(IpcChannels.workspacePickDirectory, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.workspaceRegistryCreate, async (_event, input: CreateWorkspaceInput) => {
    const meta = await createWorkspace(input)
    await activateWorkspace(meta)
    const tree = await buildWorkspaceTree(meta.localPath)
    tree.name = meta.name
    return { meta, tree }
  })

  ipcMain.handle(IpcChannels.workspaceRegistryOpen, async (_event, id: string) => {
    const meta = await setActiveWorkspace(id)
    if (!meta) return null
    await activateWorkspace(meta)
    const tree = await buildWorkspaceTree(meta.localPath)
    tree.name = meta.name
    return { meta, tree }
  })

  ipcMain.handle(IpcChannels.workspaceRegistryDelete, (_event, id: string) => deleteWorkspace(id))

  ipcMain.handle(IpcChannels.workspaceRegistryRename, async (_event, id: string, name: string) => {
    await renameWorkspace(id, name)
    if (currentWorkspaceRoot) {
      const active = await getActiveWorkspaceId()
      if (active === id) currentWorkspaceName = name
    }
  })

  ipcMain.handle(IpcChannels.workspaceRegistrySync, async (_event, id: string, direction: WorkspaceSyncDirection) => {
    await syncWorkspace(id, direction)
    const meta = await getWorkspace(id)
    if (!meta) return null
    const tree = await buildWorkspaceTree(meta.localPath)
    tree.name = meta.name
    return tree
  })

  ipcMain.handle(IpcChannels.requestSend, async (_event, payload: HttpRequestPayload) => {
    return runHttpRequest(payload)
  })

  ipcMain.handle(IpcChannels.workspaceReadRequest, async (_event, filePath: string) => {
    return readRequestFile(filePath)
  })

  ipcMain.handle(IpcChannels.workspaceWriteRequest, async (_event, filePath: string, data: RequestFileDto) => {
    await writeRequestFile(filePath, data)
  })

  ipcMain.handle(IpcChannels.workspaceCreateRequest, async (_event, folderPath: string, name: string) => {
    return createRequestFile(folderPath, name)
  })

  ipcMain.handle(IpcChannels.workspaceCreateFolder, async (_event, parentPath: string, name: string) => {
    return createFolder(parentPath, name)
  })

  ipcMain.handle(IpcChannels.workspaceDelete, async (_event, targetPath: string) => {
    await deleteNode(targetPath)
  })

  ipcMain.handle(IpcChannels.workspaceRename, async (_event, targetPath: string, newName: string) => {
    return renameNode(targetPath, newName)
  })

  ipcMain.handle(IpcChannels.workspaceReadFolderMeta, async (_event, folderPath: string) => {
    return readFolderMeta(folderPath)
  })

  ipcMain.handle(IpcChannels.workspaceWriteFolderMeta, async (_event, folderPath: string, data: FolderMetaInputDto) => {
    await writeFolderMeta(folderPath, data)
  })

  ipcMain.handle(IpcChannels.importCurlParse, (_event, command: string) => {
    return parseCurlCommand(command)
  })

  ipcMain.handle(IpcChannels.importPostman, async (_event, workspaceRoot: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Postman Collection', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { importedCount: 0, skipped: [], tree: null }

    const collectionJson = await readFile(result.filePaths[0], 'utf8')
    const { importedCount, skipped } = await importPostmanCollection(collectionJson, workspaceRoot)
    const tree = await buildWorkspaceTree(workspaceRoot)
    return { importedCount, skipped, tree }
  })

  ipcMain.handle(IpcChannels.importOpenapi, async (_event, workspaceRoot: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'OpenAPI Spec', extensions: ['json', 'yaml', 'yml'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { importedCount: 0, skipped: [], tree: null }

    const specText = await readFile(result.filePaths[0], 'utf8')
    const { importedCount, skipped } = await importOpenapiSpec(specText, workspaceRoot)
    const tree = await buildWorkspaceTree(workspaceRoot)
    return { importedCount, skipped, tree }
  })

  ipcMain.handle(IpcChannels.environmentList, async (_event, workspaceRoot: string) => {
    return listEnvironments(workspaceRoot)
  })

  ipcMain.handle(IpcChannels.environmentRead, async (_event, filePath: string) => {
    return readEnvironment(filePath)
  })

  ipcMain.handle(IpcChannels.environmentWrite, async (_event, filePath: string, data: EnvironmentFileDto) => {
    await writeEnvironment(filePath, data)
  })

  ipcMain.handle(IpcChannels.environmentCreate, async (_event, workspaceRoot: string, name: string) => {
    return createEnvironment(workspaceRoot, name)
  })

  ipcMain.handle(IpcChannels.environmentDelete, async (_event, filePath: string) => {
    await deleteEnvironment(filePath)
  })

  ipcMain.handle(IpcChannels.secretGet, async (_event, key: string) => {
    return getSecret(key)
  })

  ipcMain.handle(IpcChannels.secretSet, async (_event, key: string, value: string) => {
    await setSecret(key, value)
  })

  ipcMain.handle(IpcChannels.secretList, async () => {
    return listSecretKeys()
  })

  ipcMain.handle(IpcChannels.secretDelete, async (_event, key: string) => {
    await deleteSecret(key)
  })

  ipcMain.handle(IpcChannels.wsConnect, (_event, connectionId: string, url: string, headers: KeyValue[]) => {
    wsConnect(connectionId, url, headers)
  })

  ipcMain.handle(IpcChannels.wsSend, (_event, connectionId: string, data: string, isBinary?: boolean) => {
    wsSend(connectionId, data, isBinary)
  })

  ipcMain.handle(IpcChannels.wsClose, (_event, connectionId: string) => {
    wsClose(connectionId)
  })

  ipcMain.handle(IpcChannels.sseConnect, (_event, connectionId: string, url: string, headers: KeyValue[]) => {
    sseConnect(connectionId, url, headers)
  })

  ipcMain.handle(IpcChannels.sseClose, (_event, connectionId: string) => {
    sseClose(connectionId)
  })

  ipcMain.handle(
    IpcChannels.graphqlSubscribe,
    (_event, connectionId: string, url: string, query: string, variables: Record<string, unknown>, headers: KeyValue[]) => {
      graphqlSubscribe(connectionId, url, query, variables, headers)
    }
  )

  ipcMain.handle(IpcChannels.graphqlUnsubscribe, (_event, connectionId: string) => {
    graphqlUnsubscribe(connectionId)
  })

  ipcMain.handle(IpcChannels.gitIsRepo, (_event, dir: string) => {
    return isGitRepo(dir)
  })

  ipcMain.handle(IpcChannels.gitInit, async (_event, dir: string) => {
    await initRepo(dir)
  })

  ipcMain.handle(IpcChannels.gitStatus, (_event, dir: string) => {
    return getStatus(dir)
  })

  ipcMain.handle(IpcChannels.gitStage, async (_event, dir: string, filepath: string) => {
    await stageFile(dir, filepath)
  })

  ipcMain.handle(IpcChannels.gitUnstage, async (_event, dir: string, filepath: string) => {
    await unstageFile(dir, filepath)
  })

  ipcMain.handle(IpcChannels.gitStageAll, async (_event, dir: string) => {
    await stageAll(dir)
  })

  ipcMain.handle(IpcChannels.gitCommit, (_event, dir: string, message: string, authorName: string, authorEmail: string) => {
    return commit(dir, message, authorName, authorEmail)
  })

  ipcMain.handle(IpcChannels.gitLog, (_event, dir: string, depth?: number) => {
    return getLog(dir, depth)
  })

  ipcMain.handle(IpcChannels.gitDiff, (_event, dir: string, filepath: string) => {
    return diffFile(dir, filepath)
  })

  ipcMain.handle(IpcChannels.gitPull, async (_event, dir: string, authorName: string, authorEmail: string, credentials?: GitCredentials) => {
    await pull(dir, authorName, authorEmail, credentials)
  })

  ipcMain.handle(IpcChannels.gitPush, async (_event, dir: string, credentials?: GitCredentials) => {
    await push(dir, credentials)
  })

  ipcMain.handle(
    IpcChannels.collectionRun,
    (_event, runId: string, folderPath: string, workspaceRoot: string, variables: Record<string, string>) => {
      return runFolderCollection(runId, folderPath, workspaceRoot, variables)
    }
  )

  ipcMain.handle(IpcChannels.networkGetSettings, () => {
    return getNetworkSettings()
  })

  ipcMain.handle(IpcChannels.networkSetSettings, async (_event, settings: NetworkSettingsDto) => {
    await setNetworkSettings(settings)
  })

  ipcMain.handle(IpcChannels.networkListCookies, () => {
    return listCookies()
  })

  ipcMain.handle(IpcChannels.networkClearCookies, async () => {
    await clearCookies()
  })

  ipcMain.handle(IpcChannels.workspaceGetSettingsOverride, (_event, workspaceRoot: string) => {
    return getWorkspaceSettingsOverride(workspaceRoot)
  })

  ipcMain.handle(IpcChannels.workspaceSetSettingsOverride, async (_event, workspaceRoot: string, override: WorkspaceSettingsOverrideDto) => {
    await setWorkspaceSettingsOverride(workspaceRoot, override)
  })

  ipcMain.handle(IpcChannels.mcpConnect, async (_event, connectionId: string, config: McpConnectionConfig) => {
    await mcpConnect(connectionId, config)
  })

  ipcMain.handle(IpcChannels.mcpDisconnect, async (_event, connectionId: string) => {
    await mcpDisconnect(connectionId)
  })

  ipcMain.handle(IpcChannels.mcpListTools, (_event, connectionId: string) => {
    return mcpListTools(connectionId)
  })

  ipcMain.handle(IpcChannels.mcpListResources, (_event, connectionId: string) => {
    return mcpListResources(connectionId)
  })

  ipcMain.handle(IpcChannels.mcpListPrompts, (_event, connectionId: string) => {
    return mcpListPrompts(connectionId)
  })

  ipcMain.handle(IpcChannels.mcpCallTool, (_event, connectionId: string, toolName: string, args: Record<string, unknown>) => {
    return mcpCallTool(connectionId, toolName, args)
  })

  ipcMain.handle(IpcChannels.mcpReadResource, (_event, connectionId: string, uri: string) => {
    return mcpReadResource(connectionId, uri)
  })

  ipcMain.handle(IpcChannels.mcpGetPrompt, (_event, connectionId: string, promptName: string, args: Record<string, string>) => {
    return mcpGetPrompt(connectionId, promptName, args)
  })

  ipcMain.handle(IpcChannels.mockStart, async (_event, port: number) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'OpenAPI Spec', extensions: ['json', 'yaml', 'yml'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return getMockServerStatus()

    const specText = await readFile(result.filePaths[0], 'utf8')
    return startMockServer(specText, port)
  })

  ipcMain.handle(IpcChannels.mockStop, async () => {
    await stopMockServer()
  })

  ipcMain.handle(IpcChannels.mockStatus, () => {
    return getMockServerStatus()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  stopWatching()
  closeAllWsConnections()
  closeAllSseConnections()
  disposeAllGraphqlSubscriptions()
  disposeAllMcpConnections()
  stopMockServer()
  if (process.platform !== 'darwin') app.quit()
})
