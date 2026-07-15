# Product Market FIT — Market Intelligence & Shopify Competitor Monitor (clone di GLITCH)

> Design spec — 2026-07-15
> Autore: Claude (brainstorming) · Owner: Andrea Bilotta
> Repo: `meta-ai-media-buyer` (DreamBrothers Hub) · Branch di lavoro: da `feat/smm-agent`
> Stato: **DA APPROVARE** prima di scrivere codice.

---

## 0. TL;DR

Costruiamo un **modulo di market intelligence** dentro DreamBrothers Hub che rifà — in versione moderna, pulita e legale — il vecchio tool **GLITCH** di Thomas Macorig: monitora store Shopify concorrenti e traccia **nuovi prodotti, variazioni di prezzo, stock/disponibilità e collezioni**, storicizza gli snapshot, rileva i cambiamenti e li consegna come **brief di opportunità** in una nuova pagina di sidebar **"Product Market FIT"** (dentro il gruppo *Print on Demand*, prima di *Bulk Creator*).

Il ruolo **Market Intelligence & Product Research Strategist** (dal file mansioni) diventa l'ottava figura del team, realizzata come **skill dell'agente Claude VPS** (`references/skills/market-intelligence.md`) + il modulo server che raccoglie i dati. Riusa 1:1 i pattern già presenti nel repo: modulo `research`, scheduler in-process, bridge REST con `x-care-secret`, storage Drizzle/MySQL, deploy Railway.

**Decisioni risolte con l'utente (2026-07-15):**
1. **Scope Fase 1 = Monitor competitor Shopify** (cuore GLITCH), self-contained. Ad spy/marketplace = fasi successive (§11).
2. **Notifiche = solo in-app** per ora (niente email/Telegram in Fase 1).
3. **Stima vendite = la più precisa e onesta possibile → motore a livelli (§5.4)**: mai numeri inventati; ogni cifra porta metodo + confidenza + perché. Su store POD dove le vendite assolute NON sono misurabili pubblicamente, il tool lo dichiara e mostra il ranking reale di vendita, non un numero falso.
4. **Sì al subagent Claude Code** portabile (`.claude/agents/market-intelligence.md`) OLTRE allo skill agente VPS.
5. **Store seed iniziali**: `dotcomcanvas.de`, `ikonick.com`, `gernucci.com` (tutti verificati Shopify + POD, vedi §5.4).

> **Continuità mobile:** il lavoro vive nel repo GitHub `meta-ai-media-buyer` → riprendibile da telefono via Claude Code web puntando al repo. Questa sessione-terminale locale non si trasferisce di per sé; il ponte è il repo committato.

---

## 1. Contesto e perché questa architettura

### 1.1 Cos'era GLITCH (demistificato dai suoi file)
Aperti i DB del tool originale (`Software GLITCH/bin/*.db`):
- `store.db → records(product, price, currency, sells_count, tot_sold, last_sell, ...)` = **tracker di store Shopify** basato sul `/products.json` pubblico + polling dell'inventario per stimare le vendite.
- `found.db → products(adtitle, keyword, country, active_ads, adurl)` + `filters(keywords, country)` = **ad spy sulla Meta Ad Library** per keyword/paese.
- `useragents.txt` (309 KB) + `proxy_credentials.cfg` = rotazione UA/proxy anti-ban.

Nessun "backdoor": è tutto dato **pubblico** (endpoint JSON storefront + libreria trasparenza Meta) più stima statistica. È esattamente ciò che oggi rivendono Minea, PPSpy, Winning Hunter, Everbee, ecc.

### 1.2 Perché dentro Hub e non un tool Python separato
La brief originale immaginava un tool Python standalone su VPS con DB, scheduler e CLII propri. Ma il repo `meta-ai-media-buyer` **ha già** tutto ciò che serve, e replicarlo altrove sarebbe debito tecnico:

