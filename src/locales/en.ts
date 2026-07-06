export default {
  app: {
    name: 'Antiphon'
  },
  header: {
    home: 'Home',
    workspaces: 'Workspaces',
    import: 'Import',
    explore: 'Explore',
    mockServer: 'Mock Server',
    searchPlaceholder: 'Search Antiphon'
  },
  actions: {
    send: 'Send',
    save: 'Save',
    newRequest: 'New Request',
    openWorkspace: 'Open Workspace',
    cancel: 'Cancel',
    clear: 'Clear'
  },
  sidebar: {
    collections: 'Collections',
    apis: 'APIs',
    environments: 'Environments',
    mockServers: 'Mock Servers',
    monitors: 'Monitors',
    history: 'History',
    comingSoon: 'This section is coming soon',
    empty: 'No workspace open yet',
    emptyHint: 'Pick a folder to get started',
    noCollections: 'No collections yet',
    newCollectionTitle: 'New Collection',
    search: 'Search…',
    filter: 'Filter',
    clearFilter: 'Clear filter',
    add: 'Add new',
    noMatches: 'No matching items',
    searchCollections: 'Search collections…',
    searchEnvironments: 'Search environments…',
    searchHistory: 'Search history…',
    activeEnvironment: 'Active environment',
    newMenu: {
      groupAi: 'AI',
      groupRequests: 'Request Types',
      groupOther: 'Other',
      askAi: 'Ask AI',
      http: 'HTTP',
      graphql: 'GraphQL',
      graphqlName: 'New GraphQL',
      ai: 'AI',
      mcp: 'MCP',
      mcpName: 'New MCP',
      grpc: 'gRPC',
      websocket: 'WebSocket',
      wsName: 'New WebSocket',
      socketio: 'Socket.IO',
      mqtt: 'MQTT',
      collection: 'Collection',
      environment: 'Environment',
      spec: 'Spec',
      mock: 'Mock',
      monitor: 'Monitor',
      webhook: 'Webhook',
      flow: 'Flow',
      newEnvironmentTitle: 'New Environment'
    }
  },
  common: {
    comingSoon: 'Coming soon'
  },
  workspace: {
    createTitle: 'Create your workspace',
    createButton: 'Create Workspace',
    create: 'Create',
    newWorkspace: 'New Workspace',
    searchPlaceholder: 'Search workspaces…',
    viewAll: 'View all workspaces',
    allTitle: 'Workspaces',
    delete: 'Delete',
    open: 'Open',
    rename: 'Rename',
    you: 'You',
    activeBadge: 'Active',
    noResults: 'No workspaces found',
    tabs: {
      all: 'All',
      local: 'Local',
      remote: 'Remote'
    },
    table: {
      name: 'Name',
      creator: 'Creator',
      contributors: 'Contributors',
      lastActivity: 'Last activity',
      access: 'Access',
      role: 'Your role'
    },
    access: {
      personal: 'Only you',
      internal: 'Everyone in your team',
      public: 'Public'
    },
    nameLabel: 'Workspace name',
    namePlaceholder: 'A team name, project or service…',
    storageLabel: 'Storage',
    visibilityLabel: 'Visibility',
    push: 'Push to remote (backup)',
    pull: 'Pull from remote (restore)',
    storage: {
      local: 'Local',
      localDesc: 'Files stored on this computer.',
      gist: 'GitHub Gist',
      gistDesc: 'Sync with a secret gist.',
      webdav: 'WebDAV',
      webdavDesc: 'Sync with a WebDAV server.'
    },
    local: {
      scratch: 'Start from scratch',
      scratchDesc: 'Create a new, empty workspace.',
      folder: 'Connect existing folder',
      chooseFolder: 'Choose a Folder'
    },
    gist: {
      token: 'GitHub Personal Access Token',
      tokenHint: 'A token with the "gist" scope. Stored securely in the OS keychain.',
      gistId: 'Existing Gist ID (optional)',
      gistIdHint: 'Leave empty to create a new secret gist.'
    },
    webdav: {
      url: 'WebDAV folder URL',
      username: 'Username',
      password: 'Password'
    },
    visibility: {
      personal: 'Personal',
      internal: 'Team',
      public: 'Public'
    }
  },
  request: {
    urlPlaceholder: 'Enter request URL or paste a cURL command',
    tabs: { params: 'Params', headers: 'Headers', body: 'Body', auth: 'Auth', scripts: 'Scripts', docs: 'Docs', settings: 'Settings' }
  },
  // Koleksiyon, klasör ve istek editörlerinin ortak kimlik doğrulama paneli
  auth: {
    type: 'Auth type',
    username: 'Username',
    password: 'Password',
    token: 'Token',
    secret: 'Secret (HS256)',
    header: 'Header',
    queryParam: 'Query Param',
    inherit: 'Inherit auth from parent',
    inheritHint: 'Authorization is inherited from the parent folder/collection; if none is defined above, no auth is applied.'
  },
  response: {
    tabs: { body: 'Body', headers: 'Headers', cookies: 'Cookies', timing: 'Timing', tests: 'Tests' },
    waiting: 'Waiting for response',
    placeholder: 'Send a request to see the response'
  },
  palette: {
    placeholder: 'Type a command or search…'
  },
  collection: {
    open: 'Open Collection',
    run: 'Run',
    passed: 'passed',
    subtitle: 'Collection settings — applied to every request in this folder',
    folderSubtitle: 'Folder settings — applied to every request in this folder',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Add notes describing this collection…',
    authHint: 'This authorization is applied to every request in the collection unless overridden.',
    folderAuthHint: 'This authorization is applied to every request in this folder unless overridden.',
    noAuth: 'No Auth',
    noAuthHint: 'No authorization is applied to this collection.',
    inheritAuth: 'Inherit auth from parent',
    inheritAuthHint: 'Authorization is inherited from the parent folder/collection.',
    commonHeaders: 'Common Headers',
    preRequest: 'Pre-request Script',
    postResponse: 'Post-response Script',
    variablesHint: 'Collection variables are available to every request in this collection.',
    noRuns: 'Collection has not been run yet',
    noRunsHint: 'Press Run to execute all requests in sequence',
    tabs: {
      overview: 'Overview',
      authorization: 'Authorization',
      scripts: 'Scripts',
      variables: 'Variables',
      runs: 'Runs'
    }
  },
  empty: {
    noWorkspace: 'No workspace opened yet',
    noWorkspaceHint: 'Pick a folder to get started',
    noEnvironments: 'No environments added yet',
    noEnvironmentsHint: 'Define variables for your requests',
    noCollections: 'No collections yet',
    noHistory: 'No requests sent yet',
    noHistoryHint: 'Requests you send are listed here',
    noResponse: 'Send a request to see the response',
    noEvents: 'No events yet',
    noMessages: 'No messages yet',
    noEndpoints: 'No endpoints yet',
    noData: 'No data'
  },
  settings: {
    title: 'Settings',
    theme: 'Theme',
    themeHint: 'Pick a theme — previews show the real colors',
    language: 'Language',
    dark: 'Dark',
    system: 'System',
    contrast: 'Contrast',
    contrastHint: 'High contrast strengthens colors for WCAG accessibility',
    contrastNormal: 'Normal',
    contrastHigh: 'High',
    light: 'Light'
  }
}
