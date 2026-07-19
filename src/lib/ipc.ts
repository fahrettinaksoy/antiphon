// Backend erişiminin tek noktası (seam). Renderer'daki TÜM backend çağrıları buradan geçer.
//
// Tauri `invoke` + pluginler üzerinden `AntiphonApi` yüzeyini bileşenlere sunar.
//
// Uygulanmamış metotlar aşağıdaki Proxy tarafından güvenle ele alınır:
//   - `on*` olay abonelikleri no-op bir "aboneliği iptal et" fonksiyonu döndürür (SENKRON),
//   - diğerleri açık bir "henüz uygulanmadı" hatasıyla reddeder (yakalanabilir).
import type { AntiphonApi, AppInfo, Platform } from '@shared/ipc-contract'
import { getVersion } from '@tauri-apps/api/app'
import * as coll from './collection-client'
import * as git from './git-client'
import { sendHttpRequest } from './http-client'
import * as imp from './import-client'
import * as mcp from './mcp-client'
import * as mock from './mock-client'
import * as rt from './realtime-client'
import * as reg from './registry-client'
import * as settings from './settings-client'
import * as ws from './workspace-client'

function toPlain(value: unknown): unknown {
  return value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('win')) return 'win32'
  if (ua.includes('android')) return 'android'
  return 'linux'
}

function notImplemented(name: string): Promise<never> {
  return Promise.reject(new Error(`[antiphon] "${name}" henüz Tauri göçünde uygulanmadı.`))
}