| Serve a GLITCH-clone | Già presente in Hub |
|---|---|
| Store CRUD + storage | Drizzle ORM + MySQL/TiDB, pattern `getDb()`, migrazioni auto all'avvio |
| Raccolta dati periodica | Modulo `research` (fetch → dedup → arricchimento LLM), modulo `watchlist` |
| "Sempre acceso" (VPS) | **Railway always-on** + `scheduler.ts` in-process (job giornalieri ora italiana) |
| Agente AI che analizza | **Bridge REST verso agente Claude VPS** (`x-care-secret`) + fallback LLM server (Gemini) |
| Report/alert | `alerts`, `_core/notification.ts`, chat bridge `social_chat_messages` |
| Interfaccia | React 19 + Vite, componenti shadcn, `SeoResearch.tsx` come template pagina |
| Deploy | GitHub → Railway (auto-migrate all'avvio) |

**Runtime:** il **primario è il server Railway** (always-on, scheduler in-process già usato per research/watchlist). La **VPS** resta come *fallback / worker di scraping pesante* e come host dell'agente Claude che fa l'analisi intelligente — esattamente il modello "VPS come fallback" richiesto.

### 1.3 Come i tool commerciali reperiscono i dati (fondamento del progetto)
Sintesi verificata (vedi §12 fonti): tutti combinano **(1)** pagine pubbliche + API/portali ufficiali pubblici, **(2)** scraping su larga scala con proxy/UA, **(3)** clickstream/panel *comprato*, **(4)** modelli di stima. La parte **pubblica e ad alto segnale** (Meta Ad Library, `products.json`, BSR Amazon, "sold" visibili, delta recensioni) è replicabile a €0; la parte **panel** (traffico SimilarWeb, volumi di ricerca esatti) no, ma si approssima con proxy gratuiti (Google Trends, Keyword Planner). Questo modulo presidia la parte pubblica.

---

## 2. Obiettivo e criteri di successo (Fase 1)

**Obiettivo:** dato un elenco di store Shopify concorrenti (per dominio), rilevare ogni giorno cosa è cambiato e consegnare un brief di opportunità azionabile nella pagina Product Market FIT.

**Definition of done Fase 1:**
1. Posso aggiungere/rimuovere/modificare store competitor dalla UI (CRUD) e impostare frequenza + collezioni di interesse.
2. Un ciclo di monitoraggio scarica il catalogo pubblico di ogni store, salva uno snapshot e rileva i cambiamenti (`NEW_PRODUCT`, `PRICE_CHANGE`, `STOCK_OUT`, `RESTOCK`, `REMOVED_PRODUCT`, `COLLECTION_CHANGE`).
3. Lo scheduler in-process lancia il ciclo una volta al giorno (default), rispettando la frequenza per-store.
4. La pagina **Product Market FIT** mostra i cambiamenti, filtrabili, con badge di priorità AI.
5. L'agente Claude VPS legge i cambiamenti via REST, li valuta contro i criteri di prodotto vincente e riscrive `score` + `brief` + `angle` (arricchimento Claude-first, Gemini fallback).
6. Un "morning brief" opzionale riepiloga i top-N cambiamenti nel chat bridge.
7. Solo dati pubblici, rate limiting educato, disclaimer legale.

**Non-goal Fase 1 (rimandati, vedi §11):** ad spy Meta, marketplace Etsy/Amazon, stime di traffico, keyword discovery, email/Telegram come canale primario.

---

## 3. Architettura del modulo (mirror del pattern `research`)

```
client/src/pages/ProductMarketFit.tsx      ← nuova pagina (template: SeoResearch.tsx)
client/src/components/DashboardLayout.tsx   ← prepend voce a GELATO_ITEMS
client/src/App.tsx (router wouter)          ← nuova route /gelato/market-fit

server/marketIntel.ts          ← fetch/parse/diff puri (come research.ts)
server/marketIntelService.ts   ← orchestrazione (come researchService.ts)
server/db.ts                   ← query helper (come i blocchi esistenti)
server/routers.ts              ← router tRPC `marketIntel` (CRUD + read per la web app)
server/_core/marketRoutes.ts   ← REST /api/market/* per l'agente VPS (come researchRoutes.ts)
server/_core/index.ts          ← registerMarketRoutes(app) + CREATE TABLE IF NOT EXISTS
server/_core/scheduler.ts      ← scheduleDaily(9,15,"market-monitor", ...)
drizzle/schema.ts              ← 4 nuove tabelle Drizzle
references/skills/market-intelligence.md  ← skill agente VPS (il "ruolo")
.claude/agents/market-intelligence.md     ← subagent Claude Code portabile (stessa competenza, run locali)
```

**Flusso dati:**
```
scheduler (o UI o REST) → runAllStoresCycle(userId)
  └─ per store attivo → runStoreMonitorCycle:
       fetchShopifyCatalog(domain) → normalizeShopifyProduct[]
       → loadPrevSnapshot(storeId) → detectChanges(prev, curr) → ChangeEvent[]
       → saveCatalogSnapshot + upsertProducts + insertChanges
  → enrichPendingChanges (Gemini fallback) | agente Claude VPS via /api/market/pending-enrich
  → (opzionale) morning brief nel chat bridge
Pagina Product Market FIT ← trpc.marketIntel.listChanges / listStores
Agente VPS ← REST /api/market/* (x-care-secret)
```

Ogni unità ha un compito solo e un'interfaccia netta: `marketIntel.ts` è puro (testabile con fixture, nessun DB), `marketIntelService.ts` orchestra e tocca il DB, i router/route sono adattatori sottili.

---

## 4. Modello dati (Drizzle + DDL TiDB-compatibile)

Convenzioni del repo: colonne camelCase, `userId` scoping, `OWNER_USER_ID = 1`, DDL minimale ultra-compatibile TiDB (no ENUM/DEFAULT CURRENT_TIMESTAMP dove rischioso; `utf8mb4`), tabelle create sia in Drizzle sia via `CREATE TABLE IF NOT EXISTS` in `runMigrations()`.

### 4.1 `market_stores` — competitor CRUD
```sql
CREATE TABLE IF NOT EXISTS market_stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  label VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,          -- es. brand.com o brand.myshopify.com (normalizzato, no schema/slash)
  platform VARCHAR(16) NOT NULL DEFAULT 'shopify',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',   -- pending|active|error|paused
  frequencyHours INT NOT NULL DEFAULT 24,
  collectionsFilter TEXT,                -- JSON array di collection handle (opzionale)
  isShopify BOOLEAN NOT NULL DEFAULT TRUE,
  productCount INT NOT NULL DEFAULT 0,
  lastError TEXT,
  lastRefreshAt TIMESTAMP NULL,
  createdAt TIMESTAMP NULL,
  updatedAt TIMESTAMP NULL,
  UNIQUE KEY uq_market_store (userId, domain)
) DEFAULT CHARSET=utf8mb4;
```

### 4.2 `market_products` — catalogo corrente per store
```sql
CREATE TABLE IF NOT EXISTS market_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  storeId INT NOT NULL,
  productId VARCHAR(64) NOT NULL,        -- shopify product id (stringa)
  handle VARCHAR(255),
  title TEXT NOT NULL,
  productType VARCHAR(255),
  vendor VARCHAR(255),
  tags TEXT,
  url TEXT,
  imageUrl TEXT,
  minPrice DECIMAL(12,2),
  compareAtPrice DECIMAL(12,2),
  currency VARCHAR(8),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  totalVariants INT NOT NULL DEFAULT 0,
  variantsAvailable INT NOT NULL DEFAULT 0,
  publishedAt TIMESTAMP NULL,
  firstSeenAt TIMESTAMP NULL,
  lastSeenAt TIMESTAMP NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = non più nel catalogo (rimosso)
  bestSellerRank INT,                    -- ultima posizione best-selling nota
  estUnits INT,                          -- unità stimate nel periodo (NULL se non misurabile)
  estMethod VARCHAR(24),                 -- inventory|reviews|rank|none
  estConfidence VARCHAR(8),              -- high|medium|low|none
  UNIQUE KEY uq_market_product (storeId, productId)
) DEFAULT CHARSET=utf8mb4;
```

### 4.3 `market_snapshots` — serie storica per prodotto
```sql
CREATE TABLE IF NOT EXISTS market_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  storeId INT NOT NULL,
  productId VARCHAR(64) NOT NULL,
  minPrice DECIMAL(12,2),
  compareAtPrice DECIMAL(12,2),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  variantsAvailable INT NOT NULL DEFAULT 0,
  totalVariants INT NOT NULL DEFAULT 0,
  trueStock INT,                         -- stock reale per-prodotto SOLO se il cart-probe rivela numeri NON uniformi (Tier A); altrimenti NULL
  bestSellerRank INT,                    -- posizione in sort_by=best-selling (segnale di vendita reale, Tier C)
  reviewCount INT,                       -- conteggio recensioni pubbliche se c'e' una review app (Tier B)
  capturedAt TIMESTAMP NULL,
  INDEX idx_market_snap (storeId, productId, capturedAt)
) DEFAULT CHARSET=utf8mb4;
```

### 4.4 `market_changes` — ChangeEvent log (ciò che legge il report)
```sql
CREATE TABLE IF NOT EXISTS market_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  storeId INT NOT NULL,
  productId VARCHAR(64),                 -- NULL per cambiamenti store-level (es. nuova collezione)
  changeType VARCHAR(24) NOT NULL,       -- NEW_PRODUCT|PRICE_CHANGE|STOCK_OUT|RESTOCK|REMOVED_PRODUCT|COLLECTION_CHANGE
  title TEXT,
  url TEXT,
  oldValue TEXT,
  newValue TEXT,
  detail TEXT,
  brief TEXT,                            -- lettura AI dell'opportunità (nullable)
  angle TEXT,                            -- chiave di lettura brand (nullable)
  score INT,                             -- priorità AI 0-10 (nullable finché non arricchito)
  status VARCHAR(16) NOT NULL DEFAULT 'nuovo',  -- nuovo|letto|archiviato
  detectedAt TIMESTAMP NULL,
  enrichedAt TIMESTAMP NULL,
  INDEX idx_market_change_user (userId, detectedAt),
  INDEX idx_market_change_store (storeId)
) DEFAULT CHARSET=utf8mb4;
```

### 4.5 Config → riuso di `user_settings`
Come per `seo_research_sources`, niente tabella nuova: chiavi `market_stores_config` (non serve, gli store sono in tabella), `market_brand_context`, `market_notify_channel`, `market_autopilot`, `market_min_score`.

**`ChangeEvent` (tipo TS restituito da `detectChanges`)**
```ts
type ChangeType = "NEW_PRODUCT"|"PRICE_CHANGE"|"STOCK_OUT"|"RESTOCK"|"REMOVED_PRODUCT"|"COLLECTION_CHANGE";
interface ChangeEvent {
  storeId: number; productId?: string; changeType: ChangeType;
  title?: string; url?: string; oldValue?: string; newValue?: string; detail?: string;
}
```

---

## 5. Raccolta dati (solo endpoint pubblici Shopify)

### 5.1 Endpoint usati (tutti pubblici, storefront)
| Endpoint | Cosa dà | Uso |
|---|---|---|
| `GET /products.json?limit=250&since_id=<id>` | catalogo: id, handle, title, product_type, vendor, tags, published_at/created_at/updated_at, images[], **variants[]** con `price`, `compare_at_price`, **`available`** | catalogo completo + prezzo + stock per-variant |
| `GET /collections.json?limit=250` | elenco collezioni pubbliche | rilevare collezioni aggiunte/rimosse |
| `GET /collections/<handle>/products.json` | prodotti in una collezione | filtro "collezioni di interesse" + membership change |
| `GET /sitemap_products_1.xml` | fallback di discovery + `lastmod` | quando `/products.json` è disabilitato |
| `GET /collections/all?sort_by=best-selling` (HTML) | ordinamento best-seller = **ranking di vendita REALE** di Shopify | segnale di domanda per-prodotto (§5.4 Tier C) |
| `POST /cart/add.js` qty alta | max quantità acquistabile | stock reale SOLO se non uniforme (§5.4 Tier A) |
| pagina prodotto / review app (Loox/Judge.me/Okendo/Yotpo/Stamped) | conteggio recensioni pubbliche | velocità recensioni → stima ordini (§5.4 Tier B) |

Paginazione: `limit=250` max, avanzamento con `since_id` (il `?page=` è deprecato). Selezione campi con `?fields=` per ridurre payload.

### 5.2 Funzioni (in `server/marketIntel.ts`, pure)
```ts
isShopifyStore(domain): Promise<boolean>                 // HEAD/GET /products.json → 200 + JSON valido
fetchShopifyCatalog(domain, opts?): Promise<RawProduct[]> // paginazione since_id, rate-limited, retry
fetchShopifyCollections(domain): Promise<RawCollection[]>
normalizeShopifyProduct(raw, storeId): NormProduct        // → struttura comune Product/Variant/Price/Stock/URL
detectChanges(prev: NormProduct[], curr: NormProduct[]): ChangeEvent[]
// motore stima vendite (§5.4)
probeTrueStock(domain, variantIds): Promise<Map<id,number|null>>   // cart-probe, con detection cap-fasulli
fetchBestSellerRanks(domain, collection?): Promise<Map<handle,number>>  // parse HTML best-selling
fetchReviewCounts(domain, handles): Promise<Map<handle,number>>   // se review app presente
estimateSales(product, history): SalesEstimate  // {units|null, method, confidence, rationale}
```

**Regole di rilevamento (`detectChanges`):**
- `NEW_PRODUCT`: `productId` non presente in `prev` (o `publishedAt` entro la finestra).
- `REMOVED_PRODUCT`: `productId` in `prev` ma assente in `curr` → in DB `active=FALSE`.
- `PRICE_CHANGE`: `minPrice` o `compareAtPrice` diversi (registra old→new; distingui ribasso/rialzo e sconto attivato).
- `STOCK_OUT`: `available` da true→false (a livello prodotto: nessuna variante disponibile).
- `RESTOCK`: `available` da false→true.
- `COLLECTION_CHANGE`: collezione nuova/rimossa, o prodotto entrato/uscito da una collezione tracciata.

### 5.3 Rate limiting, anti-ban, resilienza
- **Educazione:** default ≤ 1 richiesta / 2 s per store, 1 crawl completo/giorno; concorrenza globale limitata (coda). Mai parallelismo aggressivo sullo stesso host.
- **UA rotation:** piccola lista curata di user-agent browser realistici (non i 309 KB di GLITCH; bastano ~10). Header `Accept`, `Accept-Language` coerenti.
- **Proxy opzionale:** `MARKET_PROXY_URL` (riprende il concetto di `proxy_credentials.cfg` di GLITCH) — off di default; utile solo su cataloghi enormi.
- **Backoff:** rispetta `429` e `430` (Shopify usa 430 per throttling scraping) leggendo `Retry-After`; retry con backoff esponenziale (max 3), timeout 15 s.
- **Resilienza per-item:** un prodotto malformato non fa fallire il ciclo (come `storeResearchItems`); errori raccolti e loggati, store passa a `status='error'` con `lastError`.
- **Cache/If-Modified-Since** dove supportato per ridurre banda.

### 5.4 Motore di stima vendite — onesto per design (la richiesta #3)

**Principio non-negoziabile:** il tool non stampa MAI un numero di vendite inventato. Ogni cifra esce con `{units | null, method, confidence, rationale}`. Se le vendite assolute non sono misurabili pubblicamente su uno store, il tool lo **dichiara** e mostra il segnale reale che ha (ranking), non una supposizione.

**Perché serve questo (verificato empiricamente sui 3 store seed, 2026-07-15):**
- `products.json` NON espone `inventory_quantity` su nessuno dei 3 (solo `available` booleano).
- Cart-probe `POST /cart/add.js` qty=99999:
  - `ikonick.com` → cap **10** identico su ogni prodotto → **placeholder/cap-per-ordine, non stock reale**.
  - `gernucci.com` → cap **50** identico ovunque → **placeholder**.
  - `dotcomcanvas.de` → **1000** o illimitato (poster/acrylic) → **placeholder/POD**.
  - Uno stock reale varia prodotto-per-prodotto (47, 3, 112…); numeri **uniformi e tondi = falsi**. Tutti e 3 sono POD/made-to-order → il metodo "guardo lo stock scendere = vendite" **non è applicabile** e darebbe numeri fasulli.
- `sort_by=best-selling` invece **funziona e riordina davvero** su tutti e 3 (≠ ordine "newest") → è un **ranking di vendita reale** di Shopify (pubblico). Review app: `dotcomcanvas` usa Stamped (velocità recensioni possibile); `ikonick`/`gernucci` nessuna evidente.

**Motore a livelli (sceglie automaticamente il migliore disponibile per store/prodotto):**

| Tier | Metodo | Quando si applica | Output | Confidenza |
|---|---|---|---|---|
| **A** | **Inventory decrement**: cart-probe ripetuto, conta i cali monotoni dello stock reale | SOLO se i numeri del probe sono **non uniformi** tra prodotti E variano nel tempo coerentemente (rileva e scarta i cap tondi/fasulli) | unità vendute ~esatte | **alta** |
| **B** | **Review-velocity**: Δ conteggio recensioni / review-rate (default 2-4%, calibrabile per store) | se è presente una review app (Loox/Judge.me/Okendo/Yotpo/Stamped) | ordini stimati | **media** |
| **C** | **Best-seller rank tracking**: posizione in `sort_by=best-selling` + sua velocità; modello rank→quota (Pareto) per una quota di vendita relativa | sempre (tutti gli store Shopify) | **domanda relativa** + trend; niente unità assolute | **bassa (relativo)** |
| **D** | **Catalog-behavior**: sopravvivenza prodotto + promozione nelle collezioni best-seller + durata in catalogo | sempre | "winner validato" (booleano/score), NON vendite | euristica |

**Contratto in UI:** ogni prodotto mostra la stima col suo badge di metodo/confidenza. Es. per i tuoi 3 store (POD, Tier C): *"Vendite assolute non misurabili pubblicamente (POD, stock non tracciato, no review app) — Rank best-seller #4, ↑3 posizioni in 7gg"*. Per uno store con inventario reale: *"~62 unità/7gg (Tier A, inventory decrement, confidenza alta)"*. Questo È la "stima precisa" richiesta: precisione = misurare quando si può e dichiararlo quando non si può.

---

## 6. Versioning e confronto

`saveCatalogSnapshot(storeId, catalog)`:
1. Upsert `market_products` (aggiorna `lastSeenAt`, campi correnti; `firstSeenAt` solo al primo inserimento).
2. Inserisce una riga `market_snapshots` per prodotto (prezzo/stock del momento).
3. Marca `active=FALSE` i prodotti non più visti (→ `REMOVED_PRODUCT`).

`detectChanges(prev, curr)` confronta lo stato precedente (ultimo snapshot / stato `market_products`) col catalogo appena scaricato e produce `ChangeEvent[]`, che vengono scritti in `market_changes` con `status='nuovo'`, `score=NULL` (in attesa di arricchimento).

Idempotenza: due run ravvicinati senza cambiamenti non generano eventi duplicati (confronto su valore, non su timestamp).

---

## 7. Interfacce

### 7.1 tRPC router `marketIntel` (web app) — `server/routers.ts`
```
marketIntel.addStore({ label, domain, frequencyHours?, collections? })
marketIntel.removeStore({ id })
marketIntel.updateStore({ id, ...settings })
marketIntel.listStores()
marketIntel.runNow({ id? })                 // trigger manuale ciclo (uno o tutti)
marketIntel.listChanges({ storeId?, changeType?, status?, minScore?, hours?, limit? })
marketIntel.setChangeStatus({ id, status }) // nuovo|letto|archiviato
marketIntel.getConfig() / setConfig({...})  // brandContext, autopilot, minScore, notifyChannel
marketIntel.generateBrief({ hours? })       // brief di opportunità on-demand
```
Autorizzazione: come gli altri router, via `ctx` autenticato (owner). Nessun input controlla `userId`.

### 7.2 REST bridge `/api/market/*` (agente VPS) — `server/_core/marketRoutes.ts`
Stesso `checkSecret` (`x-care-secret` = `CARE_WEBHOOK_SECRET`), `OWNER_USER_ID=1`:
```
GET  /api/market/stores                              → elenco store + stato
POST /api/market/refresh        {storeId?}           → lancia ciclo (per cron/agente)
GET  /api/market/changes?hours=24&min_score=6&type=&status=&limit=50
GET  /api/market/pending-enrich                      → {brand_context, items:[change da valutare]}
POST /api/market/enrichment     {items:[{id, score, brief, angle}]}   ← Claude-first
POST /api/market/status         {id, status}
POST /api/market/ingest         {items:[...]}         → segnali esterni (ad library, marketplace) — hook Fase 2/3
```

### 7.3 Ciclo di monitoraggio
```ts
runStoreMonitorCycle(userId, storeId): Promise<{ changes: number; errors: string[] }>
runAllStoresCycle(userId): Promise<{ stores: number; changes: number; errors: string[] }>
```

---

## 8. L'agente: Market Intelligence & Product Research Strategist

Realizzato come **skill dell'agente Claude VPS**: `references/skills/market-intelligence.md` (formato identico a `seo-research.md`). Mappa le **8 competenze** del file mansioni in task concreti sui dati del modulo:

| Competenza (mansioni) | Realizzazione nel tool |
|---|---|
| 1. Trend Forecasting & Demand Detection | incrocio nuovi prodotti tra più store + feed `research` (Google Trends) → domanda in salita |
| 2. Competitive Intelligence & Ad Spy | il monitor (Fase 1) + Meta Ad Library (Fase 2) |
| 3. Market Gap & Opportunity Analysis | whitespace: product_type/fascia-prezzo che pochi competitor presidiano |
| 4. Product Validation & Winning-Product Criteria | scoring 0-10 di ogni `NEW_PRODUCT` (wow-factor, marginalità POD, saturazione, differenziazione) |
| 5. Data Analysis & Tool Mastery | il modulo È lo stack; l'agente incrocia le fonti |
| 6. Customer & Audience Insight | riuso analisi commenti Reddit del modulo `research`; recensioni (fase successiva) |
| 7. Pricing & Offer Intelligence | distribuzione prezzi tra competitor, pattern `compare_at` (sconti) |
| 8. Sintesi & Reporting Strategico | il **brief di opportunità** giornaliero nella pagina Product Market FIT |

**Arricchimento Claude-first (come seo-research):** ogni ciclo l'agente fa `GET /api/market/pending-enrich`, valuta ogni cambiamento contro `brand_context` e criteri di prodotto vincente, e `POST /api/market/enrichment` con `{score, brief, angle}`. Il server usa Gemini free-tier solo come fallback. Guardrail: `score` alto solo se coerente col brand/avatar (anti-rumore).

**Confermato (decisione 4):** si crea **anche** il subagent Claude Code `.claude/agents/market-intelligence.md` — stessa competenza riformattata come subagent, per run locali on-demand da Claude Code (indipendente dalla web app; utile per analisi ad-hoc e per lavorare dal repo anche da mobile via Claude Code web).

---

## 9. Reporting, pagina e notifiche

- **Pagina `Product Market FIT`** (`client/src/pages/ProductMarketFit.tsx`, template `SeoResearch.tsx`): tabella cambiamenti con filtri (store, tipo, stato, score minimo, finestra ore), badge priorità, azioni (segna letto/archivia), pannello store (CRUD + "Run now"), header brief del giorno. Stile dark coerente (oklch, shadcn).
- **Sidebar:** prepend a `GELATO_ITEMS` in `DashboardLayout.tsx`:
  ```ts
  { icon: Radar, label: "Product Market FIT", path: "/gelato/market-fit", description: "Monitor competitor & opportunità" },
  ```
  (prima di *Bulk Creator*, come richiesto). Route registrata nel router client.
- **Brief di opportunità:** `generateBrief()` produce un riepilogo dei top cambiamenti (nuovi prodotti ad alto score, cali/aumenti prezzo, restock significativi) — mostrato in pagina e, opzionale, spinto nel chat bridge come "morning brief".
- **Notifiche (decisione 2 → solo in-app in Fase 1):** i cambiamenti ad alto score generano badge in pagina + nella campanella (riuso pattern `alerts`/`unreadCount`). Nessun email/Telegram per ora; gli hook `_core/notification.ts` restano disponibili per una fase successiva senza rifattorizzare.

---

## 10. Scheduler, legale, testing, rollout

### 10.1 Scheduler
Aggiunta in `registerDailySchedules()`:
```ts
scheduleDaily(9, 15, "market-monitor", async () => {
  const r = await runAllStoresCycle(OWNER_USER_ID);
  // handoff enrichment all'agente Claude se il server non ha motore sincrono (come research 09:00)
});
```
Rispetta `frequencyHours` per-store (uno store con 12h può essere incluso in un secondo slot serale se serve). In-process va bene perché Railway è always-on (coerente con la scelta già fatta nel repo; la nota "no in-process timer" in `periodic-updates.md` era per l'era Cloud Run/Manus).

### 10.2 Legale ed etico (§ obbligatoria nel README + footer pagina)
- **Solo dati pubblici**: `products.json`, `collections.json`, sitemap. **Nessun** bypass di login, paywall, o sistemi anti-bot; **nessun** CAPTCHA solving.
- **Rispetto `robots.txt`** e dei ToS del singolo store; polling conservativo; UA identificativo onesto; backoff su throttling.
- **GDPR**: si raccolgono dati di prodotto, non dati personali.
- **Disclaimer**: l'utente è responsabile dell'uso e della conformità ai ToS di ciascuno store monitorato. Il tool è per competitive intelligence lecita.

### 10.3 Testing (vitest, come i test esistenti)
- `server/marketIntel.test.ts`: `normalizeShopifyProduct` e `detectChanges` con fixture JSON (nuovo/prezzo/stock/rimosso/collezione) — nessun DB.
- `server/marketIntelService.test.ts`: ciclo completo con fetch mockato → asserzioni su snapshot + changes.
- Mirror di `research.test.ts` / `watchlist.test.ts`.

### 10.4 Rollout
- Branch da `feat/smm-agent`. Tabelle create sia in `drizzle/schema.ts` sia in `runMigrations()` (`CREATE TABLE IF NOT EXISTS`) + una migration in `drizzle/`. Additivo: nessuna tabella esistente toccata. Deploy Railway auto-migra all'avvio. Env riusati: `DATABASE_URL`, `CARE_WEBHOOK_SECRET`, `SOCIAL_BASE_URL`. Nuovi opzionali: `MARKET_PROXY_URL`, `TELEGRAM_*`, `SMTP_*`.

---

## 11. Roadmap oltre la Fase 1 (decomposizione esplicita)

| Fase | Contenuto | Riuso |
|---|---|---|
| **1 (questo spec)** | Monitor competitor Shopify → pagina Product Market FIT + skill agente + scheduler | pattern `research` |
| **2 — Ad Spy** | Meta Ad Library per keyword/paese (parità con `found.db` di GLITCH; "winning products/creatives") | l'app ha già MCP `ads_library_search` + `metaApi.ts` |
| **3 — Marketplace** | Etsy/Amazon: keyword → listing, stima vendite da segnali pubblici (parità Everbee/Helium) | Apify MCP + dati pubblici |
| **4 — Demand/Traffic proxies** | Google Trends (già in `research`), Keyword Planner; stime traffico approssimate (SimilarWeb è a pagamento) | modulo `research` |

Ogni fase = proprio spec → plan → implementazione. La pagina e la skill agente sono progettate per accogliere le fonti successive tramite `/api/market/ingest` e nuovi `changeType`/`source`.

---

## 12. Decisioni — RISOLTE (2026-07-15)
1. **Canale notifiche** → solo in-app in Fase 1. ✔
2. **Stima vendite** → motore a livelli onesto (§5.4), la più precisa possibile senza inventare numeri. ✔
3. **Subagent Claude Code** → sì, `.claude/agents/market-intelligence.md` oltre allo skill VPS. ✔
4. **Seeding** → `dotcomcanvas.de`, `ikonick.com`, `gernucci.com` (pre-inseriti al primo avvio). ✔
5. **Slot scheduler** → 09:15 Europe/Rome (dopo research 09:00). Un secondo giro serale è aggiungibile in futuro se servono frequenze <24h.

Restano micro-scelte da fare in implementazione (non bloccanti): review-rate di default per Tier B, soglia `market_min_score` per il badge notifica, numero di prodotti best-seller tracciati per store.

## 13. Fonti (verifica dei fondamenti)
- Shopify `/products.json` — limite `250` + paginazione `since_id`, `?fields=`, varianti con `available`/`price`/`compare_at_price`: [Shopify API limits](https://shopify.dev/docs/api/usage/limits), [Relative pagination](https://www.shopify.com/partners/blog/relative-pagination), [community pagination](https://community.shopify.com/t/how-to-paginate-or-get-a-list-of-all-products-using-domain-com-products-json/99991).
- Stima vendite da segnali pubblici (inventario nel tempo, margine 20-40%, top tool 85-95%): [ZIK Analytics — best Shopify sales trackers](https://www.zikanalytics.com/blog/best-shopify-sales-trackers/), [copyfy — view sales](https://www.copyfy.io/en/blog/view-sales-shopify-store).
