export default {
  app: {
    name: 'Antiphon'
  },
  header: {
    toggleSidebar: 'Kenar çubuğunu göster/gizle',
    home: 'Ana Sayfa',
    workspaces: 'Çalışma Alanı',
    import: 'İçe Aktar',
    explore: 'Keşfet',
    mockServer: 'Mock Server',
    searchPlaceholder: "Antiphon'da ara"
  },
  actions: {
    send: 'Gönder',
    save: 'Kaydet',
    newRequest: 'Yeni İstek',
    openWorkspace: 'Çalışma Alanı Aç',
    cancel: 'İptal',
    clear: 'Temizle'
  },
  sidebar: {
    collections: 'Koleksiyonlar',
    apis: "API'ler",
    environments: 'Ortamlar',
    mockServers: 'Mock Sunucular',
    monitors: 'İzleyiciler',
    history: 'Geçmiş',
    comingSoon: 'Bu bölüm yakında geliyor',
    empty: 'Henüz bir çalışma alanı açılmadı',
    emptyHint: 'Başlamak için bir klasör seçin',
    noCollections: 'Henüz koleksiyon yok',
    newCollectionTitle: 'Yeni Koleksiyon',
    search: 'Ara…',
    filter: 'Filtre',
    clearFilter: 'Filtreyi temizle',
    add: 'Yeni ekle',
    noMatches: 'Eşleşen öğe yok',
    searchCollections: 'Koleksiyonlarda ara…',
    searchEnvironments: 'Ortamlarda ara…',
    searchHistory: 'Geçmişte ara…',
    activeEnvironment: 'Aktif ortam',
    today: 'Bugün',
    yesterday: 'Dün',
    entryCount: 'Toplam {n} kayıt',
    newMenu: {
      groupAi: 'Yapay Zeka',
      groupRequests: 'İstek Türleri',
      groupOther: 'Diğer',
      askAi: "AI'ya Sor",
      http: 'HTTP',
      graphql: 'GraphQL',
      graphqlName: 'Yeni GraphQL',
      ai: 'AI',
      mcp: 'MCP',
      mcpName: 'Yeni MCP',
      grpc: 'gRPC',
      websocket: 'WebSocket',
      wsName: 'Yeni WebSocket',
      socketio: 'Socket.IO',
      mqtt: 'MQTT',
      collection: 'Koleksiyon',
      environment: 'Ortam (Environment)',
      spec: 'Spec',
      mock: 'Mock',
      monitor: 'Monitor',
      webhook: 'Webhook',
      flow: 'Flow',
      newEnvironmentTitle: 'Yeni Ortam'
    }
  },
  common: {
    comingSoon: 'Yakında'
  },
  workspace: {
    createTitle: 'Çalışma alanı oluştur',
    createButton: 'Çalışma Alanı Oluştur',
    create: 'Oluştur',
    newWorkspace: 'Yeni Çalışma Alanı',
    searchPlaceholder: 'Çalışma alanı ara…',
    viewAll: 'Tüm çalışma alanları',
    allTitle: 'Çalışma Alanları',
    delete: 'Sil',
    open: 'Aç',
    rename: 'Yeniden Adlandır',
    edit: 'Düzenle',
    editTitle: 'Çalışma Alanını Düzenle',
    invite: 'Ekibi Davet Et',
    inviteLocalHint:
      'Bu çalışma alanı yerel bir klasördür. Klasörü bir git deposuna push\'layıp ekibinizle paylaşın; ekip arkadaşlarınız "Mevcut klasöre bağlan" ile aynı alanı açabilir.',
    inviteGistHint:
      "Ekip arkadaşlarınız, kendi GitHub token'ları ve aşağıdaki Gist ID ile yeni bir çalışma alanı oluşturarak bu alana bağlanabilir.",
    inviteWebdavHint:
      'Ekip arkadaşlarınız, aşağıdaki WebDAV adresi ve kendi kimlik bilgileriyle yeni bir çalışma alanı oluşturarak bu alana bağlanabilir.',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    you: 'Sen',
    activeBadge: 'Aktif',
    noResults: 'Çalışma alanı bulunamadı',
    tabs: {
      all: 'Tümü',
      local: 'Yerel',
      remote: 'Uzak'
    },
    table: {
      name: 'Ad',
      creator: 'Oluşturan',
      contributors: 'Katkıda bulunanlar',
      lastActivity: 'Son etkinlik',
      access: 'Erişim',
      role: 'Rolün'
    },
    access: {
      personal: 'Sadece sen',
      internal: 'Ekibindeki herkes',
      public: 'Herkese açık'
    },
    nameLabel: 'Çalışma alanı adı',
    namePlaceholder: 'Bir ekip adı, proje veya servis…',
    storageLabel: 'Depolama',
    visibilityLabel: 'Görünürlük',
    push: 'Uzağa gönder (yedekle)',
    pull: 'Uzaktan çek (geri yükle)',
    storage: {
      local: 'Yerel',
      localDesc: 'Dosyalar bu bilgisayarda saklanır.',
      gist: 'GitHub Gist',
      gistDesc: 'Gizli bir gist ile senkronla.',
      webdav: 'WebDAV',
      webdavDesc: 'Bir WebDAV sunucusuyla senkronla.'
    },
    local: {
      scratch: 'Sıfırdan başla',
      scratchDesc: 'Yeni, boş bir çalışma alanı oluştur.',
      folder: 'Mevcut klasöre bağlan',
      chooseFolder: 'Klasör Seç'
    },
    gist: {
      token: 'GitHub Personal Access Token',
      tokenHint: '"gist" yetkisi olan bir token. OS anahtarlığında güvenle saklanır.',
      gistId: 'Mevcut Gist ID (opsiyonel)',
      gistIdHint: 'Boş bırakılırsa yeni bir gizli gist oluşturulur.'
    },
    webdav: {
      url: 'WebDAV klasör URL’si',
      username: 'Kullanıcı adı',
      password: 'Parola'
    },
    visibility: {
      personal: 'Kişisel',
      internal: 'Ekip',
      public: 'Herkese açık'
    }
  },
  request: {
    urlPlaceholder: "İstek URL'sini girin veya bir cURL yapıştırın",
    tabs: {
      params: 'Parametreler',
      headers: 'Başlıklar',
      body: 'Gövde',
      auth: 'Kimlik Doğrulama',
      scripts: "Script'ler",
      docs: 'Dokümantasyon',
      settings: 'Ayarlar'
    }
  },
  // İsteği kaydet çekmecesi
  saveRequest: {
    title: 'İsteği Kaydet',
    nameLabel: 'İstek adı',
    saveTo: 'Kaydedilecek yer:',
    searchPlaceholder: 'Koleksiyon veya klasör ara…',
    newFolder: 'Yeni Klasör',
    noFolders: 'Henüz koleksiyon yok — istek çalışma alanı köküne kaydedilir.'
  },
  // Ana sayfa
  home: {
    title: 'Ana Sayfa',
    latestActivity: 'Son etkinlik',
    noActivity: 'Henüz etkinlik yok',
    noActivityHint: 'Bir istek gönderdiğinizde burada görünür.',
    favorites: 'Favoriler',
    noFavorites: 'Henüz favori yok',
    noFavoritesHint: 'Çalışma Alanları sayfasında yıldız ikonuyla favorileyin.',
    recentWorkspaces: 'Son kullanılanlar',
    viewAll: 'Tümünü gör'
  },
  // Git paneli
  git: {
    refresh: 'Yenile',
    pull: 'Çek',
    push: 'Gönder',
    changes: 'Değişiklikler',
    history: 'Geçmiş',
    unstagedTitle: 'Değişiklikler',
    stagedTitle: 'Sahnelenenler',
    stageAll: 'Tümünü sahnele',
    stage: 'Sahnele',
    unstage: 'Sahneden çıkar',
    commitMessage: 'Commit mesajı',
    commitPlaceholder: 'Değişiklikleri kısaca özetleyin…',
    noChanges: 'Değişiklik yok — çalışma dizini temiz',
    noCommits: 'Henüz commit yok',
    notRepo: 'Bu çalışma alanı bir Git deposu değil',
    notRepoHint: 'Sürüm geçmişi tutmak için bir depo başlatın.',
    initRepo: 'Git Deposu Başlat',
    noWorkspace: 'Önce bir çalışma alanı açın.'
  },
  // Ortam düzenleyici sekmesi
  environment: {
    subtitle:
      'Ortam değişkenleri — istek URL, başlık ve gövdelerinde çift süslü parantezle kullanılır',
    variables: 'Değişkenler',
    variablesHint: 'Anahtar/değer çiftleri; kaydetme otomatiktir.',
    makeActive: 'Aktif Yap',
    active: 'Aktif',
    newTitle: 'Yeni Ortam',
    delete: 'Sil',
    editSelected: 'Seçili ortamı düzenle',
    selectFirst: 'Önce bir ortam seçin'
  },
  // Koleksiyon, klasör ve istek editörlerinin ortak kimlik doğrulama paneli
  auth: {
    type: 'Kimlik doğrulama türü',
    username: 'Kullanıcı adı',
    password: 'Parola',
    token: 'Token',
    secret: 'Secret (HS256)',
    header: 'Header',
    queryParam: 'Query Param',
    inherit: 'Üst öğeden devral',
    inheritHint:
      'Kimlik doğrulama üst klasörden/koleksiyondan devralınır; hiçbir üst öğede tanımlı değilse uygulanmaz.'
  },
  response: {
    tabs: { body: 'Gövde', headers: 'Başlıklar', cookies: 'Çerezler', tests: 'Testler' },
    waiting: 'Yanıt bekleniyor',
    placeholder: 'Yanıtı görmek için bir istek gönderin',
    viewText: 'Metin',
    viewTree: 'Ağaç',
    wrap: 'Satır kaydırma',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    binaryBody: 'İkili (binary) içerik — metin olarak gösterilemiyor.',
    filter: 'Filtrele',
    filterPlaceholder: 'JSONPath ile filtrele — ör. $.result.head',
    search: 'Ara',
    noMatch: 'Eşleşme yok',
    props: 'özellik',
    items: 'öğe',
    cookieAttributes: 'Öznitelikler',
    noCookies: 'Sunucudan çerez gelmedi',
    noCookiesHint: 'Bu isteğin çerezleri ve ilişkili alan adları burada görünür.',
    noTests: 'Test tanımlanmadı',
    noTestsHint: "Script'ler sekmesinde pm.test(...) ile test yazın.",
    status2xx: 'İstek başarılı — sunucu beklendiği gibi yanıt verdi.',
    status3xx: 'Yönlendirme — kaynak başka bir adreste.',
    status4xx: 'İstemci hatası — istek sunucu tarafından reddedildi.',
    status5xx: 'Sunucu hatası — sunucu isteği işleyemedi.',
    responseTime: 'Yanıt Süresi',
    timingPrepare: 'Hazırlık',
    timingSocket: 'Soket Başlatma',
    timingDns: 'DNS Sorgusu',
    timingTcp: 'TCP El Sıkışma',
    timingTls: 'SSL/TLS El Sıkışma',
    timingTtfb: 'İlk Bayt (TTFB)',
    timingDownload: 'İndirme',
    timingProcess: 'İşleme',
    timingTotal: 'Toplam',
    responseSize: 'Yanıt Boyutu',
    requestSize: 'İstek Boyutu',
    sizeHeaders: 'Başlıklar',
    sizeBody: 'Gövde',
    network: 'Ağ',
    httpVersion: 'HTTP Sürümü',
    localAddress: 'Yerel Adres',
    remoteAddress: 'Uzak Adres',
    tlsProtocol: 'TLS Protokolü',
    cipherName: 'Şifre Takımı',
    certCn: 'Sertifika CN',
    certIssuerCn: 'Veren CN',
    certValidUntil: 'Geçerlilik Sonu'
  },
  palette: {
    placeholder: 'Bir komut yazın veya arayın…'
  },
  collection: {
    open: 'Koleksiyonu Aç',
    run: 'Çalıştır',
    passed: 'başarılı',
    subtitle: 'Koleksiyon ayarları — bu klasördeki tüm isteklere uygulanır',
    folderSubtitle: 'Klasör ayarları — bu klasördeki tüm isteklere uygulanır',
    descriptionLabel: 'Açıklama',
    descriptionPlaceholder: 'Bu koleksiyonu açıklayan notlar ekleyin…',
    authHint:
      'Bu kimlik doğrulama, üzerine yazmadığı sürece koleksiyondaki tüm isteklere uygulanır.',
    folderAuthHint:
      'Bu kimlik doğrulama, üzerine yazmadığı sürece bu klasördeki tüm isteklere uygulanır.',
    noAuth: 'Yok',
    noAuthHint: 'Bu koleksiyon için kimlik doğrulama uygulanmıyor.',
    inheritAuth: 'Üst öğeden devral',
    inheritAuthHint: 'Kimlik doğrulama üst klasörden/koleksiyondan devralınır.',
    commonHeaders: "Ortak Header'lar",
    preRequest: 'Pre-request Script',
    postResponse: 'Post-response Script',
    variablesHint: 'Koleksiyon değişkenleri bu koleksiyondaki tüm isteklerde kullanılabilir.',
    noRuns: 'Koleksiyon henüz çalıştırılmadı',
    noRunsHint: 'Tüm istekleri sırayla çalıştırmak için Çalıştır’a basın',
    tabs: {
      overview: 'Genel Bakış',
      authorization: 'Kimlik Doğrulama',
      scripts: "Script'ler",
      variables: 'Değişkenler',
      runs: 'Çalıştırmalar'
    }
  },
  empty: {
    noWorkspace: 'Henüz bir çalışma alanı açılmadı',
    noWorkspaceHint: 'Başlamak için bir klasör seçin',
    noEnvironments: 'Henüz ortam eklenmedi',
    noEnvironmentsHint: 'İstekleriniz için değişkenler tanımlayın',
    noCollections: 'Henüz koleksiyon yok',
    noHistory: 'Henüz istek gönderilmedi',
    noHistoryHint: 'Gönderdiğiniz istekler burada listelenir',
    noResponse: 'Yanıtı görmek için bir istek gönderin',
    noEvents: 'Henüz event yok',
    noMessages: 'Henüz mesaj yok',
    noEndpoints: 'Henüz endpoint yok',
    noData: 'Veri yok'
  },
  settings: {
    title: 'Ayarlar',
    theme: 'Tema',
    themeHint: 'Bir tema seçin — önizlemeler gerçek renkleri gösterir',
    language: 'Dil',
    dark: 'Koyu',
    system: 'Sistem',
    contrast: 'Kontrast',
    contrastHint: 'Yüksek kontrast, WCAG erişilebilirliği için renkleri güçlendirir',
    contrastNormal: 'Normal',
    contrastHigh: 'Yüksek',
    light: 'Açık'
  }
}