// Uygulanmış metotlar. Kalanları aşağıdaki Proxy güvenli biçimde ele alır.
const impl: Partial<AntiphonApi> = {
  getAppInfo: async (): Promise<AppInfo> => ({
    version: await getVersion().catch(() => '0.1.0'),
    platform: detectPlatform()
  }),
  sendRequest: (payload) => sendHttpRequest(payload),
  cancelRequest: async () => {},

  // Çalışma alanı kayıt defteri (Faz 4)
  listWorkspaces: () => reg.listWorkspaces(),
  getActiveWorkspaceId: () => reg.getActiveWorkspaceId(),
  createWorkspace: (input) => reg.createWorkspace(input),
  openWorkspaceById: (id) => reg.openWorkspaceById(id),
  deleteWorkspace: (id) => reg.deleteWorkspace(id),
  renameWorkspace: (id, name) => reg.renameWorkspace(id, name),
  updateWorkspace: (id, patch) => reg.updateWorkspace(id, patch),
  syncWorkspace: (id, direction) => reg.syncWorkspace(id, direction),
  getWorkspaceSettingsOverride: (root) => reg.getWorkspaceSettingsOverride(root),
  setWorkspaceSettingsOverride: (root, override) =>
    reg.setWorkspaceSettingsOverride(root, override),

  // Çalışma alanı — dosya sistemi (Faz 2)
  openWorkspace: () => ws.openWorkspace(),
  pickDirectory: () => ws.pickDirectory(),
  chooseFile: () => ws.chooseFile(),
  readRequestFile: (path) => ws.readRequestFile(path),
  writeRequestFile: (path, data) => ws.writeRequestFile(path, data),
  createRequest: (folderPath, name) => ws.createRequest(folderPath, name),
  createFolder: (parentPath, name) => ws.createFolder(parentPath, name),
  deleteNode: (path) => ws.deleteNode(path),
  renameNode: (path, newName) => ws.renameNode(path, newName),
  readFolderMeta: (folderPath) => ws.readFolderMeta(folderPath),
  writeFolderMeta: (folderPath, data) => ws.writeFolderMeta(folderPath, data),

  // İçe aktarma (Faz 8)
  parseCurl: (command) => imp.parseCurl(command),
  importPostmanCollection: (workspaceRoot) => imp.importPostmanCollection(workspaceRoot),
  importOpenapiSpec: (workspaceRoot) => imp.importOpenapiSpec(workspaceRoot),

  // Koleksiyon çalıştırıcı (Faz 8b)
  runCollection: (runId, folderPath, workspaceRoot, variables) =>
    coll.runCollection(runId, folderPath, workspaceRoot, variables),
  onCollectionRunProgress: (callback) => coll.onCollectionRunProgress(callback),

  // Ortamlar
  listEnvironments: (root) => ws.listEnvironments(root),
  readEnvironment: (path) => ws.readEnvironment(path),
  writeEnvironment: (path, data) => ws.writeEnvironment(path, data),
  createEnvironment: (root, name) => ws.createEnvironment(root, name),
  deleteEnvironment: (path) => ws.deleteEnvironment(path),

  // Dosya izleyici (Faz 3) — aktif çalışma alanı değişince ağaç tazelenir.
  onWorkspaceChanged: (callback) => ws.onWorkspaceChanged(callback),

  // Git (Faz 5)
  isGitRepo: (dir) => git.isGitRepo(dir),
  initGitRepo: (dir) => git.initGitRepo(dir),
  getGitStatus: (dir) => git.getGitStatus(dir),
  stageGitFile: (dir, filepath) => git.stageGitFile(dir, filepath),
  unstageGitFile: (dir, filepath) => git.unstageGitFile(dir, filepath),
  stageAllGitFiles: (dir) => git.stageAllGitFiles(dir),
  commitGit: (dir, message, authorName, authorEmail) =>
    git.commitGit(dir, message, authorName, authorEmail),
  getGitLog: (dir, depth) => git.getGitLog(dir, depth),
  diffGitFile: (dir, filepath) => git.diffGitFile(dir, filepath),
  pullGit: (dir, authorName, authorEmail, credentials) =>
    git.pullGit(dir, authorName, authorEmail, credentials),
  pushGit: (dir, credentials) => git.pushGit(dir, credentials),

  // Secret vault + ağ ayarları + çerezler (Faz 6)
  getSecret: (key) => settings.getSecret(key),
  setSecret: (key, value) => settings.setSecret(key, value),
  listSecretKeys: () => settings.listSecretKeys(),
  deleteSecret: (key) => settings.deleteSecret(key),
  getNetworkSettings: () => settings.getNetworkSettings(),
  setNetworkSettings: (s) => settings.setNetworkSettings(s),
  listCookies: () => settings.listCookies(),
  clearCookies: () => settings.clearCookies(),

  // Realtime — WebSocket / SSE / GraphQL subscription (Faz 7)
  connectWebSocket: (connectionId, url, headers) => rt.connectWebSocket(connectionId, url, headers),
  sendWebSocketMessage: (connectionId, data, isBinary) =>
    rt.sendWebSocketMessage(connectionId, data, isBinary),
  closeWebSocket: (connectionId) => rt.closeWebSocket(connectionId),
  onWebSocketEvent: (callback) => rt.onWebSocketEvent(callback),
  connectSse: (connectionId, url, headers) => rt.connectSse(connectionId, url, headers),
  closeSse: (connectionId) => rt.closeSse(connectionId),
  onSseEvent: (callback) => rt.onSseEvent(callback),
  subscribeGraphql: (connectionId, url, query, variables, headers) =>
    rt.subscribeGraphql(connectionId, url, query, variables, headers),
  unsubscribeGraphql: (connectionId) => rt.unsubscribeGraphql(connectionId),
  onGraphqlSubscriptionEvent: (callback) => rt.onGraphqlSubscriptionEvent(callback),

  // MCP (Faz 9)
  connectMcp: (connectionId, config) => mcp.connectMcp(connectionId, config),
  disconnectMcp: (connectionId) => mcp.disconnectMcp(connectionId),
  listMcpTools: (connectionId) => mcp.listMcpTools(connectionId),
  listMcpResources: (connectionId) => mcp.listMcpResources(connectionId),
  listMcpPrompts: (connectionId) => mcp.listMcpPrompts(connectionId),
  callMcpTool: (connectionId, toolName, args) => mcp.callMcpTool(connectionId, toolName, args),
  readMcpResource: (connectionId, uri) => mcp.readMcpResource(connectionId, uri),
  getMcpPrompt: (connectionId, promptName, args) =>
    mcp.getMcpPrompt(connectionId, promptName, args),

  // Mock server (Faz 9)
  startMockServer: (port) => mock.startMockServer(port),
  stopMockServer: () => mock.stopMockServer(),
  getMockServerStatus: () => mock.getMockServerStatus()
}

export const ipc: AntiphonApi = new Proxy(impl as AntiphonApi, {
  get(target, prop: string) {
    const member = (target as unknown as Record<string, unknown>)[prop]
    if (typeof member === 'function') {
      return (...args: unknown[]) =>
        (member as (...fnArgs: unknown[]) => unknown)(
          ...args.map((arg) => (typeof arg === 'function' ? arg : toPlain(arg)))
        )
    }
    // Olay abonelikleri (onWorkspaceChanged, onWebSocketEvent, ...): kurulumda çağrılır,
    // bir temizlik fonksiyonu döndürmeleri beklenir → no-op unsubscribe (SENKRON).
    if (/^on[A-Z]/.test(prop)) {
      return () => () => {}
    }
    return () => notImplemented(prop)
  }
})
