# API Client Projesi — Kapsamlı Rakip Analizi ve Teknik Mimari Raporu

> **Proje:** Vue.js + Electron tabanlı modern API Client (REST, GraphQL, WebSocket vb.)
> **Hedef Stack:** Vue.js 3 + Electron + Vuetify 3 + Pinia + VueUse + Vue I18n + Vue Router
> **Rapor Tarihi:** Temmuz 2026
> **Kapsam:** 16 rakip ürün/repo analizi (Hoppscotch, Bruno, Thunder Client, RapidAPI, HTTPie, Insomnia, GetAPI, Scalar, Yaak, Posting, Voiden, Apidog, ATAC + repo'ları), pazar dinamikleri, mimari öneri, veri formatı stratejisi ve yol haritası

---

## İçindekiler

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Pazar Dinamikleri: Postman Sonrası Dönem](#2-pazar-dinamikleri-postman-sonrası-dönem)
3. [Rakip Ürün Analizleri](#3-rakip-ürün-analizleri)
4. [Karşılaştırmalı Matris](#4-karşılaştırmalı-matris)
5. [Pazar Boşluğu ve Konumlandırma](#5-pazar-boşluğu-ve-konumlandırma)
6. [Kritik Mimari Karar: Veri Depolama Formatı](#6-kritik-mimari-karar-veri-depolama-formatı)
7. [Protokol Implementasyon Stratejileri](#7-protokol-implementasyon-stratejileri)
8. [Önerilen Teknik Mimari](#8-önerilen-teknik-mimari)
9. [Scripting Motoru ve Güvenlik](#9-scripting-motoru-ve-güvenlik)
10. [Özellik Seti ve MoSCoW Önceliklendirme](#10-özellik-seti-ve-moscow-önceliklendirme)
11. [Yol Haritası (Roadmap)](#11-yol-haritası-roadmap)
12. [Riskler ve Azaltma Stratejileri](#12-riskler-ve-azaltma-stratejileri)
13. [Lisans Değerlendirmesi](#13-lisans-değerlendirmesi)
14. [Sonuç ve Öneriler](#14-sonuç-ve-öneriler)

---

## 1. Yönetici Özeti

API client pazarı, 2023'te Postman'in Scratchpad'i kaldırıp zorunlu hesap/cloud'a geçmesiyle başlayan ve Mart 2026'da free plan'ı tek kullanıcı + ayda 25 collection run ile kısıtlamasıyla zirveye çıkan bir **büyük göç dalgası** yaşıyor. Bu dalga dört farklı felsefeyi besledi:

1. **Git-native / dosya-tabanlı** (Bruno 43.8k⭐, Voiden, Yaak): Collection'lar düz metin dosyası; Git = collaboration katmanı; hesap yok.
2. **Açık kaynak ekosistem / self-hosted** (Hoppscotch 79.4k⭐, Insomnia): Web + desktop + CLI; team/RBAC/SSO ile kurumsal self-host.
3. **All-in-one lifecycle platformu** (Apidog, Scalar, Insomnia 13): Design-first — spec, mock, test ve docs tek üründe.
4. **Terminal/TUI minimalizmi** (Posting 12k⭐, ATAC, HTTPie): Klavye-odaklı, SSH üzerinden çalışan hafif client'lar.

**Kritik bulgular:**

- **Hoppscotch, Vue.js ile yazılmış ve pazarın en yıldızlı API aracı (79.4k⭐).** Bu, sizin stack'iniz için birebir referans kod tabanı demek — hem de MIT lisanslı. Ancak Hoppscotch web-first'tür; desktop uygulaması ikincil ve Tauri tabanlıdır.
- **Bruno ve Voiden, Electron'un bu kategoride kanıtlanmış tercih olduğunu gösteriyor.** Voiden ekibi "Why Electron (and not Tauri)" başlıklı bir yazıyla bu tercihi savunmuş durumda.
- Pazarın iki kutbu netleşti: **"local-first + Git-native + hesapsız"** (developer sadakati kazanan model) vs. **"cloud platform + subscription"** (Postman'in kan kaybettiği model). Yeni bir ürünün birinci kutupta doğması zorunlu.
- **Boşluk:** Vue + Electron ile yazılmış, Git-native dosya formatlı, Vuetify kalitesinde masaüstü UX'i sunan, TR dahil tam yerelleştirilmiş bir **desktop-first** API client yok. Hoppscotch Vue ama web-first; Bruno desktop-first ama React/JS ve UI'ı sade.

**Önerilen strateji:** Bruno'nun felsefesi (Git-native, offline, hesapsız) + Hoppscotch'un protokol genişliği ve Vue kod mirası + Yaak'ın UX inceliği (command palette, template functions, request chaining) kombinasyonunu, Vuetify tabanlı özgün bir masaüstü deneyimiyle sunmak. MVP odağı: REST + environment + Git-friendly dosya formatı + Postman/Insomnia/OpenAPI import.

---

## 2. Pazar Dinamikleri: Postman Sonrası Dönem

| Olay | Etkisi |
|---|---|
| **2023 — Postman Scratchpad'i kaldırdı** | Local çalışma imkânı bitti; Bruno bu tepkiyle patladı ("Postman sunsetted scratchpad... Alternative? Bruno" — dönemin viral tweet'leri) |
| **2019/2023 — Insomnia satışı ve hesap zorunluluğu krizi** | Insomnia'nın kurucusu Greg Schier ürünü Kong'a sattı; 2023'teki zorunlu login krizi kullanıcı kaçışı yarattı. Schier'in yeni ürünü **Yaak**, "NO LOGIN POPUPS" mesajıyla pazarlanıyor |
| **Kasım 2024 — Nokia, Rapid'i (RapidAPI) satın aldı** | Bir zamanlar $1B değerlemeli API marketplace, telco network API'lerine yöneldi; genel amaçlı API hub alanı boşaldı |
| **Mart 2026 — Postman free plan kısıtlaması** | Tek kullanıcı + ayda 25 collection run → Apidog, Bruno, Hoppscotch'a yeni göç dalgası |
| **2025-2026 — MCP (Model Context Protocol) dalgası** | Insomnia (MCP client), Apidog (Ocak 2026 MCP desteği), RapidAPI (hub'da MCP) — API client'lar AI-agent araçlarına dönüşüyor; Yaak "agent-friendly CLI" ile konumlanıyor |

**Ders:** Bu pazarda güven = "hesap yok, cloud yok, veri senin" taahhüdü. Bruno README'sinde açıkça "*There are no plans to add cloud-sync to Bruno, ever*" yazıyor ve bu cümle ürünün en güçlü pazarlama aracı. Yeni ürün bu taahhüdü birinci günden vermelidir.

---

## 3. Rakip Ürün Analizleri

### 3.1 Hoppscotch — **Vue Ekosisteminin Devi, Birincil Kod Referansı**

| Özellik | Detay |
|---|---|
| **GitHub** | ⭐ 79.4k · 5.9k fork · MIT · 104 release, çok aktif |
| **Stack** | **TypeScript %67.7 + Vue %23.3** + Rust %3.9 (Tauri desktop), Tailwind, pnpm monorepo, Firebase (cloud) / Docker (self-host) |
| **Tip** | Web-first (PWA) + Desktop + CLI + self-hosted (Docker, on-prem) |
| **Protokoller** | HTTP/REST (custom method dahil), **GraphQL, WebSocket, Socket.IO, MQTT, SSE** |

**Öne çıkan özellikler:**
- Pre-request script + post-request test (JavaScript), environment değişkenleri, bulk edit
- Collections/folders, history, workspaces, Teams (sınırsız üye, RBAC), real-time collaboration
- Admin dashboard, audit log, SSO (Enterprise), on-prem deployment
- **30+ dil i18n**, tema sistemi (accent renkleri, Zen mode)
- Proxy + browser extension ile **CORS çözümü** (web client'ın en büyük problemi)
- Code snippet üretimi (10+ dil), cURL import, Postman/Insomnia tek-tık migrasyon
- API Mocking (Ekim 2025'te eklendi), CLI ile CI/CD entegrasyonu
- 5M+ istek/ay işleme hacmi

**Proje için dersler:**
- **En değerli kaynak:** Vue ile yazılmış, MIT lisanslı — request editor, environment templating, GraphQL schema explorer, WebSocket/MQTT/SSE panelleri gibi bileşenlerin Vue implementasyonları doğrudan incelenebilir/adapte edilebilir.
- Web-first olmanın bedeli CORS/proxy karmaşası; Electron'da bu problem yok — main process'ten istek atmak Hoppscotch'un extension/proxy katmanına olan ihtiyacını tamamen ortadan kaldırır. **Bu, desktop-first ürünün en somut teknik avantajıdır.**
- `hoppscotch-common` paket ayrımı (web+desktop ortak çekirdek) monorepo tasarımı için şablon.

### 3.2 Bruno — **Felsefe Lideri, Electron Kanıtı**

| Özellik | Detay |
|---|---|
| **GitHub** | ⭐ 43.8k · 2.4k fork · MIT · 163 release (v3.3.0), 4.3k commit |
| **Stack** | **Electron**, JavaScript %77 + TypeScript %18, monorepo (packages/), Playwright E2E |
| **Tip** | Desktop-only (Mac/Win/Linux), ticari Pro/Enterprise katmanı |
| **Protokoller** | REST, GraphQL, gRPC, WebSocket |

**Öne çıkan özellikler:**
- **Bru markup dili:** Her request `.bru` uzantılı okunabilir düz metin dosyası; collection = dosya sistemi klasörü → Git diff/review/branch doğal çalışıyor; kod tabanıyla co-location mümkün
- Offline-only, hesap kavramı yok; "cloud sync asla" taahhüdü
- Kurumsal ölçek: mevcut Git izinleri otomatik devralınır (RBAC/audit/secret yönetimi için ek altyapı gerekmez) — SOC 2 Type I
- Microsoft, GitHub, Cisco, Mercedes-Benz gibi kurumsal kullanıcı referansları
- Homebrew/Chocolatey/Scoop/winget/Snap/Flatpak/AUR/Apt — çok geniş paket dağıtımı
- 20 dile çevrilmiş README (Türkçe dahil) — güçlü topluluk sinyali

**Proje için dersler:**
- **"Collection = dosya + klasör" modeli bu segmentin kazanan veri mimarisi** (bkz. §6). Bruno'nun `bruno-lang` parser paketi açık kaynak; format tasarımı için referans.
- Electron seçiminin 43.8k yıldızlı kanıtı; performans şikayetleri ürünün büyümesini engellememiş.
- Gelir modeli: core ücretsiz + Pro (ücretli özellikler) dengesi açıkça dokümante edilmiş ("open-source principles and sustainability" tartışması).

### 3.3 Thunder Client — IDE-içi Segment

- **Tip:** Closed-source VS Code + JetBrains eklentisi; 6M+ indirme; freemium (kurumsal lisans)
- **Özellikler:** Scriptless GUI testing (kod yazmadan assertion), %100 local storage, **Git sync** (collection'lar repo'da), CLI, hafiflik
- **Müşteriler:** Toyota, AT&T, Bosch, DHL, Mercedes-Benz, Intuit — Fortune 500 ağırlıklı
- **Dersler:** (1) "Editörden çıkmadan test" değer önerisi güçlü bir segment yarattı — masaüstü ürün için VS Code eklentisi *gelecek* fikri olabilir ama MVP değil. (2) **Scriptless testing** (dropdown'larla assertion kurma) junior/QA kitlesi için mükemmel bir diferansiyatör; script yazmayı bilmeyenler için GUI-tabanlı test builder projeye alınmalı. (3) Git sync'in ticari üründe bile ana özellik olması, dosya-tabanlı yaklaşımın pazar onayı.

### 3.4 RapidAPI (Nokia API Hub) — Farklı Kategori

- **Tip:** API marketplace/hub (client değil); ~98k API listing'i, %25 komisyon modeli
- **Durum:** Kasım 2024'te Nokia tarafından satın alındı; telco "Network as Code" stratejisine entegre edildi; hub'a MCP desteği eklendi
- **Dersler:** Doğrudan rakip değil, ancak (1) "public API discovery/deneme" ihtiyacının kanıtı — projeye ileride "hazır public API kataloğundan örnek request import" özelliği (örn. kamu API'leri, popüler servisler) düşük maliyetli bir onboarding hızlandırıcısı olabilir; (2) bir zamanlar $1B değerlemeli platformun çöküşü, marketplace/platformlaşma yolunun risklerini gösteriyor — Bruno'nun "an API Client, not a Platform" manifestosu tam da buna karşı yazılmış.

### 3.5 HTTPie — CLI Mirası + Desktop Denemesi

- **Tip:** Efsanevi açık kaynak CLI (org toplamı ~48k⭐, Python) + Web/Desktop uygulaması (beta) + AI asistanı
- **Özellikler:** İnsan-dostu sözdizimi (`http PUT example.org name=John`), renkli çıktı; Desktop tarafı: export/import, path params, "copy as command"
- **Dersler:** (1) CLI-first kitle büyük ve sadık; masaüstü ürüne eşlik eden **CLI runner** (CI/CD için collection çalıştırıcı — Hoppscotch CLI, Bruno CLI, Thunder CLI hepsi yaptı) zorunlu yol haritası maddesi. (2) HTTPie Desktop'ın yıllardır betada sürünmesi, güçlü CLI markasının bile GUI'ye otomatik taşınamadığını gösteriyor — GUI kendi başına mükemmel olmalı.

### 3.6 Insomnia (Kong) — Kurumsal Açık Kaynak Platform

- **Tip:** Açık kaynak core (Electron) + Kong ticari katmanı; Insomnia 13 (Haziran 2026) Kong Konnect entegrasyonu
- **Protokoller:** REST, GraphQL, gRPC, SOAP, WebSocket, Socket.IO, SSE + **MCP client** (MCP server'ları API gibi test etme)
- **Özellikler:** Design-first (OpenAPI editor + preview), native mocking, collection runner, pre/post scripting, storage seçenekleri (local / Git / cloud E2EE), data locality politikaları (org genelinde storage zorlama), OIDC/SAML SSO, SCIM, SOC 2 Type 2, Inso CLI (spec lint + Kong Gateway'e push), 3-way merge, plugin ekosistemi
- **Dersler:** (1) **Storage seçeneği üçlüsü (local/Git/cloud) + kurumsal "data locality mandate"** olgun bir kurumsal gereksinim haritası sunuyor. (2) MCP client özelliği 2026'nın yeni standart beklentisi — yol haritasına alınmalı. (3) Kong'un platformlaştırma hamleleri her seferinde topluluk tepkisi çekti; bu, bağımsız/topluluk-odaklı yeni oyunculara sürekli alan açıyor.

### 3.7 GetAPI (TablePlus) — Native Minimalizm

- **Tip:** Ticari, native macOS uygulaması (TablePlus ekibinden); "Dead Simple HTTP Client"
- **Özellikler:** Postman import → istek at → cevabı gör; macOS detay işçiliği
- **Dersler:** TablePlus'ın DB client'ta yaptığını API client'ta deneme girişimi. "Sıfır öğrenme eğrisi + anında değer" onboarding hedefi: kullanıcı uygulamayı açtıktan sonra 10 saniye içinde ilk isteğini atabilmeli. Quick request (collection'a kaydetmeden URL yapıştır-gönder) MVP'de olmalı.

### 3.8 Scalar — OpenAPI-First Ekosistem

- **Tip:** Açık kaynak (MIT) + ticari; API Docs + SDK üretimi + API Client + Registry dörtlüsü; SOC 2
- **Client:** Offline-first, OpenAPI standardı üzerine inşa, Linux/Win/Mac, "The Postman Alternative Your Team Is Dreaming Of"
- **Özellikler:** Markdown/MDX docs + iki yönlü Git sync, OpenAPI/AsyncAPI referans üretimi, 6 dilde type-safe SDK üretimi, MCP & Agent ürünü, çok beğenilen modern docs UI (ASP.NET ekibinin Swagger UI yerine Scalar'ı önermesi)
- **Dersler:** (1) **OpenAPI'yi merkez veri modeli yapmak** güçlü bir ağ etkisi yaratıyor (spec → docs → SDK → client aynı kaynaktan). Projede OpenAPI import *ve export* birinci sınıf olmalı; bir collection'ı OpenAPI 3.1 spec olarak dışa verebilmek, docs araçlarıyla köprü kurar. (2) Embed edilebilir açık kaynak bileşen stratejisi (Scalar API References'ın framework'lere gömülmesi) organik dağıtım kanalı olarak ders niteliğinde.

### 3.9 Yaak — UX Mükemmeliyetçiliği (Insomnia Kurucusunun İkinci Ürünü)

- **Tip:** Open source (mountain-loop/yaak), **Tauri/Rust + React**, ticari lisans modeli; 132k indirme; Ocak 2024'ten beri aylık release
- **Protokoller:** HTTP, GraphQL, gRPC, WebSocket, SSE
- **Özellikler:** Local-only + zero telemetry, **plain-file Git sync + Git UI (diff viewer, status)**, encrypted secrets, dynamic templating (değişken + template fonksiyonları + **request chaining** — bir isteğin cevabından diğerine değer akıtma), auth inheritance (folder'dan miras), OAuth1/2-AWSv4-JWT-NTLM auth, 1Password entegrasyonu, keychain function, multi-window, batch send, command palette, 30+ tema, customizable hotkeys, request/folder settings overrides, agent-friendly CLI, Postman/Insomnia/OpenAPI/curl/Swagger import
- **Dersler:** **Yaak, projenin UX çıtasıdır.** Özellikle üç pattern birebir alınmalı: (1) **request chaining + template functions** (`{{ response('login').body.token }}` tarzı), (2) **auth/settings'in folder hiyerarşisinden inheritance'ı**, (3) **Git'i uygulama içinden yönetme** (commit/diff/status UI'ı) — dosya-tabanlı formatın kullanıcı dostu hale gelmesinin anahtarı. Changelog ritmi (her ay anlamlı release + adlandırılmış tema desteği gibi sevimli detaylar) topluluk büyütme dersi.

### 3.10 Posting — TUI Segmenti (Python/Textual)

- **GitHub:** ⭐ 12k · Apache-2.0 · Python %95, Textual framework
- **Özellikler:** Terminalde (SSH üzerinden dahi) çalışan tam API client; jump mode navigasyon, command palette, tree-sitter syntax highlighting, YAML dosya formatı (version-control friendly), dotenv tabanlı environment + hot reload, Python pre/post scripting, $EDITOR/$PAGER entegrasyonu (body'yi nvim'de düzenle, cevabı fx'te gez), curl yapıştırarak import, Postman/OpenAPI import, custom themes
- **Dersler:** (1) Klavye-odaklı verimlilik (jump mode + palette) masaüstü üründe de birinci sınıf olmalı — Vuetify UI'ında her aksiyonun kısayolu ve `Ctrl+K` paleti. (2) "External tools" felsefesi: body düzenlemeyi kullanıcının editörüne delege etme opsiyonu güçlü bir power-user özelliği.

### 3.11 ATAC — TUI Segmenti (Rust)

- **GitHub:** ⭐ 3.7k · MIT · Rust %99.9, ratatui
- **Özellikler:** Hesapsız/offline felsefe; README'deki Postman/Insomnia karşılaştırma tablosu (TRACE/CONNECT desteği, binary WS mesajları gibi nadir detaylar dahil); JSON/YAML dosya depolama; boa JS motoru ile pre/post script; Postman v2.1/OpenAPI/cURL import; HTTP-cURL-PHP Guzzle-Axios-Reqwest kod export; Vim keybinding; NeoVim entegrasyonu; 5-15MB binary
- **Dersler:** (1) Özellik karşılaştırma tablosunu README'ye koymak (✅/❌ matrisi) etkili bir pazarlama formatı. (2) Kod export hedeflerine **PHP Guzzle ve Axios** dahil edilmiş olması sizin ekosisteminizle örtüşüyor — Laravel Http client (`Http::withHeaders()...`) formatında export, TR/PHP topluluğu için benzersiz bir özellik olur.

### 3.12 Voiden — Markdown-Native Deney (Electron)

- **GitHub:** ⭐ 1k (hızlı büyüyor, 14k+ install) · Apache-2.0 · **Electron + TypeScript %97.7** (React renderer) · ApyHub destekli
- **Konsept:** "LEGO for HTTP" — request'ler `.void` (Markdown + frontmatter + block) dosyalarında; **endpoint/header/auth/body blokları fonksiyon gibi dosyalar arası yeniden kullanılabilir**; docs + test + request aynı dosyada, yerinde çalıştırılabilir (executable docs)
- **Özellikler:** Protokoller plugin olarak (REST, GraphQL, gRPC, WS), JS/Python/Shell scripting, **Stitch runner** (glob pattern ile çoklu .void dosyasını sıralı çalıştırma, stop-on-failure), Git-native, Claude/Codex agent skill'leri, no telemetry/no VC/no lock-in, plugin marketplace
- **Dersler:** (1) **"Why Electron (not Tauri)" yazısı projenizin teknoloji savunması için hazır argüman seti:** IDE-benzeri zengin deneyim + Git/terminal gibi derin sistem erişimi + 3 platformda tutarlılık > footprint. (2) Composable block konsepti (auth bloğunu bir kez tanımla, 50 request'te kullan) klasik collection modelinin ötesine geçen gerçek bir yenilik — projede "shared blocks/partials" olarak sadeleştirilmiş hali değerlendirilebilir. (3) Protokollerin plugin mimarisiyle eklenmesi core'u ince tutuyor.

### 3.13 Apidog — All-in-One Ticari Platform

- **Tip:** Closed-source, ücretsiz cömert katmanlı ticari platform; 500k+ takım; 2022 lansmanı
- **Konsept:** Design-first — API tanımı tek doğruluk kaynağı; tanımdan otomatik olarak debug, **smart mock** (alan adı semantiğinden gerçekçi veri üretimi, sıfır konfigürasyonla cloud mock URL), görsel test builder (low-code assertion), etkileşimli docs (custom domain, 20+ dilde kod örneği), CI/CD (Jenkins/CLI)
- **AI:** Ocak 2026'da tam MCP desteği — Cursor/Cline/Claude Code gibi araçlar Apidog docs'undan canlı spec okuyup kod üretebiliyor
- **Dersler:** (1) "Postman + Swagger + Mock + JMeter'i tek araçta birleştirme" konsolidasyon anlatısı kurumsal alıcıda güçlü karşılık buluyor; ancak bu bir *platform* yolu — MVP'de değil, uzun vadede modüler eklenecek yön. (2) **Smart mock** (schema'dan otomatik gerçekçi mock server) v2 için yüksek değerli hedef: Electron main process'te lokal mock server (Express/Fastify) ayağa kaldırmak teknik olarak kolay.

---

## 4. Karşılaştırmalı Matris

| Ürün | Yıldız | Lisans | Platform | Teknoloji | Depolama | GQL | gRPC | WS | SSE | MQTT | Script | Mock | CLI | i18n | Hesapsız |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Hoppscotch** | 79.4k | MIT | Web+Desktop+CLI | **Vue 3**/TS/Tauri | Cloud/self-host/local | ✅ | ❌ | ✅ +Socket.IO | ✅ | ✅ | ✅ JS | ✅ | ✅ | ✅ 30+ | Kısmi (local mod) |
| **Bruno** | 43.8k | MIT | Desktop | **Electron**/JS | **.bru dosyaları (Git)** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ JS | ❌ | ✅ | README 20 dil | ✅ tam |
| **Posting** | 12k | Apache-2.0 | TUI | Python/Textual | YAML dosyaları | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Python | ❌ | — | ❌ | ✅ |
| **ATAC** | 3.7k | MIT | TUI | Rust/ratatui | JSON/YAML dosyaları | 🔜 | 🔜 | ✅ | ❌ | 🔜 | ✅ JS(boa) | ❌ | ✅ | ❌ | ✅ |
| **Thunder Client** | 3.7k (tracker) | Kapalı | VS Code+JetBrains | Bilinmiyor | Local + Git sync | ✅ | ❌ | ❌ | ❌ | ❌ | Scriptless GUI | ❌ | ✅ | ❌ | ✅ (local) |
| **Voiden** | 1k | Apache-2.0 | Desktop | **Electron**/TS/React | **.void Markdown (Git)** | ✅ plugin | ✅ plugin | ✅ plugin | ❌ | ❌ | ✅ JS/Py/Shell | ❌ | ✅ agent CLI | ❌ | ✅ |
| **Insomnia** | ~35k | Apache core | Desktop+CLI | Electron/React | Local/Git/Cloud E2EE | ✅ | ✅ | ✅ +Socket.IO | ✅ | ❌ | ✅ JS | ✅ | ✅ Inso | ✅ | Kısmi (Scratch Pad) |
| **Yaak** | ~7k | Open source | Desktop+CLI | Tauri/Rust/React | **Plain-file (Git UI)** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ template fn | ❌ | ✅ agent CLI | ❌ | ✅ |
| **HTTPie** | ~48k org | BSD (CLI) | CLI+Desktop beta | Python / web | Cloud (desktop) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | CLI ✅ |
| **Scalar** | ~11k | MIT | Web+Desktop | TS (client) | OpenAPI-merkezli, offline-first | ✅ | ❌ | ❌ | ❌ | ❌ | Kısmi | Registry | ✅ | ❌ | ✅ client |
| **GetAPI** | — | Kapalı | macOS native | Swift (muhtemel) | Local | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Apidog** | — | Kapalı | Desktop+Web | Bilinmiyor (Electron muhtemel) | Cloud (branch'li) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ + görsel | ✅ smart | ✅ | ✅ | ❌ (hesap) |
| **RapidAPI** | — | Kapalı | Web hub | — | Cloud | — | — | — | — | — | — | — | — | — | ❌ |
| **🎯 Yeni Proje** | — | MIT önerisi | **Desktop-first** | **Electron/Vue 3/Vuetify** | **Düz metin dosya (Git)** | ✅ | v1.x | ✅ | ✅ | v2 | ✅ JS sandbox | v2 | ✅ | ✅ **TR+EN+** | ✅ tam |

---

## 5. Pazar Boşluğu ve Konumlandırma

```
              Platform / Cloud / Hesaplı
                        ▲
        Postman ●       │       ● Apidog
        RapidAPI ●      │       ● Insomnia (Kong)
                        │       ● Hoppscotch (cloud modu)
   Web/IDE-içi ◄────────┼────────► Desktop-first
                        │
   Thunder Client ●     │  ● Yaak (Tauri/React)
   Hoppscotch(PWA) ●    │  ● Bruno (Electron/React-JS)
   Posting/ATAC (TUI) ● │  ● Voiden (Electron/React)
                        │  ● 🎯 YENİ PROJE (Electron/VUE)
                        ▼
             Local-first / Git-native / Hesapsız
```

**Sağ alt çeyrek (desktop + local-first) pazarın momentum kazanan bölgesi** ve orada Vue tabanlı hiçbir oyuncu yok — hepsi React. Vue/Vuetify ekosistemindeki geliştiriciler (özellikle Laravel+Vue dünyası) için "kendi stack'iyle yazılmış, katkı verebileceği" bir araç anlamlı bir topluluk çekirdeği oluşturur.

### Önerilen değer önerisi

> **"Bruno'nun Git-native felsefesi + Yaak'ın UX detayları + Hoppscotch'un protokol genişliği — Vue/Vuetify ile, Türkçe dahil tam yerelleştirilmiş, hesapsız bir masaüstü API client."**

### Diferansiyatörler (öncelik sırasıyla)

1. **Git-native düz metin format + uygulama içi Git UI** (Yaak'ın diff/status yaklaşımı) — dosya formatı insan-okur, AI-okur, diff-okur olmalı
2. **Desktop-first Electron avantajı:** CORS yok, proxy yok, extension yok; cookie jar, client sertifikaları, custom CA — main process'ten tam kontrol
3. **Request chaining + template functions + auth inheritance** (Yaak paritesi) MVP'de
4. **Scriptless test builder** (Thunder Client modeli) + JS scripting bir arada — hem QA hem developer kitlesi
5. **TR birinci sınıf i18n** — bu segmentte tam Türkçe ürün yok; Laravel/PHP ekosistemine özel kod export (Guzzle, Laravel `Http::` facade) benzersiz özellik
6. **Postman kısıtlama dalgasını hedefleyen import matrisi:** Postman v2.1 + environment, Insomnia, Bruno, OpenAPI 3.x, cURL, HAR

---

## 6. Kritik Mimari Karar: Veri Depolama Formatı

Bu pazarın son üç yılına tek bir mimari karar yön verdi: **collection'lar veritabanında mı, dosyalarda mı?**

| Model | Kullanan | Artı | Eksi |
|---|---|---|---|
| **A. Veritabanı (SQLite/NeDB)** | Eski Insomnia, Postman (cloud) | Hızlı sorgu, transaction | Git ile diff/merge edilemez; lock-in algısı; export ritüeli |
| **B. Tek büyük JSON** | Postman export formatı | Basit | Merge conflict cehennemi, insan-okumaz |
| **C. Klasör + request-başına düz metin dosya** | **Bruno (.bru), Yaak, Voiden (.void), Posting (YAML)** | Git-native, diffable, AI/grep dostu, co-location, "veri senin" kanıtı | Dosya izleme (watcher) karmaşası, atomik yeniden adlandırma, format tasarımı emeği |

**Öneri: Model C** — pazar kararını verdi; 2023 sonrası doğan tüm başarılı ürünler bu modelde.

### Format tasarım önerisi

- **Kendi DSL'i icat etmek yerine (Bruno'nun .bru'su gibi) yapılandırılmış YAML + Markdown hibriti:** Posting'in YAML sadeliği + Voiden'in "docs aynı dosyada" fikri. Örnek: `collection/klasor/istek-adi.req.yaml` (request tanımı) + opsiyonel Markdown `docs` alanı.
- Request-başına bir dosya; klasör hiyerarşisi = collection hiyerarşisi; `collection.yaml` (kök meta), `environments/*.env.yaml`, `.gitignore`'a otomatik eklenen `secrets.local.yaml`.
- **Secrets asla dosyaya düz yazılmaz:** environment dosyasında `{{secret:API_KEY}}` referansı; değerler Electron `safeStorage` (OS keychain) içinde. Yaak'ın "encrypted secrets + Git" kombinasyonu referans.
- Şema versiyonlama: her dosyada `schema: v1` alanı; Bruno'nun retro-compatibility taahhüdü örnek alınmalı.
- Main process'te `chokidar` ile dosya izleme → dışarıdan (editör/git pull) değişen dosyalar UI'a canlı yansır. Bu, "IDE'de düzenle, uygulamada çalıştır" akışını açar.

---

## 7. Protokol Implementasyon Stratejileri

Electron main process = tam Node.js; tüm protokoller olgun npm kütüphaneleriyle embedded çalışır. Renderer (Vue) yalnızca typed IPC ile konuşur.

### 7.1 HTTP/REST (MVP çekirdeği)

- **Kütüphane:** Node 18+ `undici` (fetch'in altındaki motor) veya `got` — redirect zinciri, timing (DNS/TCP/TLS/TTFB ayrımı — Yaak'ın "full request debugging" paritesi), proxy, mTLS client sertifikası, custom CA, cookie jar (`tough-cookie`) kontrolü için `got` önerilir
- Custom HTTP method desteği (Hoppscotch'un LIST örneği), multipart/form-data + dosya upload, binary body, gzip/br
- Response: syntax-highlighted body (JSON/XML/HTML), önizleme (HTML/görsel), header/cookie/timeline sekmeleri, boyut+süre, büyük response'ta virtualized rendering (10MB+ JSON'da UI kilitlenmemeli — CodeMirror 6 + lazy parse)
- cURL import (URL çubuğuna yapıştır — Posting/Yaak UX'i) ve çok dilli kod export (`curl`, JS fetch/Axios, **PHP Guzzle, Laravel Http**, Python requests, Go, C#)

### 7.2 GraphQL (MVP veya v1.0 başı)

- İntrospection ile schema çekme + schema explorer paneli (Hoppscotch'un Vue implementasyonu referans), query autocomplete (CodeMirror 6 `cm6-graphql` paketi hazır), variables paneli, subscription (WS üzerinden `graphql-ws`)

### 7.3 WebSocket + SSE (v1.0)

- WS: `ws` paketi (main'de) — text/binary/ping/pong mesajları (ATAC binary desteğiyle övünüyor, kolay parite), mesaj geçmişi timeline'ı, yeniden bağlanma
- SSE: `eventsource` veya undici stream — event akışı görünümü
- Socket.IO: `socket.io-client` (v1.x — Hoppscotch paritesi)

### 7.4 gRPC (v1.x)

- `@grpc/grpc-js` + `@grpc/proto-loader`; .proto dosyası import + server reflection ile servis keşfi; unary → server-streaming → bidirectional sırasıyla aşamalı
- En zahmetli protokol; Bruno/Yaak/Insomnia destekliyor, pazar beklentisi haline geldi ama MVP blocker yapılmamalı

### 7.5 MQTT (v2) ve MCP client (v2)

- MQTT: `mqtt` paketi ile topic subscribe/publish paneli (Hoppscotch paritesi, IoT kitlesi)
- **MCP client:** 2026 beklentisi — MCP server'a bağlanıp tool/resource/prompt listeleme ve tool çağırma (Insomnia 13 ve Apidog'un yeni standardı). `@modelcontextprotocol/sdk` ile main process'te doğal implementasyon

### 7.6 Mock server (v2)

- Main process'te Fastify ile lokal mock: collection'daki response örneklerinden veya OpenAPI şemasından endpoint üretimi; `faker` ile alan-adı-duyarlı veri (Apidog "smart mock"un lokal versiyonu)

---

## 8. Önerilen Teknik Mimari

### 8.1 Katmanlı yapı

```
┌────────────────────────── RENDERER (Vue 3 + Vuetify 3) ──────────────────────────┐
│ Vue Router: üst-seviye view'lar (Workspace, Settings, GitPanel, Import)          │
│   → Request tab'ları route DEĞİL: <KeepAlive> içinde component (state korunur)   │
│ Pinia stores: workspace / collections / tabs / environments / responses /        │
│               settings / git / ui                                                │
│ VueUse: useMagicKeys (Ctrl+K palette, Ctrl+Enter send), useDark,                 │
│         useDebounceFn (autosave), useResizeObserver (split pane)                 │
│ Vue I18n: tr/en lazy-loaded + Crowdin genişleme                                  │
│ CodeMirror 6: URL/body/script editörleri (JSON, GraphQL, XML dilleri;            │
│               {{variable}} highlight/autocomplete için custom extension)         │
│ Vuetify: VTreeview (collection ağacı), VTabs, VDataTable (header/param grid),    │
│          tema motoru (dark/light + accent)                                       │
└──────────────────▲──────────── contextBridge / typed IPC ────────────────────────┘
                   │  kanallar: request:*, ws:*, grpc:*, fs:*, git:*, secret:*
┌──────────────────▼──────────────── MAIN (Node.js) ───────────────────────────────┐
│ RequestEngine                                                                    │
│   ├── HttpRunner (got: timing, mTLS, proxy, cookie jar, redirect chain)          │
│   ├── GraphqlRunner (introspection + graphql-ws)                                 │
│   ├── WsRunner / SseRunner / SocketIoRunner                                      │
│   └── GrpcRunner (@grpc/grpc-js + proto-loader)          [v1.x]                  │
│ ScriptEngine (izole JS sandbox — pre-request / test, bkz. §9)                    │
│ TemplateEngine ({{var}}, {{secret:x}}, fonksiyonlar, request chaining çözümü)    │
│ WorkspaceService (chokidar watcher + YAML parse/serialize, atomik yazma)         │
│ GitService (isomorphic-git veya simple-git: status/diff/commit/pull/push UI)     │
│ SecretVault (Electron safeStorage → OS keychain)                                 │
│ ImportService (Postman v2.1, Insomnia, Bruno, OpenAPI 3.x, cURL, HAR)            │
│ ExportService (OpenAPI 3.1, Postman, kod snippet'leri)                           │
│ CliRunner paketi (ayrı npm paketi: CI/CD'de collection çalıştırma)               │
│ MockServer (Fastify)                                     [v2]                    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Stack'e özgü kararlar

| Bileşen | Karar | Gerekçe |
|---|---|---|
| **Electron** | electron-vite + electron-builder | Voiden'in "Why Electron" argümanı: IDE-benzeri deneyim + Git/FS derin erişim + 3 platform tutarlılığı. Bruno/Voiden/Insomnia kanıtı |
| **Vue Router** | Yalnızca üst-seviye görünümler | Request tab'ları route yapılırsa tab geçişinde editor/response state'i ve CodeMirror instance'ları yeniden kurulur; `<KeepAlive>` + Pinia `tabs` store doğru model |
| **Pinia** | `responses` store'da büyük body'ler tutulmaz | Body main'de cache'lenir, renderer'a metadata + görünür chunk gider; persist yalnızca `settings` ve `ui` (persistedstate paths whitelist) |
| **Vuetify** | Chrome/panel/form katmanı | Editör alanları raw CodeMirror; VDataTable yerine header/param satırları için hafif custom grid (yüzlerce satırda VDataTable ağır kalabilir) |
| **VueUse** | `useMagicKeys` (palette+send), `useIdle` (secret vault auto-lock), `useEventBus` (IPC event köprüsü) | |
| **Vue I18n** | TR + EN launch; Crowdin | Bu segmentte tam Türkçe ürün yok |
| **Typed IPC** | `shared/ipc-contract.ts` + `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | Bruno/Voiden ile aynı hardening standardı |
| **Streaming yanıtlar** | WS/SSE/gRPC stream mesajları 16ms batch'lerle IPC'ye | Yüksek frekanslı mesajlarda UI donmasını önler |

### 8.3 Proje iskeleti

```
proje/
├── electron/
│   ├── main/
│   │   ├── engine/          # runner'lar (http, graphql, ws, sse, grpc)
│   │   ├── script/          # sandbox + API yüzeyi (req, res, env, expect)
│   │   ├── template/        # {{}} çözümleyici + fonksiyonlar + chaining
│   │   ├── workspace/       # yaml parse/serialize, watcher, atomik io
│   │   ├── git/             # isomorphic-git servisleri
│   │   ├── vault/           # safeStorage secret yönetimi
│   │   └── import-export/   # adapter pattern: postman.adapter.ts, openapi.adapter.ts...
│   └── preload/index.ts
├── src/                     # Vue renderer
│   ├── views/               # WorkspaceView, SettingsView, GitView
│   ├── components/
│   │   ├── request/         # UrlBar, MethodSelect, ParamsGrid, BodyEditor, AuthPanel
│   │   ├── response/        # ResponseViewer, TimelinePanel, TestResults
│   │   ├── sidebar/         # CollectionTree, EnvSelector
│   │   ├── realtime/        # WsPanel, SsePanel, GrpcPanel
│   │   └── palette/CommandPalette.vue
│   ├── stores/  ├── composables/  ├── locales/  └── router/
├── packages/
│   ├── cli/                 # collection runner (CI/CD)
│   └── schema/              # dosya formatı tipleri + zod validasyon (main+renderer+cli ortak)
└── shared/ipc-contract.ts
```

---

## 9. Scripting Motoru ve Güvenlik

Pre-request/test script'leri bu ürün kategorisinin hem en değerli hem en riskli parçası (kullanıcı kodu çalıştırıyorsunuz):

- **Sandbox seçimi:** `vm2` terk edildi (kritik CVE'ler); güncel doğru cevap **`isolated-vm`** (V8 isolate — Bruno'nun "safe mode" yaklaşımına paralel) veya daha hafif senaryoda **QuickJS-WASM** (`quickjs-emscripten`). ATAC bile Rust içinde boa JS motoru gömüyor — JS scripting pazar standardı, Python/Shell (Voiden) opsiyonel v2.
- **API yüzeyi Postman-uyumlu tutulmalı:** `pm.environment.get/set`, `pm.test`, `pm.expect` (chai) muadilleri — Postman'den taşınan script'lerin minimum değişiklikle çalışması migrasyon sürtünmesini düşürür (Apidog'un "script compatibility" stratejisi).
- **Scriptless test builder** paralel sunulmalı: status/headers/JSON path üzerinde dropdown'la assertion (Thunder Client) → arkada aynı test motoruna derlenir.
- Sandbox'a network/fs erişimi varsayılan kapalı; `require` yok; timeout + memory limit; script hataları test sonucu panelinde kullanıcıya net gösterilir.
- Secrets: script'ler secret *değerlerini* loglayamasın diye response/console çıktısında otomatik maskeleme (değer eşleşmesi bazlı redaction).

---

## 10. Özellik Seti ve MoSCoW Önceliklendirme

### Must (MVP)

- Workspace açma (klasör seç) + collection/klasör/request CRUD; düz metin YAML format (§6); dosya watcher ile dış değişiklik senkronu
- HTTP/REST: tüm metodlar + custom, params/headers grid (bulk edit dahil), body (JSON/form/multipart/binary/raw), auth (Basic, Bearer, API Key, OAuth2 authorization-code+client-credentials, JWT)
- Environment'lar + `{{variable}}` templating + secret vault (OS keychain)
- Response viewer: highlight, önizleme, headers/cookies/timing, download, kopyala
- Pre-request + test scripting (JS sandbox) ve scriptless assertion builder'ın basit hali
- Tab sistemi + `<KeepAlive>`, quick request, history
- Ctrl+K command palette + tam klavye kısayol seti
- **Import: Postman v2.1 (+environment), cURL yapıştırma, OpenAPI 3.x** · Export: cURL + kod snippet (JS/PHP Guzzle/Laravel Http/Python)
- i18n TR+EN, dark/light tema
- Git dostu davranış: atomik yazma, deterministik serialize (gereksiz diff üretmeme), secrets'ın otomatik `.gitignore`'u

### Should (v1.x)

- GraphQL (schema explorer + autocomplete + subscriptions), WebSocket, SSE, Socket.IO panelleri
- **Uygulama içi Git UI** (status/diff/commit/pull/push — Yaak paritesi)
- Request chaining + template fonksiyonları (uuid, timestamp, faker, `response()` referansı), auth/header inheritance (folder'dan miras)
- Collection runner (UI'da sıralı koşum + veri dosyasıyla iteration) ve **CLI paketi** (CI/CD)
- Insomnia/Bruno import, HAR import, OpenAPI 3.1 export
- Cookie manager, proxy ayarları, mTLS client sertifikaları, custom CA
- Çoklu pencere, split view, workspace-başına ayar override'ları

### Could (v2)

- gRPC (reflection + streaming), MQTT
- **MCP client** (Insomnia 13 / Apidog paritesi) + agent-friendly CLI (Yaak/Voiden modeli)
- Lokal mock server (OpenAPI/örneklerden, faker'lı smart mock)
- Paylaşılabilir bloklar (Voiden'in LEGO konsepti sadeleştirilmiş), plugin API
- Docs üretimi: collection → statik HTML/Markdown docs (Scalar köprüsü), performans/load test mini modülü
- AI yardımcı (BYO API key: test üretimi, response açıklama)

### Won't (şimdilik)

- Cloud sync/hesap sistemi (felsefi olarak asla — Bruno duruşu), real-time çoklu kullanıcı düzenleme, API marketplace, SOAP

---

## 11. Yol Haritası (Roadmap)

| Faz | Süre (tahmini) | Kapsam | Çıkış kriteri |
|---|---|---|---|
| **0 — İskelet** | 2-3 hafta | electron-vite + Vue3 + Vuetify + Pinia + I18n boilerplate; typed IPC; dosya formatı şeması (`packages/schema` + zod); CI (3 OS build) | Boş uygulama 3 platformda paketleniyor; format spec'i v1 donduruldu |
| **1 — HTTP çekirdeği** | 4-6 hafta | HttpRunner (got), request editor (CodeMirror), response viewer, env+templating, tab sistemi, workspace dosya IO + watcher | Kendi günlük API işlerinizde (Habertürk API'leri) Postman yerine kullanılabilir |
| **2 — MVP tamamlama** | 4-6 hafta | Scripting sandbox + scriptless assertions, auth çeşitleri, Postman/OpenAPI/cURL import, kod export, palette, secret vault, TR/EN | **Public beta v0.1** — "Postman'den 5 dakikada geç" anlatısıyla lansman |
| **3 — v1.0** | 6-8 hafta | GraphQL + WS + SSE, Git UI, request chaining + inheritance, collection runner + CLI, cookie/proxy/mTLS | v1.0 — "Bruno + Yaak alternatifi" iddiası |
| **4 — v2** | Sürekli | gRPC, MQTT, MCP client, mock server, plugin API, docs üretimi | Diferansiyasyon fazı |

**Lansman stratejisi:** Bu segmentte büyüme kanalı kanıtlanmış durumda: GitHub + HN "Show HN" + r/webdev + Postman fiyat/kısıtlama haber döngüleri. Bruno ve Yaak'ın testimonial'ları neredeyse tamamen "Postman'den kaçış" anlatısı — README'de ✅/❌ karşılaştırma tablosu (ATAC formatı) + kripto/veri sahipliği taahhüdü net yazılmalı. TR tarafında Laravel Türkiye / yazılım toplulukları erken evangelist tabanı.

---

## 12. Riskler ve Azaltma Stratejileri

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| 1 | **Doymuş pazar algısı** ("bir API client daha mı?") | Yüksek | Yüksek | Yaak kurucusunun "Yet Another API Client?" yazısı aynı soruya cevaptı ve ürün tuttu; keskin konumlandırma (Vue + TR + Git-native + desktop) ve dar-derin MVP ile girmek; genel amaçlı "her şey" iddiasından kaçınmak |
| 2 | **Dosya formatı tasarım hataları** (sonradan kırıcı değişiklik) | Orta | Çok yüksek | Format spec'ini Faz 0'da dondurup versiyonlamak; `schema` alanı + migration altyapısını ilk günden kurmak; Bruno'nun retro-compat taahhüdü örnek |
| 3 | **Script sandbox güvenlik açığı** | Düşük | Çok yüksek | vm2 gibi terkedilmiş çözümlerden uzak durmak; isolated-vm/QuickJS; sandbox'ı ayrı utility process'te çalıştırmak; SECURITY.md + disclosure süreci |
| 4 | **Scope creep** (Apidog'un tüm lifecycle'ına öykünme) | Yüksek | Yüksek | MoSCoW disiplini; "client, platform değil" manifestosu (Bruno) — her faz sonunda release |
| 5 | **Electron performans algısı** (Tauri rakipleri Yaak/Hoppscotch desktop) | Orta | Orta | Voiden'in savunma yazısı + ölçülebilir hedefler: soğuk açılış <2sn, 10MB JSON response'ta akıcı scroll, RAM raporlarını şeffaf yayınlama |
| 6 | **Tek geliştirici sürdürülebilirliği** | Orta | Yüksek | Temiz monorepo + CONTRIBUTING; Crowdin çeviri topluluğu; ATAC/Posting gibi tek-kişi projelerin bile düzenli release ritmiyle ayakta kaldığı görülüyor — ritim kritik |
| 7 | **Postman format/davranış uyumsuzlukları** (import kalitesi) | Orta | Orta | Import adapter'larına gerçek dünya collection korpusuyla test seti; "import raporu" UI'ı (neyin taşınamadığını açıkça listeleme) |

---

## 13. Lisans Değerlendirmesi

**Kod adaptasyonu açısından incelenen kaynaklar:**

| Kaynak | Lisans | Kod alınabilir mi? |
|---|---|---|
| **Hoppscotch** | MIT | ✅ Atıfla serbest — Vue bileşenleri için birincil referans |
| **Bruno** | MIT | ✅ — format parser'ı ve Electron yapısı incelenebilir |
| **ATAC** | MIT | ✅ (Rust; fikir/format düzeyinde) |
| **Posting** | Apache-2.0 | ✅ NOTICE korunarak |
| **Voiden** | Apache-2.0 | ✅ NOTICE korunarak — Electron mimari dokümanları değerli |
| **Insomnia** | Apache-2.0 (core) | ✅ — ancak Kong ticari modüllerine dikkat |
| **Yaak** | Open source (repo lisansını kullanmadan önce doğrulayın; ticari lisans katmanı var) | ⚠️ Fikir/UX düzeyinde ilham; kod almadan önce lisans metni teyit edilmeli |
| Scalar | MIT | ✅ — docs/reference bileşenleri gömülebilir |
| Thunder Client, Apidog, GetAPI, RapidAPI, HTTPie Desktop | Kapalı | ❌ yalnızca özellik/UX analizi |

**Proje lisans önerisi: MIT.** Bu kategorinin iki devi (Hoppscotch 79.4k, Bruno 43.8k) MIT ve topluluk katkısını maksimize etti. İleride ticari katman (Bruno Pro modeli: ücretsiz core + ücretli kurumsal özellikler) MIT ile de kurulabilir. Fork korkusu bu segmentte teorik kalmıştır; asıl değer topluluk momentumu ve marka.

---

## 14. Sonuç ve Öneriler

1. **Zamanlama olağanüstü uygun:** Postman'in Mart 2026 kısıtlaması aktif bir göç dalgası yarattı; Bruno/Yaak/Apidog bu dalgadan beslenerek büyüyor. Yeni ve iyi konumlanmış bir oyuncuya pazar açık.
2. **Vue tabanlı desktop-first boşluğu gerçek:** Pazarın en büyük projesi (Hoppscotch) Vue ama web-first; desktop tarafındaki tüm güçlü oyuncular React. Vue/Vuetify ile yazılmış, MIT lisanslı bir masaüstü client hem teknik hem topluluk açısından ayrışır — ve Hoppscotch'un Vue kod tabanı size hazır bir öğrenme/adaptasyon kaynağı sunar.
3. **En kritik karar dosya formatıdır, protokoller değil:** Git-native düz metin model (Bruno/Yaak/Voiden çizgisi) pazarın kazanan mimarisi. Formatı Faz 0'da tasarlayıp dondurmadan tek satır UI kodu yazılmamalı.
4. **Üç ürünü masaya yatırın:** Hoppscotch (Vue bileşen implementasyonları, MIT), Bruno (format felsefesi + Electron monorepo, MIT), Yaak (UX çıtası: chaining, inheritance, Git UI, palette).
5. **MVP'yi HTTP'de derinleştirin, protokolde genişletmeyin:** Mükemmel REST deneyimi + kusursuz Postman import, GraphQL/gRPC'nin erken ve yarım gelmesinden çok daha fazla kullanıcı tutar. gRPC v1.x, MQTT/MCP v2.
6. **Güven anlatısını ürünleştirin:** "Hesap yok, telemetri yok, cloud yok, veri senin klasöründe" — bu cümleler README'nin ilk paragrafı olmalı; Bruno bunun 43.8k yıldızlık kanıtı.
7. **Türkçe + Laravel ekosistemi kartını oynayın:** TR yerelleştirme + Laravel `Http::`/Guzzle kod export + PHP topluluklarında lansman, global devlerin hiçbirinin sunmadığı bir yerel bağ kurar; adapter pattern'li import/export mimarisi de (Postman/OpenAPI/Insomnia/HAR) mevcut NewsPull/PodcastDistributor deneyiminizle birebir örtüşen bir tasarımdır.

---

*Bu rapor, 3 Temmuz 2026 tarihinde belirtilen 17 kaynağın (GitHub repoları ve ürün siteleri) canlı içerikleri ve güncel pazar haberleri incelenerek hazırlanmıştır. Yıldız sayıları ve sürüm bilgileri rapor tarihine aittir.*