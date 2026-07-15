# Product Market FIT — Shopify Competitor Monitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a DreamBrothers Hub un modulo che monitora store Shopify concorrenti (nuovi prodotti, prezzo, stock, collezioni), storicizza gli snapshot, rileva i cambiamenti con stima vendite onesta a livelli, e li consegna nella nuova pagina sidebar "Product Market FIT" + skill/subagent Market Intelligence.

**Architecture:** Nuovo modulo che rispecchia il pattern `research` del repo: fetch/parse/diff puri in `server/marketIntel.ts`, orchestrazione in `server/marketIntelService.ts`, query in `server/db.ts`, bridge REST `/api/market/*` in `server/_core/marketRoutes.ts`, router tRPC `marketIntel`, pagina React modellata su `SeoResearch.tsx`, scheduler in-process. Runtime primario = Railway always-on; agente Claude VPS = analisi via REST.

**Tech Stack:** TypeScript ESM, Express 4, tRPC 11, Drizzle ORM (mysql2, MySQL/TiDB), React 19 + Vite + Wouter + Tailwind/shadcn, Vitest. pnpm.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-15-product-market-fit-shopify-monitor-design.md`.

## Global Constraints

- **Solo dati pubblici**: `/products.json`, `/collections.json`, `/collections/all?sort_by=best-selling` (HTML), `/cart/add.js`. Nessun bypass di login/paywall/anti-bot, nessun CAPTCHA.
- **Stima vendite onesta**: mai numeri inventati. Ogni stima ha `{ units: number|null, method: "inventory"|"reviews"|"rank"|"none", confidence: "high"|"medium"|"low"|"none", rationale: string }`. I cap di stock uniformi/tondi vanno riconosciuti come falsi e scartati (niente Tier A).
- **`OWNER_USER_ID = 1`** per scheduler e route REST (come `researchRoutes.ts`/`scheduler.ts`).
- **Auth REST** = header `x-care-secret` == `process.env.CARE_WEBHOOK_SECRET` (riuso `checkSecret`).
- **DDL TiDB-safe**: boot `CREATE TABLE IF NOT EXISTS` senza `ENUM`/`DEFAULT CURRENT_TIMESTAMP`/indici secondari nel CREATE (timestamp settati dall'app come fa `researchService`), `DEFAULT CHARSET=utf8mb4`. La schema Drizzle può usare `mysqlEnum` per i tipi (coesiste con VARCHAR reale, come `research_items`).
- **Editare SEMPRE sotto `client/src/**`** e `server/**` reali; ignorare i duplicati stale a root (`components/`, `pages/`, `App.tsx`).
- **rate limiting educato**: ≤ 1 richiesta / 2s per host, 1 crawl completo/giorno di default, retry con backoff su 429/430 rispettando `Retry-After`, timeout 15s, UA rotation (~10 UA realistici).
- **Notifiche solo in-app** in Fase 1.
- **Nessun `pnpm`/dipendenza nuova**: usare solo `fetch` nativo (Node 18+) e librerie già presenti.

---

## File Structure

| File | Responsabilità | Azione |
|---|---|---|
| `drizzle/schema.ts` | 4 tabelle Drizzle + tipi | Modify (append) |
| `server/_core/index.ts` | boot DDL `CREATE TABLE IF NOT EXISTS` ×4 + `registerMarketRoutes(app)` | Modify |
| `server/marketIntel.ts` | fetch/parse/diff/estimate PURI (testabili) | Create |
| `server/marketIntel.test.ts` | test unitari dei puri | Create |
| `server/marketIntelService.ts` | orchestrazione ciclo, snapshot, changes, config, enrich, brief | Create |
| `server/marketIntelService.test.ts` | test ciclo (fetch mockato) | Create |
| `server/db.ts` | query helper market_* | Modify (append) |
| `server/_core/marketRoutes.ts` | REST `/api/market/*` per agente VPS | Create |
| `server/routers.ts` | router tRPC `marketIntel` | Modify |
| `server/_core/scheduler.ts` | `scheduleDaily(9,15,"market-monitor", …)` | Modify |
| `client/src/pages/ProductMarketFit.tsx` | pagina (template: `SeoResearch.tsx`) | Create |
| `client/src/App.tsx` | route `/gelato/market-fit` | Modify |
| `client/src/components/DashboardLayout.tsx` | voce sidebar prepend a `GELATO_ITEMS` | Modify |
| `references/skills/market-intelligence.md` | skill agente VPS (il "ruolo") | Create |
| `.claude/agents/market-intelligence.md` | subagent Claude Code portabile | Create |
| `README.md` | sezione legale/etica market monitor | Modify |

Tipi condivisi (definiti in `server/marketIntel.ts`, consumati ovunque):

```ts
export type ChangeType = "NEW_PRODUCT"|"PRICE_CHANGE"|"STOCK_OUT"|"RESTOCK"|"REMOVED_PRODUCT"|"COLLECTION_CHANGE";
export interface NormVariant { variantId: string; price: number; compareAtPrice: number|null; available: boolean; }
export interface NormProduct {
  productId: string; handle: string; title: string; productType: string|null; vendor: string|null;
  tags: string; url: string; imageUrl: string|null; minPrice: number|null; compareAtPrice: number|null;
  currency: string|null; available: boolean; totalVariants: number; variantsAvailable: number;
  variants: NormVariant[]; publishedAt: Date|null;
}
export interface ChangeEvent {
  storeId: number; productId?: string; changeType: ChangeType;
  title?: string; url?: string; oldValue?: string; newValue?: string; detail?: string;
}
export type EstMethod = "inventory"|"reviews"|"rank"|"none";
export type EstConfidence = "high"|"medium"|"low"|"none";
export interface SalesEstimate { units: number|null; method: EstMethod; confidence: EstConfidence; rationale: string; }
```

---

## Task 1: Schema DB (Drizzle + boot migrations)

**Files:**
- Modify: `drizzle/schema.ts` (append in fondo)
- Modify: `server/_core/index.ts` (dentro `runMigrations()`, dopo il blocco `research_items`)

**Interfaces:**
- Produces: tabelle `marketStores`, `marketProducts`, `marketSnapshots`, `marketChanges` + tipi `MarketStore`, `MarketProduct`, `MarketSnapshot`, `MarketChange`.

- [ ] **Step 1: Append tabelle Drizzle in `drizzle/schema.ts`**

```ts
// ─── Market Intelligence: competitor Shopify stores (clone GLITCH) ────────────
export const marketStores = mysqlTable("market_stores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(), // normalizzato: no schema, no slash finale
  platform: varchar("platform", { length: 16 }).default("shopify").notNull(),
  status: mysqlEnum("status", ["pending", "active", "error", "paused"]).default("pending").notNull(),
  frequencyHours: int("frequencyHours").default(24).notNull(),
  collectionsFilter: text("collectionsFilter"), // JSON array di collection handle (opzionale)
  isShopify: boolean("isShopify").default(true).notNull(),
  productCount: int("productCount").default(0).notNull(),
  lastError: text("lastError"),
  lastRefreshAt: timestamp("lastRefreshAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("uq_market_store").on(t.userId, t.domain)]);
export type MarketStore = typeof marketStores.$inferSelect;

export const marketProducts = mysqlTable("market_products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  storeId: int("storeId").notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  handle: varchar("handle", { length: 255 }),
  title: text("title").notNull(),
  productType: varchar("productType", { length: 255 }),
  vendor: varchar("vendor", { length: 255 }),
  tags: text("tags"),
  url: text("url"),
  imageUrl: text("imageUrl"),
  minPrice: decimal("minPrice", { precision: 12, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 8 }),
  available: boolean("available").default(true).notNull(),
  totalVariants: int("totalVariants").default(0).notNull(),
  variantsAvailable: int("variantsAvailable").default(0).notNull(),
  publishedAt: timestamp("publishedAt"),
  firstSeenAt: timestamp("firstSeenAt"),
  lastSeenAt: timestamp("lastSeenAt"),
  active: boolean("active").default(true).notNull(),
  bestSellerRank: int("bestSellerRank"),
  estUnits: int("estUnits"),
  estMethod: varchar("estMethod", { length: 24 }),
  estConfidence: varchar("estConfidence", { length: 8 }),
}, (t) => [uniqueIndex("uq_market_product").on(t.storeId, t.productId)]);
export type MarketProduct = typeof marketProducts.$inferSelect;

export const marketSnapshots = mysqlTable("market_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  minPrice: decimal("minPrice", { precision: 12, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 12, scale: 2 }),
  available: boolean("available").default(true).notNull(),
  variantsAvailable: int("variantsAvailable").default(0).notNull(),
  totalVariants: int("totalVariants").default(0).notNull(),
  trueStock: int("trueStock"),
  bestSellerRank: int("bestSellerRank"),
  reviewCount: int("reviewCount"),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
});
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;

export const marketChanges = mysqlTable("market_changes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  storeId: int("storeId").notNull(),
  productId: varchar("productId", { length: 64 }),
  changeType: varchar("changeType", { length: 24 }).notNull(),
  title: text("title"),
  url: text("url"),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  detail: text("detail"),
  brief: text("brief"),
  angle: text("angle"),
  score: int("score"),
  status: mysqlEnum("status", ["nuovo", "letto", "archiviato"]).default("nuovo").notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  enrichedAt: timestamp("enrichedAt"),
});
export type MarketChange = typeof marketChanges.$inferSelect;
```

- [ ] **Step 2: Aggiungere il blocco boot DDL in `server/_core/index.ts`**

Dentro `runMigrations()`, dopo il `try { … research_items … } catch { … }` (≈ riga 196), inserire:

```ts
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS market_stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      label VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      platform VARCHAR(16) NOT NULL DEFAULT 'shopify',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      frequencyHours INT NOT NULL DEFAULT 24,
      collectionsFilter TEXT,
      isShopify BOOLEAN NOT NULL DEFAULT TRUE,
      productCount INT NOT NULL DEFAULT 0,
      lastError TEXT,
      lastRefreshAt TIMESTAMP NULL,
      createdAt TIMESTAMP NULL,
      updatedAt TIMESTAMP NULL,
      UNIQUE KEY uq_market_store (userId, domain)
    ) DEFAULT CHARSET=utf8mb4`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS market_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL, storeId INT NOT NULL,
      productId VARCHAR(64) NOT NULL, handle VARCHAR(255), title TEXT NOT NULL,
      productType VARCHAR(255), vendor VARCHAR(255), tags TEXT, url TEXT, imageUrl TEXT,
      minPrice DECIMAL(12,2), compareAtPrice DECIMAL(12,2), currency VARCHAR(8),
      available BOOLEAN NOT NULL DEFAULT TRUE, totalVariants INT NOT NULL DEFAULT 0,
      variantsAvailable INT NOT NULL DEFAULT 0, publishedAt TIMESTAMP NULL,
      firstSeenAt TIMESTAMP NULL, lastSeenAt TIMESTAMP NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
      bestSellerRank INT, estUnits INT, estMethod VARCHAR(24), estConfidence VARCHAR(8),
      UNIQUE KEY uq_market_product (storeId, productId)
    ) DEFAULT CHARSET=utf8mb4`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS market_snapshots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      storeId INT NOT NULL, productId VARCHAR(64) NOT NULL,
      minPrice DECIMAL(12,2), compareAtPrice DECIMAL(12,2),
      available BOOLEAN NOT NULL DEFAULT TRUE, variantsAvailable INT NOT NULL DEFAULT 0,
      totalVariants INT NOT NULL DEFAULT 0, trueStock INT, bestSellerRank INT, reviewCount INT,
      capturedAt TIMESTAMP NULL
    ) DEFAULT CHARSET=utf8mb4`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS market_changes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL, storeId INT NOT NULL, productId VARCHAR(64),
      changeType VARCHAR(24) NOT NULL, title TEXT, url TEXT, oldValue TEXT, newValue TEXT,
      detail TEXT, brief TEXT, angle TEXT, score INT,
      status VARCHAR(16) NOT NULL DEFAULT 'nuovo', detectedAt TIMESTAMP NULL, enrichedAt TIMESTAMP NULL
    ) DEFAULT CHARSET=utf8mb4`);
    console.log("[Migrate] Tabelle market_* pronte");
  } catch (err) {
    console.warn("[Migrate] tabelle market non create:", err);
  }
```

- [ ] **Step 3: Verifica compilazione**

Run: `pnpm exec tsc --noEmit` (dalla root repo)
Expected: nessun errore di tipo relativo a `drizzle/schema.ts`.

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts server/_core/index.ts
git commit -m "feat(market): schema tabelle market_* + boot migrations"
```

---

## Task 2: Fetch + normalize Shopify (marketIntel.ts, parte 1) — TDD

**Files:**
- Create: `server/marketIntel.ts`
- Test: `server/marketIntel.test.ts`

**Interfaces:**
- Produces: `normalizeShopifyProduct(raw, storeDomain): NormProduct`, `parseCatalog(json, storeDomain): NormProduct[]`, `fetchShopifyCatalog(domain, opts?): Promise<NormProduct[]>`, `isShopifyStore(domain): Promise<boolean>`, `normalizeDomain(input): string`, `USER_AGENTS`, `politeFetch(url, opts?)`.
- Consumes: tipi da questo stesso file (blocco tipi nel File Structure).

- [ ] **Step 1: Test — normalizeDomain + parseCatalog + normalizeShopifyProduct**

Create `server/marketIntel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeDomain, parseCatalog, normalizeShopifyProduct } from "./marketIntel";

const RAW = {
  id: 123, title: "Poster X", handle: "poster-x", published_at: "2026-07-10T12:00:00Z",
  product_type: "Poster", vendor: "Brand", tags: "wall,art",
  images: [{ src: "https://cdn/x.jpg" }],
  variants: [
    { id: 9, price: "29.99", compare_at_price: "39.99", available: true },
    { id: 10, price: "24.99", compare_at_price: null, available: false },
  ],
};

describe("normalizeDomain", () => {
  it("strips schema, path, trailing slash, www", () => {
    expect(normalizeDomain("https://www.Brand.com/collections/all")).toBe("brand.com");
    expect(normalizeDomain("brand.myshopify.com/")).toBe("brand.myshopify.com");
  });
});

describe("normalizeShopifyProduct", () => {
  it("computes minPrice, availability, variant counts", () => {
    const p = normalizeShopifyProduct(RAW, "brand.com");
    expect(p.productId).toBe("123");
    expect(p.minPrice).toBe(24.99);
    expect(p.compareAtPrice).toBe(39.99); // compare del variant a minPrice? -> vedi Step 3: compare del variant scelto
    expect(p.available).toBe(true);        // almeno una variante disponibile
    expect(p.totalVariants).toBe(2);
    expect(p.variantsAvailable).toBe(1);
    expect(p.url).toBe("https://brand.com/products/poster-x");
    expect(p.imageUrl).toBe("https://cdn/x.jpg");
  });
  it("marks product unavailable when no variant available", () => {
    const raw = { ...RAW, variants: [{ id: 1, price: "5.00", compare_at_price: null, available: false }] };
    expect(normalizeShopifyProduct(raw, "brand.com").available).toBe(false);
  });
});

describe("parseCatalog", () => {
  it("maps a products.json payload to NormProduct[]", () => {
    const out = parseCatalog({ products: [RAW] }, "brand.com");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Poster X");
  });
  it("returns [] on malformed payload", () => {
    expect(parseCatalog({}, "brand.com")).toEqual([]);
    expect(parseCatalog(null, "brand.com")).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui i test — devono fallire**

Run: `pnpm exec vitest run server/marketIntel.test.ts`
Expected: FAIL (`marketIntel` non esiste / funzioni non definite).

- [ ] **Step 3: Implementa `server/marketIntel.ts` (parte 1)**

```ts
/**
 * Market Intelligence — fetch/parse/diff/estimate PURI per store Shopify.
 * Solo dati pubblici (products.json, collections, best-selling, cart-probe).
 * Nessun accesso al DB qui: tutto testabile con fixture.
 */

// ─── Tipi (vedi plan File Structure) ──────────────────────────────────────────
export type ChangeType = "NEW_PRODUCT"|"PRICE_CHANGE"|"STOCK_OUT"|"RESTOCK"|"REMOVED_PRODUCT"|"COLLECTION_CHANGE";
export interface NormVariant { variantId: string; price: number; compareAtPrice: number|null; available: boolean; }
export interface NormProduct {
  productId: string; handle: string; title: string; productType: string|null; vendor: string|null;
  tags: string; url: string; imageUrl: string|null; minPrice: number|null; compareAtPrice: number|null;
  currency: string|null; available: boolean; totalVariants: number; variantsAvailable: number;
  variants: NormVariant[]; publishedAt: Date|null;
}
export interface ChangeEvent {
  storeId: number; productId?: string; changeType: ChangeType;
  title?: string; url?: string; oldValue?: string; newValue?: string; detail?: string;
}
export type EstMethod = "inventory"|"reviews"|"rank"|"none";
export type EstConfidence = "high"|"medium"|"low"|"none";
export interface SalesEstimate { units: number|null; method: EstMethod; confidence: EstConfidence; rationale: string; }

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];
function pickUA(seed = 0): string { return USER_AGENTS[seed % USER_AGENTS.length]; }

export function normalizeDomain(input: string): string {
  let d = String(input || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  return d.replace(/\/+$/, "");
}

function toNum(v: unknown): number | null {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

export function normalizeShopifyProduct(raw: any, storeDomain: string): NormProduct {
  const variants: NormVariant[] = Array.isArray(raw?.variants) ? raw.variants.map((v: any) => ({
    variantId: String(v.id),
    price: toNum(v.price) ?? 0,
    compareAtPrice: toNum(v.compare_at_price),
    available: !!v.available,
  })) : [];
  // variante a prezzo minimo → prezzo e compare mostrati (il "da X€")
  const cheapest = variants.slice().sort((a, b) => a.price - b.price)[0];
  const availableCount = variants.filter((v) => v.available).length;
  const handle = String(raw?.handle ?? "");
  const img = Array.isArray(raw?.images) && raw.images[0]?.src ? String(raw.images[0].src) : null;
  const pub = raw?.published_at ? new Date(raw.published_at) : null;
  return {
    productId: String(raw?.id ?? ""),
    handle,
    title: String(raw?.title ?? "").slice(0, 500),
    productType: raw?.product_type ? String(raw.product_type) : null,
    vendor: raw?.vendor ? String(raw.vendor) : null,
    tags: Array.isArray(raw?.tags) ? raw.tags.join(",") : String(raw?.tags ?? ""),
    url: `https://${storeDomain}/products/${handle}`,
    imageUrl: img,
    minPrice: cheapest ? cheapest.price : null,
    compareAtPrice: cheapest ? cheapest.compareAtPrice : null,
    currency: null, // products.json non espone la valuta; riempita a livello store se nota
    available: availableCount > 0,
    totalVariants: variants.length,
    variantsAvailable: availableCount,
    variants,
    publishedAt: pub && !isNaN(pub.getTime()) ? pub : null,
  };
}

export function parseCatalog(json: any, storeDomain: string): NormProduct[] {
  const prods = json?.products;
  if (!Array.isArray(prods)) return [];
  return prods.map((p) => normalizeShopifyProduct(p, storeDomain)).filter((p) => p.productId);
}

// ─── Rete (integration-tested dal ciclo reale, non nei test unitari) ──────────
export async function politeFetch(url: string, opts: { seed?: number; timeoutMs?: number; method?: string; body?: string; headers?: Record<string,string> } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "User-Agent": pickUA(opts.seed), "Accept": "application/json,text/html;q=0.9", "Accept-Language": "en,it;q=0.8", ...(opts.headers ?? {}) },
      body: opts.body, signal: ctrl.signal, redirect: "follow",
    });
  } finally { clearTimeout(timer); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function isShopifyStore(domain: string): Promise<boolean> {
  const d = normalizeDomain(domain);
  try {
    const r = await politeFetch(`https://${d}/products.json?limit=1`, { timeoutMs: 10000 });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j?.products);
  } catch { return false; }
}

/** Scarica l'intero catalogo pubblico paginando con since_id (limit 250). */
export async function fetchShopifyCatalog(domain: string, opts: { maxPages?: number } = {}): Promise<NormProduct[]> {
  const d = normalizeDomain(domain);
  const out: NormProduct[] = [];
  let sinceId = 0;
  const maxPages = opts.maxPages ?? 40; // 40 * 250 = 10k prodotti
  for (let page = 0; page < maxPages; page++) {
    const url = `https://${d}/products.json?limit=250&since_id=${sinceId}`;
    const r = await politeFetch(url, { seed: page });
    if (r.status === 429 || r.status === 430) {
      const retry = Number(r.headers.get("retry-after") ?? "2");
      await sleep(Math.min(retry, 30) * 1000);
      page--; continue;
    }
    if (!r.ok) break;
    const json = await r.json().catch(() => null);
    const batch = parseCatalog(json, d);
    if (batch.length === 0) break;
    out.push(...batch);
    const maxId = Math.max(...(json.products as any[]).map((p) => Number(p.id) || 0));
    if (maxId <= sinceId) break;
    sinceId = maxId;
    await sleep(2000); // rate limit educato
  }
  return out;
}
```

- [ ] **Step 4: Esegui i test — devono passare**

Run: `pnpm exec vitest run server/marketIntel.test.ts`
Expected: PASS (5 test).

Nota bug-check test: nel Step 1 l'asserzione `compareAtPrice` deve riflettere il compare della variante a prezzo minimo (la seconda, 24.99, compare = null). Correggere l'asserzione a `expect(p.compareAtPrice).toBeNull()` e `expect(p.minPrice).toBe(24.99)`. (Il valore 39.99 nel commento è la variante più cara; NON è quella scelta.)

- [ ] **Step 5: Commit**

```bash
git add server/marketIntel.ts server/marketIntel.test.ts
git commit -m "feat(market): fetch+normalize Shopify catalog (puri, TDD)"
```

---

## Task 3: Diff engine `detectChanges` — TDD

**Files:**
- Modify: `server/marketIntel.ts` (append `detectChanges`)
- Modify: `server/marketIntel.test.ts` (append test)

**Interfaces:**
- Produces: `detectChanges(storeId: number, prev: NormProduct[], curr: NormProduct[]): ChangeEvent[]`
- Consumes: `NormProduct`, `ChangeEvent` (Task 2).

- [ ] **Step 1: Test dei 5 tipi di cambiamento**

Append a `server/marketIntel.test.ts`:

```ts
import { detectChanges } from "./marketIntel";
function P(over: Partial<import("./marketIntel").NormProduct>): import("./marketIntel").NormProduct {
  return { productId: "1", handle: "h", title: "T", productType: null, vendor: null, tags: "",
    url: "u", imageUrl: null, minPrice: 10, compareAtPrice: null, currency: null,
    available: true, totalVariants: 1, variantsAvailable: 1, variants: [], publishedAt: null, ...over };
}
describe("detectChanges", () => {
  it("NEW_PRODUCT quando appare un id nuovo", () => {
    const c = detectChanges(7, [P({ productId: "1" })], [P({ productId: "1" }), P({ productId: "2", title: "Nuovo" })]);
    expect(c.filter((e) => e.changeType === "NEW_PRODUCT").map((e) => e.productId)).toEqual(["2"]);
  });
  it("REMOVED_PRODUCT quando un id sparisce", () => {
    const c = detectChanges(7, [P({ productId: "1" }), P({ productId: "2" })], [P({ productId: "1" })]);
    expect(c.filter((e) => e.changeType === "REMOVED_PRODUCT").map((e) => e.productId)).toEqual(["2"]);
  });
  it("PRICE_CHANGE quando minPrice cambia", () => {
    const c = detectChanges(7, [P({ productId: "1", minPrice: 10 })], [P({ productId: "1", minPrice: 8 })]);
    const e = c.find((x) => x.changeType === "PRICE_CHANGE");
    expect(e?.oldValue).toBe("10"); expect(e?.newValue).toBe("8");
  });
  it("STOCK_OUT e RESTOCK sul flip di available", () => {
    const out = detectChanges(7, [P({ productId: "1", available: true })], [P({ productId: "1", available: false })]);
    expect(out.some((e) => e.changeType === "STOCK_OUT")).toBe(true);
    const back = detectChanges(7, [P({ productId: "1", available: false })], [P({ productId: "1", available: true })]);
    expect(back.some((e) => e.changeType === "RESTOCK")).toBe(true);
  });
  it("nessun evento se nulla cambia", () => {
    expect(detectChanges(7, [P({ productId: "1" })], [P({ productId: "1" })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire** — Run: `pnpm exec vitest run server/marketIntel.test.ts` → FAIL (`detectChanges` non definita).

- [ ] **Step 3: Implementa `detectChanges` (append a `server/marketIntel.ts`)**

```ts
export function detectChanges(storeId: number, prev: NormProduct[], curr: NormProduct[]): ChangeEvent[] {
  const prevById = new Map(prev.map((p) => [p.productId, p]));
  const currById = new Map(curr.map((p) => [p.productId, p]));
  const events: ChangeEvent[] = [];
  for (const p of curr) {
    const before = prevById.get(p.productId);
    if (!before) {
      events.push({ storeId, productId: p.productId, changeType: "NEW_PRODUCT", title: p.title, url: p.url,
        newValue: p.minPrice != null ? String(p.minPrice) : undefined, detail: p.productType ?? undefined });
      continue;
    }
    if (before.minPrice != null && p.minPrice != null && before.minPrice !== p.minPrice) {
      events.push({ storeId, productId: p.productId, changeType: "PRICE_CHANGE", title: p.title, url: p.url,
        oldValue: String(before.minPrice), newValue: String(p.minPrice),
        detail: p.minPrice < before.minPrice ? "ribasso" : "rialzo" });
    }
    if (before.available && !p.available) {
      events.push({ storeId, productId: p.productId, changeType: "STOCK_OUT", title: p.title, url: p.url });
    } else if (!before.available && p.available) {
      events.push({ storeId, productId: p.productId, changeType: "RESTOCK", title: p.title, url: p.url });
    }
  }
  for (const p of prev) {
    if (!currById.has(p.productId)) {
      events.push({ storeId, productId: p.productId, changeType: "REMOVED_PRODUCT", title: p.title, url: p.url });
    }
  }
  return events;
}
```

- [ ] **Step 4: Esegui — deve passare** — Run: `pnpm exec vitest run server/marketIntel.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add server/marketIntel.ts server/marketIntel.test.ts
git commit -m "feat(market): detectChanges diff engine (TDD)"
```

---

## Task 4: Motore stima vendite onesto (Tier A/B/C) — TDD

**Files:**
- Modify: `server/marketIntel.ts` (append)
- Modify: `server/marketIntel.test.ts` (append)

**Interfaces:**
- Produces:
  - `looksFakeStockCap(values: number[]): boolean` — true se i cap sono uniformi/tondi (placeholder).
  - `estimateSales(input): SalesEstimate` con input `{ trueStockNow, trueStockPrev, hoursElapsed, reviewNow, reviewPrev, reviewRate, bestSellerRank, allStockValues }`.
  - `probeTrueStock(domain, variantIds): Promise<Map<string, number|null>>` (network, thin).
  - `fetchBestSellerRanks(domain): Promise<Map<string, number>>` (network, parse HTML).
- Consumes: `SalesEstimate` (Task 2).

- [ ] **Step 1: Test — fake-cap detection + estimateSales sceglie il tier onesto**

Append a `server/marketIntel.test.ts`:

```ts
import { looksFakeStockCap, estimateSales } from "./marketIntel";

describe("looksFakeStockCap", () => {
  it("true se tutti i cap sono identici (placeholder)", () => {
    expect(looksFakeStockCap([10, 10, 10, 10])).toBe(true);   // ikonick
    expect(looksFakeStockCap([50, 50, 50])).toBe(true);        // gernucci
    expect(looksFakeStockCap([1000, 1000])).toBe(true);        // dotcomcanvas
  });
  it("false se i valori variano (inventario reale)", () => {
    expect(looksFakeStockCap([47, 3, 112, 8])).toBe(false);
  });
});

describe("estimateSales — sceglie il tier corretto, niente numeri finti", () => {
  it("Tier A: inventario reale calante -> unità esatte, alta confidenza", () => {
    const e = estimateSales({ trueStockPrev: 50, trueStockNow: 44, hoursElapsed: 24, allStockValues: [47,3,112], reviewRate: 0.03 });
    expect(e.method).toBe("inventory"); expect(e.units).toBe(6); expect(e.confidence).toBe("high");
  });
  it("Tier A NON si applica se i cap sono fasulli (uniformi) -> fallback", () => {
    const e = estimateSales({ trueStockPrev: 50, trueStockNow: 44, hoursElapsed: 24, allStockValues: [50,50,50], bestSellerRank: 4, reviewRate: 0.03 });
    expect(e.method).not.toBe("inventory");
  });
  it("Tier B: review velocity -> stima ordini, media confidenza", () => {
    const e = estimateSales({ reviewPrev: 100, reviewNow: 106, hoursElapsed: 24 * 7, reviewRate: 0.03, allStockValues: [10,10] });
    expect(e.method).toBe("reviews"); expect(e.units).toBe(Math.round(6 / 0.03)); expect(e.confidence).toBe("medium");
  });
  it("Tier C: solo rank -> units null, confidenza low, rationale onesto", () => {
    const e = estimateSales({ bestSellerRank: 4, allStockValues: [50,50], reviewRate: 0.03 });
    expect(e.method).toBe("rank"); expect(e.units).toBeNull(); expect(e.confidence).toBe("low");
  });
  it("nessun segnale -> none, units null", () => {
    const e = estimateSales({ allStockValues: [50,50], reviewRate: 0.03 });
    expect(e.method).toBe("none"); expect(e.units).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui — deve fallire** — Run: `pnpm exec vitest run server/marketIntel.test.ts` → FAIL.

- [ ] **Step 3: Implementa il motore (append a `server/marketIntel.ts`)**

```ts
/** I cap di /cart/add.js sono fasulli se tutti uguali (placeholder/max-per-ordine), non stock reale. */
export function looksFakeStockCap(values: number[]): boolean {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return true; // troppo pochi dati per fidarsi
  const uniq = new Set(v);
  if (uniq.size === 1) return true;               // tutti identici -> placeholder
  // quasi tutti uguali a un valore tondo (>=80%) -> placeholder
  const round = v.filter((n) => n % 10 === 0).length;
  return round / v.length >= 0.8 && uniq.size <= 2;
}

export interface EstimateInput {
  trueStockPrev?: number; trueStockNow?: number; hoursElapsed?: number;
  reviewPrev?: number; reviewNow?: number; reviewRate?: number;
  bestSellerRank?: number; allStockValues?: number[];
}
export function estimateSales(input: EstimateInput): SalesEstimate {
  const stockReal = (input.allStockValues?.length ? !looksFakeStockCap(input.allStockValues) : false);
  // TIER A — inventory decrement (solo se lo stock e' reale e cala)
  if (stockReal && typeof input.trueStockPrev === "number" && typeof input.trueStockNow === "number") {
    const delta = input.trueStockPrev - input.trueStockNow;
    if (delta >= 0) {
      return { units: delta, method: "inventory", confidence: "high",
        rationale: `Inventario reale ${input.trueStockPrev}→${input.trueStockNow} in ${input.hoursElapsed ?? "?"}h = ${delta} unità vendute.` };
    }
    // delta<0 = restock: non stimabile da questo ciclo, cade ai tier sotto
  }
  // TIER B — review velocity
  const rate = input.reviewRate && input.reviewRate > 0 ? input.reviewRate : 0.03;
  if (typeof input.reviewPrev === "number" && typeof input.reviewNow === "number") {
    const dRev = input.reviewNow - input.reviewPrev;
    if (dRev > 0) {
      return { units: Math.round(dRev / rate), method: "reviews", confidence: "medium",
        rationale: `+${dRev} recensioni; review-rate stimato ${(rate * 100).toFixed(0)}% → ~${Math.round(dRev / rate)} ordini.` };
    }
  }
  // TIER C — best-seller rank (relativo, niente unità)
  if (typeof input.bestSellerRank === "number") {
    return { units: null, method: "rank", confidence: "low",
      rationale: `Vendite assolute non misurabili pubblicamente (POD/stock non tracciato). Rank best-seller #${input.bestSellerRank} = domanda relativa reale.` };
  }
  return { units: null, method: "none", confidence: "none",
    rationale: "Nessun segnale pubblico di vendita disponibile per questo prodotto." };
}

/** Cart-probe: max quantita' acquistabile per variante (best-effort, per rilevare stock reale vs cap fasullo). */
export async function probeTrueStock(domain: string, variantIds: string[]): Promise<Map<string, number|null>> {
  const d = normalizeDomain(domain);
  const out = new Map<string, number|null>();
  for (let i = 0; i < variantIds.length; i++) {
    if (i > 0) await sleep(1500);
    const vid = variantIds[i];
    try {
      const r = await politeFetch(`https://${d}/cart/add.js`, {
        method: "POST", seed: i,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ items: [{ id: Number(vid), quantity: 99999 }] }),
      });
      if (r.status === 422) {
        const j = await r.json().catch(() => null);
        const m = String(j?.description ?? j?.message ?? "").match(/(\d[\d.,]*)/);
        out.set(vid, m ? Number(m[1].replace(/[.,]/g, "")) : null);
      } else if (r.ok) {
        out.set(vid, null); // nessun limite = oversell/POD = stock non tracciato
      } else out.set(vid, null);
    } catch { out.set(vid, null); }
  }
  return out;
}

/** Ordine best-selling (ranking vendite reale di Shopify) parsando la collezione HTML. */
export async function fetchBestSellerRanks(domain: string): Promise<Map<string, number>> {
  const d = normalizeDomain(domain);
  const ranks = new Map<string, number>();
  try {
    const r = await politeFetch(`https://${d}/collections/all?sort_by=best-selling`, { headers: { "Accept": "text/html" } });
    if (!r.ok) return ranks;
    const html = await r.text();
    const seen: string[] = [];
    const re = /\/products\/([a-z0-9\-]+)/g; let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) { if (!seen.includes(m[1])) seen.push(m[1]); }
    seen.forEach((handle, i) => ranks.set(handle, i + 1));
  } catch { /* best-effort */ }
  return ranks;
}
```

- [ ] **Step 4: Esegui — deve passare** — Run: `pnpm exec vitest run server/marketIntel.test.ts` → PASS (tutti).

- [ ] **Step 5: Commit**
```bash
git add server/marketIntel.ts server/marketIntel.test.ts
git commit -m "feat(market): motore stima vendite a livelli, onesto (TDD)"
```

---

## Task 5: db.ts — query helper market_*

**Files:**
- Modify: `server/db.ts` (import schema + append helper in fondo)

**Interfaces:**
- Produces (firme consumate da service/router/routes):
  - `addMarketStore(userId, {label, domain, frequencyHours?, collectionsFilter?, isShopify?}): Promise<number>`
  - `removeMarketStore(userId, id): Promise<void>`
  - `listMarketStores(userId): Promise<MarketStore[]>`
  - `getMarketStore(userId, id): Promise<MarketStore|undefined>`
  - `updateMarketStore(id, patch): Promise<void>`
  - `getMarketProducts(storeId): Promise<MarketProduct[]>`
  - `upsertMarketProduct(row): Promise<void>` · `markMarketProductsInactive(storeId, keepProductIds): Promise<void>`
  - `insertMarketSnapshot(row): Promise<void>`
  - `insertMarketChanges(rows): Promise<void>`
  - `getMarketChanges(userId, filters): Promise<MarketChange[]>` · `getUnenrichedMarketChanges(userId, limit): Promise<MarketChange[]>`
  - `updateMarketChange(id, patch): Promise<void>` · `getMarketChangeById(id): Promise<MarketChange|undefined>`

- [ ] **Step 1: Aggiornare l'import schema in cima a `server/db.ts`**

Alla riga 3 (import da `../drizzle/schema`), aggiungere alla lista: `marketStores, marketProducts, marketSnapshots, marketChanges`. Aggiungere anche gli operatori mancanti se servono (già importati: `eq, desc, and, or, isNull, gte, lte, sql`; aggiungere `inArray, notInArray` da "drizzle-orm" alla riga 1).

- [ ] **Step 2: Append helper in fondo a `server/db.ts`**

```ts
// ─── Market Intelligence (competitor Shopify monitor) ─────────────────────────
export async function addMarketStore(userId: number, s: { label: string; domain: string; frequencyHours?: number; collectionsFilter?: string | null; isShopify?: boolean }): Promise<number> {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const now = new Date();
  const r = await db.insert(marketStores).values({
    userId, label: s.label, domain: s.domain, status: "pending",
    frequencyHours: s.frequencyHours ?? 24, collectionsFilter: s.collectionsFilter ?? null,
    isShopify: s.isShopify ?? true, createdAt: now, updatedAt: now,
  }).onDuplicateKeyUpdate({ set: { label: s.label, updatedAt: now, status: "pending" } });
  return (r as any)[0]?.insertId ?? 0;
}
export async function removeMarketStore(userId: number, id: number): Promise<void> {
  const db = await getDb(); if (!db) return;
  await db.delete(marketStores).where(and(eq(marketStores.id, id), eq(marketStores.userId, userId)));
}
export async function listMarketStores(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(marketStores).where(eq(marketStores.userId, userId)).orderBy(desc(marketStores.createdAt));
}
export async function getMarketStore(userId: number, id: number) {
  const db = await getDb(); if (!db) return undefined;
  const r = await db.select().from(marketStores).where(and(eq(marketStores.id, id), eq(marketStores.userId, userId))).limit(1);
  return r[0];
}
export async function updateMarketStore(id: number, patch: Partial<typeof marketStores.$inferInsert>) {
  const db = await getDb(); if (!db) return;
  await db.update(marketStores).set({ ...patch, updatedAt: new Date() }).where(eq(marketStores.id, id));
}
export async function getMarketProducts(storeId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(marketProducts).where(eq(marketProducts.storeId, storeId));
}
export async function upsertMarketProduct(row: typeof marketProducts.$inferInsert) {
  const db = await getDb(); if (!db) return;
  await db.insert(marketProducts).values(row).onDuplicateKeyUpdate({ set: {
    title: row.title, handle: row.handle, productType: row.productType, vendor: row.vendor, tags: row.tags,
    url: row.url, imageUrl: row.imageUrl, minPrice: row.minPrice, compareAtPrice: row.compareAtPrice,
    available: row.available, totalVariants: row.totalVariants, variantsAvailable: row.variantsAvailable,
    lastSeenAt: row.lastSeenAt, active: true,
    ...(row.bestSellerRank != null ? { bestSellerRank: row.bestSellerRank } : {}),
    ...(row.estUnits != null ? { estUnits: row.estUnits } : {}),
    ...(row.estMethod != null ? { estMethod: row.estMethod } : {}),
    ...(row.estConfidence != null ? { estConfidence: row.estConfidence } : {}),
  } });
}
export async function markMarketProductsInactive(storeId: number, keepProductIds: string[]) {
  const db = await getDb(); if (!db) return;
  if (keepProductIds.length === 0) { await db.update(marketProducts).set({ active: false }).where(eq(marketProducts.storeId, storeId)); return; }
  await db.update(marketProducts).set({ active: false }).where(and(eq(marketProducts.storeId, storeId), notInArray(marketProducts.productId, keepProductIds)));
}
export async function insertMarketSnapshot(row: typeof marketSnapshots.$inferInsert) {
  const db = await getDb(); if (!db) return;
  await db.insert(marketSnapshots).values({ ...row, capturedAt: row.capturedAt ?? new Date() });
}
export async function insertMarketChanges(rows: Array<typeof marketChanges.$inferInsert>) {
  const db = await getDb(); if (!db || rows.length === 0) return;
  await db.insert(marketChanges).values(rows.map((r) => ({ ...r, detectedAt: r.detectedAt ?? new Date() })));
}
export async function getMarketChanges(userId: number, f: { storeId?: number; changeType?: string; status?: string; minScore?: number; hours?: number; limit?: number } = {}) {
  const db = await getDb(); if (!db) return [];
  const conds = [eq(marketChanges.userId, userId)];
  if (f.storeId) conds.push(eq(marketChanges.storeId, f.storeId));
  if (f.changeType) conds.push(eq(marketChanges.changeType, f.changeType));
  if (f.status) conds.push(eq(marketChanges.status, f.status as any));
  if (f.minScore) conds.push(gte(marketChanges.score, f.minScore));
  if (f.hours) conds.push(gte(marketChanges.detectedAt, new Date(Date.now() - f.hours * 3600_000)));
  return db.select().from(marketChanges).where(and(...conds)).orderBy(desc(marketChanges.detectedAt)).limit(Math.min(f.limit ?? 100, 500));
}
export async function getUnenrichedMarketChanges(userId: number, limit = 15) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(marketChanges).where(and(eq(marketChanges.userId, userId), isNull(marketChanges.score))).orderBy(desc(marketChanges.detectedAt)).limit(limit);
}
export async function getMarketChangeById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const r = await db.select().from(marketChanges).where(eq(marketChanges.id, id)).limit(1);
  return r[0];
}
export async function updateMarketChange(id: number, patch: Partial<typeof marketChanges.$inferInsert>) {
  const db = await getDb(); if (!db) return;
  await db.update(marketChanges).set(patch).where(eq(marketChanges.id, id));
}
```

- [ ] **Step 3: Verifica typecheck** — Run: `pnpm exec tsc --noEmit` → nessun errore.

- [ ] **Step 4: Commit**
```bash
git add server/db.ts
git commit -m "feat(market): db helpers CRUD store + snapshot + changes"
```

---

## Task 6: marketIntelService.ts — orchestrazione ciclo + enrich + brief

**Files:**
- Create: `server/marketIntelService.ts`
- Test: `server/marketIntelService.test.ts`

**Interfaces:**
- Consumes: tutto Task 2-5, `runResearchLLM`/`extractJson` da `./research` (LLM fallback), `insertSocialChatMessage`/`getAllUserSettings` da `./db`.
- Produces:
  - `runStoreMonitorCycle(userId, storeId): Promise<{ changes: number; errors: string[] }>`
  - `runAllStoresCycle(userId): Promise<{ stores: number; changes: number; errors: string[] }>`
  - `enrichPendingMarketChanges(userId, limit?): Promise<{ enriched: number }>`
  - `applyMarketEnrichment(items): Promise<number>`
  - `getMarketConfig(userId)` / `saveMarketConfig(userId, cfg)`
  - `generateOpportunityBrief(userId, hours?): Promise<string>`

- [ ] **Step 1: Test — il ciclo rileva e salva i cambiamenti (fetch mockato via injection)**

`runStoreMonitorCycle` accetta un parametro opzionale `deps` per iniettare il fetcher nei test (default = quelli reali). Firma:
```ts
export async function runStoreMonitorCycle(userId: number, storeId: number, deps?: { fetchCatalog?: typeof fetchShopifyCatalog; fetchRanks?: typeof fetchBestSellerRanks }): Promise<{ changes: number; errors: string[] }>
```

Create `server/marketIntelService.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import * as db from "./db";
import { runStoreMonitorCycle } from "./marketIntelService";
import type { NormProduct } from "./marketIntel";

const P = (id: string, over: Partial<NormProduct> = {}): NormProduct => ({
  productId: id, handle: "h"+id, title: "T"+id, productType: null, vendor: null, tags: "",
  url: "https://x/products/h"+id, imageUrl: null, minPrice: 10, compareAtPrice: null, currency: null,
  available: true, totalVariants: 1, variantsAvailable: 1, variants: [], publishedAt: null, ...over });

describe("runStoreMonitorCycle", () => {
  it("rileva un NEW_PRODUCT e lo scrive in market_changes", async () => {
    vi.spyOn(db, "getMarketStore").mockResolvedValue({ id: 5, userId: 1, domain: "x.com", label: "X", collectionsFilter: null } as any);
    vi.spyOn(db, "getMarketProducts").mockResolvedValue([{ productId: "1", minPrice: "10", available: true } as any]);
    vi.spyOn(db, "upsertMarketProduct").mockResolvedValue();
    vi.spyOn(db, "insertMarketSnapshot").mockResolvedValue();
    vi.spyOn(db, "markMarketProductsInactive").mockResolvedValue();
    vi.spyOn(db, "updateMarketStore").mockResolvedValue();
    const insertSpy = vi.spyOn(db, "insertMarketChanges").mockResolvedValue();
    const r = await runStoreMonitorCycle(1, 5, {
      fetchCatalog: async () => [P("1"), P("2")],
      fetchRanks: async () => new Map([["h1", 1], ["h2", 2]]),
    });
    expect(r.changes).toBe(1);
    const written = insertSpy.mock.calls[0][0];
    expect(written.some((c: any) => c.changeType === "NEW_PRODUCT" && c.productId === "2")).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire** — Run: `pnpm exec vitest run server/marketIntelService.test.ts` → FAIL.

- [ ] **Step 3: Implementa `server/marketIntelService.ts`**

```ts
/**
 * Orchestrazione Market Intelligence: ciclo di monitoraggio per store,
 * snapshot + diff, arricchimento (LLM fallback / agente VPS), brief opportunità.
 * Modellato su researchService.ts.
 */
import {
  getMarketStore, listMarketStores, getMarketProducts, upsertMarketProduct,
  markMarketProductsInactive, insertMarketSnapshot, insertMarketChanges,
  updateMarketStore, getUnenrichedMarketChanges, updateMarketChange, getMarketChanges,
  getAllUserSettings, upsertUserSetting,
} from "./db";
import {
  fetchShopifyCatalog, fetchBestSellerRanks, detectChanges, estimateSales,
  type NormProduct,
} from "./marketIntel";
import { runResearchLLM, extractJson, sanitizeText, DEFAULT_BRAND_CONTEXT } from "./research";

const OWNER_USER_ID = 1;

export async function getMarketConfig(userId: number): Promise<{ brandContext: string; autopilot: boolean; minScore: number; reviewRate: number }> {
  const s = await getAllUserSettings(userId);
  return {
    brandContext: s.market_brand_context || DEFAULT_BRAND_CONTEXT,
    autopilot: s.market_autopilot === "true",
    minScore: Number(s.market_min_score ?? 7) || 7,
    reviewRate: Number(s.market_review_rate ?? 0.03) || 0.03,
  };
}
export async function saveMarketConfig(userId: number, cfg: { brandContext?: string; autopilot?: boolean; minScore?: number; reviewRate?: number }): Promise<void> {
  if (cfg.brandContext != null) await upsertUserSetting(userId, "market_brand_context", cfg.brandContext);
  if (cfg.autopilot != null) await upsertUserSetting(userId, "market_autopilot", String(cfg.autopilot));
  if (cfg.minScore != null) await upsertUserSetting(userId, "market_min_score", String(cfg.minScore));
  if (cfg.reviewRate != null) await upsertUserSetting(userId, "market_review_rate", String(cfg.reviewRate));
}

export async function runStoreMonitorCycle(
  userId: number, storeId: number,
  deps: { fetchCatalog?: typeof fetchShopifyCatalog; fetchRanks?: typeof fetchBestSellerRanks } = {}
): Promise<{ changes: number; errors: string[] }> {
  const fetchCatalog = deps.fetchCatalog ?? fetchShopifyCatalog;
  const fetchRanks = deps.fetchRanks ?? fetchBestSellerRanks;
  const errors: string[] = [];
  const store = await getMarketStore(userId, storeId);
  if (!store) return { changes: 0, errors: ["store non trovato"] };
  try {
    const curr = await fetchCatalog(store.domain);
    if (curr.length === 0) {
      await updateMarketStore(storeId, { status: "error", lastError: "catalogo vuoto o products.json non raggiungibile", lastRefreshAt: new Date() });
      return { changes: 0, errors: ["catalogo vuoto"] };
    }
    const ranks = await fetchRanks(store.domain).catch(() => new Map<string, number>());
    // stato precedente da market_products
    const prevRows = await getMarketProducts(storeId);
    const prev: NormProduct[] = prevRows.filter((p: any) => p.active !== false).map((p: any) => ({
      productId: p.productId, handle: p.handle ?? "", title: p.title, productType: p.productType, vendor: p.vendor,
      tags: p.tags ?? "", url: p.url ?? "", imageUrl: p.imageUrl, minPrice: p.minPrice != null ? Number(p.minPrice) : null,
      compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null, currency: p.currency,
      available: !!p.available, totalVariants: p.totalVariants ?? 0, variantsAvailable: p.variantsAvailable ?? 0,
      variants: [], publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    }));
    const events = detectChanges(storeId, prev, curr);
    // persistenza: snapshot + upsert prodotti + inactive dei mancanti
    const now = new Date();
    for (const p of curr) {
      const rank = ranks.get(p.handle) ?? null;
      await upsertMarketProduct({
        userId, storeId, productId: p.productId, handle: p.handle, title: p.title, productType: p.productType,
        vendor: p.vendor, tags: p.tags, url: p.url, imageUrl: p.imageUrl,
        minPrice: p.minPrice != null ? String(p.minPrice) : null,
        compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : null,
        currency: p.currency, available: p.available, totalVariants: p.totalVariants, variantsAvailable: p.variantsAvailable,
        publishedAt: p.publishedAt, firstSeenAt: now, lastSeenAt: now, active: true, bestSellerRank: rank,
      });
      await insertMarketSnapshot({
        storeId, productId: p.productId,
        minPrice: p.minPrice != null ? String(p.minPrice) : null,
        compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : null,
        available: p.available, variantsAvailable: p.variantsAvailable, totalVariants: p.totalVariants,
        bestSellerRank: rank, capturedAt: now,
      });
    }
    await markMarketProductsInactive(storeId, curr.map((p) => p.productId));
    if (events.length > 0) {
      await insertMarketChanges(events.map((e) => ({
        userId, storeId, productId: e.productId ?? null, changeType: e.changeType,
        title: sanitizeText(e.title ?? "", 500) ?? null, url: e.url ?? null,
        oldValue: e.oldValue ?? null, newValue: e.newValue ?? null, detail: e.detail ?? null,
        status: "nuovo", detectedAt: now,
      })));
    }
    await updateMarketStore(storeId, { status: "active", lastError: null, productCount: curr.length, lastRefreshAt: now });
    return { changes: events.length, errors };
  } catch (err) {
    const m = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : String(err);
    await updateMarketStore(storeId, { status: "error", lastError: m, lastRefreshAt: new Date() });
    return { changes: 0, errors: [m] };
  }
}

export async function runAllStoresCycle(userId: number): Promise<{ stores: number; changes: number; errors: string[] }> {
  const stores = (await listMarketStores(userId)).filter((s: any) => s.status !== "paused");
  let changes = 0; const errors: string[] = [];
  for (const s of stores) {
    const r = await runStoreMonitorCycle(userId, s.id);
    changes += r.changes; errors.push(...r.errors.map((e) => `${s.label}: ${e}`));
  }
  return { stores: stores.length, changes, errors };
}

// ─── Arricchimento (Gemini fallback; l'agente Claude VPS e' il motore primario via REST) ─
export async function enrichPendingMarketChanges(userId: number, limit = 12): Promise<{ enriched: number }> {
  const { brandContext } = await getMarketConfig(userId);
  const pending = await getUnenrichedMarketChanges(userId, limit);
  if (pending.length === 0) return { enriched: 0 };
  const sys = `Sei il Market Intelligence & Product Research Strategist del brand:
${brandContext}
Valuta ogni cambiamento di un competitor come opportunità di prodotto. Rispondi SOLO con JSON:
{"items":[{"id":number,"score":0-10 (priorità come opportunità: wow-factor, marginalità POD, saturazione, differenziazione, coerenza brand),"brief":"1-2 frasi it","angle":"come sfruttarlo per il brand"}]}`;
  const usr = `Cambiamenti:\n${pending.map((p) => `#${p.id} [${p.changeType}] ${p.title ?? ""} ${p.oldValue ?? ""}${p.newValue ? "→" + p.newValue : ""}`).join("\n")}`;
  const out = await runResearchLLM(sys, usr);
  const parsed = extractJson<{ items: Array<{ id: number; score: number; brief?: string; angle?: string }> }>(out);
  if (!parsed?.items) return { enriched: 0 };
  return { enriched: await applyMarketEnrichment(parsed.items) };
}

export async function applyMarketEnrichment(items: Array<{ id: number; score: number; brief?: string; angle?: string }>): Promise<number> {
  let n = 0;
  for (const it of items) {
    if (typeof it.id !== "number") continue;
    await updateMarketChange(it.id, {
      score: Math.max(0, Math.min(10, Math.round(Number(it.score ?? 0)))),
      brief: sanitizeText(it.brief, 2000) ?? null, angle: sanitizeText(it.angle, 2000) ?? null,
      enrichedAt: new Date(),
    });
    n++;
  }
  return n;
}

export async function generateOpportunityBrief(userId: number, hours = 24): Promise<string> {
  const changes = await getMarketChanges(userId, { hours, limit: 200 });
  if (changes.length === 0) return "Nessun cambiamento rilevante nelle ultime " + hours + "h.";
  const news = changes.filter((c) => c.changeType === "NEW_PRODUCT");
  const price = changes.filter((c) => c.changeType === "PRICE_CHANGE");
  const stock = changes.filter((c) => c.changeType === "STOCK_OUT" || c.changeType === "RESTOCK");
  const top = changes.filter((c) => (c.score ?? 0) >= 7).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
  const line = (c: any) => `- [${c.score ?? "?"}] ${c.title ?? c.changeType}${c.angle ? " — " + c.angle : ""}`;
  return [
    `# Product Market FIT — brief ${new Date().toLocaleDateString("it-IT")}`,
    `${news.length} nuovi prodotti · ${price.length} variazioni prezzo · ${stock.length} eventi stock`,
    top.length ? `\n## Top opportunità\n${top.map(line).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}
```

Nota: verificare i nomi esatti esportati da `./research` (`runResearchLLM`, `extractJson`, `sanitizeText`, `DEFAULT_BRAND_CONTEXT`) — sono già usati da `researchService.ts` (righe 11-16 di quel file). Se `DEFAULT_BRAND_CONTEXT` non è esportato, usare `getResearchConfig(userId).brandContext`.

- [ ] **Step 4: Esegui il test del ciclo — deve passare** — Run: `pnpm exec vitest run server/marketIntelService.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add server/marketIntelService.ts server/marketIntelService.test.ts
git commit -m "feat(market): service ciclo monitoraggio + enrich + brief"
```

---

## Task 7: REST bridge `/api/market/*` per l'agente VPS

**Files:**
- Create: `server/_core/marketRoutes.ts`
- Modify: `server/_core/index.ts` (import + `registerMarketRoutes(app)`)

**Interfaces:**
- Consumes: `runAllStoresCycle`, `runStoreMonitorCycle`, `getMarketChanges`, `getUnenrichedMarketChanges`, `applyMarketEnrichment`, `getMarketConfig`, `updateMarketChange`, `listMarketStores`.

- [ ] **Step 1: Create `server/_core/marketRoutes.ts`** (modellato su `researchRoutes.ts`)

```ts
import type { Express, Request, Response } from "express";
import { getMarketChanges, getUnenrichedMarketChanges, updateMarketChange, listMarketStores } from "../db";
import { runAllStoresCycle, runStoreMonitorCycle, applyMarketEnrichment, getMarketConfig } from "../marketIntelService";

const OWNER_USER_ID = 1;
function checkSecret(req: Request, res: Response): boolean {
  const expected = process.env.CARE_WEBHOOK_SECRET;
  if (!expected) { res.status(503).json({ error: "CARE_WEBHOOK_SECRET not configured" }); return false; }
  if (req.headers["x-care-secret"] !== expected) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

export function registerMarketRoutes(app: Express) {
  app.get("/api/market/stores", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try { res.json({ success: true, stores: await listMarketStores(OWNER_USER_ID) }); }
    catch (e) { console.warn("[market/stores]", e); res.status(500).json({ error: "stores failed" }); }
  });

  app.post("/api/market/refresh", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try {
      const storeId = Number(req.body?.storeId);
      const r = storeId ? await runStoreMonitorCycle(OWNER_USER_ID, storeId) : await runAllStoresCycle(OWNER_USER_ID);
      res.json({ success: true, ...r });
    } catch (e) { console.warn("[market/refresh]", e); res.status(500).json({ error: "refresh failed" }); }
  });

  app.get("/api/market/changes", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try {
      const q = req.query; const num = (v: unknown, d: number) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : d; };
      const items = await getMarketChanges(OWNER_USER_ID, {
        storeId: q.store_id ? Number(q.store_id) : undefined, changeType: q.type ? String(q.type) : undefined,
        status: q.status ? String(q.status) : undefined, minScore: num(q.min_score, 0),
        hours: num(q.hours, 24), limit: Math.min(num(q.limit, 50), 300),
      });
      res.json({ success: true, count: items.length, items });
    } catch (e) { console.warn("[market/changes]", e); res.status(500).json({ error: "changes failed" }); }
  });

  app.get("/api/market/pending-enrich", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try {
      const { brandContext } = await getMarketConfig(OWNER_USER_ID);
      const pending = await getUnenrichedMarketChanges(OWNER_USER_ID, 15);
      res.json({ success: true, count: pending.length, brand_context: brandContext,
        items: pending.map((p) => ({ id: p.id, changeType: p.changeType, title: p.title, url: p.url, oldValue: p.oldValue, newValue: p.newValue, detail: p.detail })) });
    } catch (e) { console.warn("[market/pending-enrich]", e); res.status(500).json({ error: "pending-enrich failed" }); }
  });

  app.post("/api/market/enrichment", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try {
      const { items } = req.body ?? {};
      if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: "items[] required (id, score, brief, angle)" }); return; }
      res.json({ success: true, applied: await applyMarketEnrichment(items) });
    } catch (e) { console.warn("[market/enrichment]", e); res.status(500).json({ error: "enrichment failed" }); }
  });

  app.post("/api/market/status", async (req, res) => {
    if (!checkSecret(req, res)) return;
    try {
      const { id, status } = req.body ?? {};
      const valid = ["nuovo", "letto", "archiviato"];
      if (!id || !valid.includes(String(status))) { res.status(400).json({ error: `id + status (${valid.join("|")})` }); return; }
      await updateMarketChange(Number(id), { status: String(status) as any });
      res.json({ success: true });
    } catch (e) { console.warn("[market/status]", e); res.status(500).json({ error: "status failed" }); }
  });
}
```

- [ ] **Step 2: Registra in `server/_core/index.ts`** — import in cima (accanto agli altri `register*`):
```ts
import { registerMarketRoutes } from "./marketRoutes";
```
e nella `startServer()`, dopo `registerResearchRoutes(app);`:
```ts
  registerMarketRoutes(app);
```

- [ ] **Step 3: Typecheck** — Run: `pnpm exec tsc --noEmit` → ok.

- [ ] **Step 4: Commit**
```bash
git add server/_core/marketRoutes.ts server/_core/index.ts
git commit -m "feat(market): REST bridge /api/market/* per agente VPS"
```

---

## Task 8: router tRPC `marketIntel` (web app)

**Files:**
- Modify: `server/routers.ts` (import + nuovo router `marketIntel` dentro `appRouter`)

**Interfaces:**
- Consumes: db helpers (Task 5) + service (Task 6) + `normalizeDomain`/`isShopifyStore` (Task 2).

- [ ] **Step 1: Import** — nel blocco import di `server/routers.ts` aggiungere:
```ts
import {
  addMarketStore, removeMarketStore, listMarketStores, updateMarketStore, getMarketChanges, updateMarketChange,
} from "./db";
import {
  runAllStoresCycle, runStoreMonitorCycle, getMarketConfig, saveMarketConfig, generateOpportunityBrief,
} from "./marketIntelService";
import { normalizeDomain, isShopifyStore } from "./marketIntel";
```

- [ ] **Step 2: Aggiungere il router dentro `appRouter`** (dopo il router `watchlist` o `research`, prima della chiusura di `appRouter`):
```ts
  // ─── Market Intelligence: Product Market FIT (monitor competitor Shopify) ────
  marketIntel: router({
    listStores: protectedProcedure.query(async ({ ctx }) => listMarketStores(ctx.user.id)),
    addStore: protectedProcedure
      .input(z.object({ label: z.string().min(1), domain: z.string().min(3), frequencyHours: z.number().min(1).max(168).optional(), collections: z.array(z.string()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const domain = normalizeDomain(input.domain);
        const isShop = await isShopifyStore(domain);
        const id = await addMarketStore(ctx.user.id, {
          label: input.label, domain, frequencyHours: input.frequencyHours,
          collectionsFilter: input.collections?.length ? JSON.stringify(input.collections) : null, isShopify: isShop,
        });
        return { success: true, id, isShopify: isShop } as const;
      }),
    removeStore: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await removeMarketStore(ctx.user.id, input.id); return { success: true } as const;
    }),
    updateStore: protectedProcedure
      .input(z.object({ id: z.number(), label: z.string().optional(), frequencyHours: z.number().min(1).max(168).optional(), status: z.enum(["active","paused"]).optional() }))
      .mutation(async ({ input }) => {
        const patch: any = {};
        if (input.label !== undefined) patch.label = input.label;
        if (input.frequencyHours !== undefined) patch.frequencyHours = input.frequencyHours;
        if (input.status !== undefined) patch.status = input.status;
        await updateMarketStore(input.id, patch); return { success: true } as const;
      }),
    runNow: protectedProcedure.input(z.object({ id: z.number().optional() })).mutation(async ({ ctx, input }) => {
      const r = input.id ? await runStoreMonitorCycle(ctx.user.id, input.id) : await runAllStoresCycle(ctx.user.id);
      return { success: true, ...r } as const;
    }),
    listChanges: protectedProcedure
      .input(z.object({ storeId: z.number().optional(), changeType: z.string().optional(), status: z.string().optional(), minScore: z.number().optional(), hours: z.number().optional(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => getMarketChanges(ctx.user.id, input)),
    setChangeStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.enum(["nuovo","letto","archiviato"]) }))
      .mutation(async ({ input }) => { await updateMarketChange(input.id, { status: input.status }); return { success: true } as const; }),
    getConfig: protectedProcedure.query(async ({ ctx }) => getMarketConfig(ctx.user.id)),
    setConfig: protectedProcedure.input(z.object({ brandContext: z.string().optional(), autopilot: z.boolean().optional(), minScore: z.number().optional(), reviewRate: z.number().optional() }))
      .mutation(async ({ ctx, input }) => { await saveMarketConfig(ctx.user.id, input); return { success: true } as const; }),
    brief: protectedProcedure.input(z.object({ hours: z.number().optional() })).query(async ({ ctx, input }) => ({ brief: await generateOpportunityBrief(ctx.user.id, input.hours) })),
  }),
```

- [ ] **Step 3: Typecheck** — Run: `pnpm exec tsc --noEmit` → ok.

- [ ] **Step 4: Commit**
```bash
git add server/routers.ts
git commit -m "feat(market): router tRPC marketIntel (CRUD + changes + brief)"
```

---

## Task 9: Scheduler giornaliero

**Files:**
- Modify: `server/_core/scheduler.ts`

- [ ] **Step 1: Import** — in cima a `scheduler.ts` aggiungere:
```ts
import { runAllStoresCycle, enrichPendingMarketChanges } from "../marketIntelService";
```

- [ ] **Step 2: Aggiungere lo slot dentro `registerDailySchedules()`** (dopo lo `scheduleDaily(9, 0, "research-refresh", …)`):
```ts
  scheduleDaily(9, 15, "market-monitor", async () => {
    const r = await runAllStoresCycle(OWNER_USER_ID);
    console.log(`[Scheduler] market 09:15: stores=${r.stores} changes=${r.changes} errori=${r.errors.length}`);
    try { await enrichPendingMarketChanges(OWNER_USER_ID); } catch (e) { console.warn("[Scheduler] market enrich fallito:", e); }
  });
```

- [ ] **Step 3: Typecheck** — Run: `pnpm exec tsc --noEmit` → ok.

- [ ] **Step 4: Commit**
```bash
git add server/_core/scheduler.ts
git commit -m "feat(market): job giornaliero 09:15 monitor + enrich"
```

---

## Task 10: Pagina Product Market FIT + route + voce sidebar

**Files:**
- Create: `client/src/pages/ProductMarketFit.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `trpc.marketIntel.*` (Task 8).

- [ ] **Step 1: Create `client/src/pages/ProductMarketFit.tsx`**

Pagina modellata sullo stile di `client/src/pages/SeoResearch.tsx` (dark, shadcn). Scaffold funzionale completo:

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, string> = {
  NEW_PRODUCT: "Nuovo", PRICE_CHANGE: "Prezzo", STOCK_OUT: "Esaurito",
  RESTOCK: "Restock", REMOVED_PRODUCT: "Rimosso", COLLECTION_CHANGE: "Collezione",
};

export default function ProductMarketFit() {
  const utils = trpc.useUtils();
  const stores = trpc.marketIntel.listStores.useQuery();
  const changes = trpc.marketIntel.listChanges.useQuery({ hours: 168, limit: 200 });
  const brief = trpc.marketIntel.brief.useQuery({ hours: 168 });
  const addStore = trpc.marketIntel.addStore.useMutation({ onSuccess: () => { utils.marketIntel.listStores.invalidate(); } });
  const runNow = trpc.marketIntel.runNow.useMutation({ onSuccess: () => { utils.marketIntel.listChanges.invalidate(); utils.marketIntel.listStores.invalidate(); } });
  const removeStore = trpc.marketIntel.removeStore.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const [label, setLabel] = useState(""); const [domain, setDomain] = useState("");

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Brief opportunità */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.14 0.02 300)", border: "1px solid oklch(0.24 0.03 300)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.15 310)" }}>Brief opportunità (7gg)</h2>
          <Button size="sm" disabled={runNow.isPending} onClick={() => runNow.mutate({})}>
            {runNow.isPending ? "Scansione…" : "Aggiorna ora"}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{brief.data?.brief ?? "…"}</pre>
      </div>

      {/* Store competitor */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <h2 className="text-sm font-semibold mb-3">Store competitor</h2>
        <div className="flex gap-2 mb-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etichetta"
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 260)", border: "1px solid oklch(0.24 0.02 260)" }} />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="dominio-store.com"
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 260)", border: "1px solid oklch(0.24 0.02 260)" }} />
          <Button disabled={addStore.isPending || !domain} onClick={() => { addStore.mutate({ label: label || domain, domain }); setLabel(""); setDomain(""); }}>Aggiungi</Button>
        </div>
        <div className="space-y-1">
          {(stores.data ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.015 260)" }}>
              <span>{s.label} <span className="text-muted-foreground">· {s.domain}</span> {!s.isShopify && <Badge className="ml-2">non-Shopify</Badge>}</span>
              <span className="flex items-center gap-2">
                <Badge>{s.status}</Badge>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => runNow.mutate({ id: s.id })}>run</button>
                <button className="text-xs text-red-400 hover:text-red-300" onClick={() => removeStore.mutate({ id: s.id })}>×</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cambiamenti */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <h2 className="text-sm font-semibold mb-3">Cambiamenti rilevati</h2>
        <div className="space-y-1">
          {(changes.data ?? []).map((c: any) => (
            <a key={c.id} href={c.url ?? "#"} target="_blank" rel="noreferrer"
               className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" style={{ background: "oklch(0.15 0.015 260)" }}>
              <Badge>{TYPE_LABEL[c.changeType] ?? c.changeType}</Badge>
              {c.score != null && <Badge style={{ background: "oklch(0.6 0.2 300)" }}>{c.score}</Badge>}
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-muted-foreground text-xs">{c.oldValue}{c.newValue ? " → " + c.newValue : ""}</span>
            </a>
          ))}
          {changes.data?.length === 0 && <div className="text-xs text-muted-foreground">Nessun cambiamento. Aggiungi uno store e premi "Aggiorna ora".</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registra la route in `client/src/App.tsx`**

Aggiungere l'import (accanto agli altri page import): `import ProductMarketFit from "./pages/ProductMarketFit";`
Nel blocco `{/* PRINT ON DEMAND … */}` aggiungere PRIMA di `/gelato/maker`:
```tsx
      <Route path="/gelato/market-fit">{withLayout(ProductMarketFit)}</Route>
```

- [ ] **Step 3: Aggiungere la voce sidebar in `client/src/components/DashboardLayout.tsx`**

Nell'array `GELATO_ITEMS` (riga 33-36) prependere la voce, e importare l'icona `Radar` (già importata alla riga 12):
```ts
const GELATO_ITEMS = [
  { icon: Radar, label: "Product Market FIT", path: "/gelato/market-fit", description: "Monitor competitor & opportunità" },
  { icon: Package2, label: "Bulk Creator", path: "/gelato/maker", description: "Crea prodotti in massa" },
  { icon: Package, label: "POD Partners", path: "/gelato/pod-partners", description: "Fornitori & certificato" },
];
```

- [ ] **Step 4: Build client** — Run: `pnpm exec vite build` (o `pnpm build`)
Expected: build ok, nessun errore di import.

- [ ] **Step 5: Commit**
```bash
git add client/src/pages/ProductMarketFit.tsx client/src/App.tsx client/src/components/DashboardLayout.tsx
git commit -m "feat(market): pagina Product Market FIT + route + voce sidebar"
```

---

## Task 11: Skill agente VPS + subagent Claude Code

**Files:**
- Create: `references/skills/market-intelligence.md`
- Create: `.claude/agents/market-intelligence.md`

- [ ] **Step 1: Create `references/skills/market-intelligence.md`** (formato `seo-research.md`)

```markdown
# Skill agente VPS — Market Intelligence & Product Research Strategist

> Ottava figura del team. Legge il MERCATO: monitora store Shopify competitor e trasforma
> i cambiamenti in brief di opportunità azionabili nella pagina Product Market FIT.
> Motore AI primario = TU (Claude, costo zero); il server usa Gemini solo come fallback.

## API (auth: header `x-care-secret: $CARE_WEBHOOK_SECRET`, base `$SOCIAL_BASE_URL`)

| Endpoint | Uso |
|---|---|
| `GET /api/market/stores` | elenco store monitorati + stato |
| `POST /api/market/refresh` body `{storeId?}` | lancia il ciclo (uno store o tutti) |
| `GET /api/market/changes?hours=24&min_score=6&type=&status=&limit=50` | feed cambiamenti |
| `GET /api/market/pending-enrich` | `brand_context` + cambiamenti da valutare |
| `POST /api/market/enrichment` body `{items:[{id,score,brief,angle}]}` | riconsegna la valutazione |
| `POST /api/market/status` body `{id,status:nuovo\|letto\|archiviato}` | aggiorna stato |

## Le 8 competenze del ruolo (dal file mansioni) → cosa fai ogni ciclo
1. **Trend & demand**: incrocia i NEW_PRODUCT tra più store + il feed research (Trends): cosa sale.
2. **Competitive intel**: leggi i cambiamenti; nota chi lancia, chi taglia prezzi, chi va out-of-stock.
3. **Market gap**: product_type/fasce prezzo che pochi presidiano = whitespace.
4. **Product validation**: assegna `score` 0-10 a ogni NEW_PRODUCT (wow-factor, marginalità POD, saturazione, differenziazione, coerenza col brand).
5. **Data mastery**: incrocia le fonti, non fidarti di un solo segnale.
6. **Audience insight**: quando serve, aggancia i commenti Reddit dal Research Hub.
7. **Pricing & offer**: leggi la distribuzione prezzi tra competitor e i pattern di sconto (compare_at).
8. **Sintesi**: produci il brief, non l'elenco grezzo.

## ⚠️ Onestà sulle vendite (regola d'oro)
Le vendite assolute dei competitor POD **non sono misurabili pubblicamente**. Non inventare numeri.
Il server calcola `estMethod`/`estConfidence`: se è `rank`/`none`, parla di **domanda relativa** (rank
best-seller e suo trend), non di unità. Se è `inventory` (confidenza alta) o `reviews` (media), puoi citare la stima col suo margine.

## Task 0 — Enrichment Claude-first (ogni ciclo)
1. `GET /api/market/pending-enrich` → `brand_context` + `items[]`.
2. Per ogni item: `score` 0-10 (priorità come opportunità per QUESTO brand), `brief` (1-2 frasi it),
   `angle` (come sfruttarlo — prodotto/positioning; se è rumore, dillo).
3. `POST /api/market/enrichment` con `{items:[...]}`.

## Task 1 — Morning brief (schedulato, dopo il refresh 09:15)
1. `POST /api/market/refresh`  2. `GET /api/market/changes?hours=24&min_score=6&limit=10`
3. Rispondi in chat (`POST /api/social/reply`) coi 5 migliori: `[SCORE x] titolo — angle — url`.
```

- [ ] **Step 2: Create `.claude/agents/market-intelligence.md`** (subagent Claude Code portabile)

```markdown
---
name: market-intelligence
description: Market Intelligence & Product Research Strategist. Usa per ricerca prodotto, analisi competitor Shopify, gap di mercato, validazione prodotti vincenti, pricing intelligence e brief di opportunità. Legge dati PUBBLICI (products.json, best-selling, Meta Ad Library) senza tool a pagamento.
tools: Bash, Read, Write, WebSearch, WebFetch, Glob, Grep
---

Sei il Market Intelligence & Product Research Strategist di DreamBrothers. La tua unica missione:
decidere COSA vale la pena creare e PERCHÉ ORA, con rigore quantitativo, prima che esistano prodotti o annunci.

## Come reperisci i dati (solo pubblico, €0)
- **Catalogo competitor Shopify**: `GET https://<store>/products.json?limit=250&since_id=<id>` (prezzo, compare_at, available, published_at).
- **Ranking vendite reale**: `GET https://<store>/collections/all?sort_by=best-selling` (ordine = vendite cumulate).
- **Stock reale (se tracciato)**: `POST https://<store>/cart/add.js {items:[{id,quantity:99999}]}` → il 422 rivela il max; MA se i cap sono uniformi/tondi sono FALSI (POD): non usarli come vendite.
- **Ad spy**: Meta Ad Library pubblica (`/ads/library`) per keyword/paese.
- **Domanda**: Google Trends, Keyword Planner (proxy gratuiti).

## Regola d'oro — niente numeri inventati
Se le vendite assolute non sono misurabili (POD/stock non tracciato/no review app), dichiaralo e usa
la DOMANDA RELATIVA (rank best-seller + trend). Non spacciare stime per certezze.

## Output: brief di opportunità (le 8 competenze → una sintesi)
Trend & demand · competitive intel · market gap · product validation (score 0-10: wow, marginalità POD,
saturazione, differenziazione) · pricing/offer · audience insight · sintesi azionabile:
**cosa lanciare, con quale angolo, per chi, perché ora, con quale priorità.**

Quando lavori dentro il repo meta-ai-media-buyer, i dati e gli endpoint REST sono in
`references/skills/market-intelligence.md` e `server/marketIntel*.ts`.
```

- [ ] **Step 3: Commit**
```bash
git add references/skills/market-intelligence.md .claude/agents/market-intelligence.md
git commit -m "feat(market): skill agente VPS + subagent Claude Code (ruolo Market Intelligence)"
```

---

## Task 12: Seed dei 3 store + sezione legale README

**Files:**
- Modify: `server/_core/index.ts` (seed idempotente dopo le migrazioni)
- Modify: `README.md` (sezione legale)

- [ ] **Step 1: Seed idempotente** — in `server/_core/index.ts`, dopo il blocco `market_*` in `runMigrations()`, aggiungere:
```ts
  try {
    for (const s of [
      { label: "DotComCanvas", domain: "dotcomcanvas.de" },
      { label: "iKonick", domain: "ikonick.com" },
      { label: "Gernucci", domain: "gernucci.com" },
    ]) {
      await db.execute(sql`INSERT IGNORE INTO market_stores (userId, label, domain, platform, status, frequencyHours, isShopify, createdAt, updatedAt)
        VALUES (1, ${s.label}, ${s.domain}, 'shopify', 'pending', 24, TRUE, NOW(), NOW())`);
    }
    console.log("[Migrate] market_stores seed pronti");
  } catch (err) { console.warn("[Migrate] seed market non inserito:", err); }
```

- [ ] **Step 2: Sezione legale in `README.md`** — appendere:
```markdown
## Market Intelligence (Product Market FIT) — uso legale

Il monitor competitor usa SOLO dati pubblici (endpoint storefront Shopify `products.json`,
`collections.json`, ordinamento best-seller pubblico) con polling conservativo, User-Agent
onesto e rispetto di `robots.txt` e dei rate limit (429/430 → backoff). NON aggira login,
paywall o sistemi anti-bot e non raccoglie dati personali. Le stime di vendita sono etichettate
con metodo e confidenza; dove non misurabili, il tool lo dichiara invece di inventare numeri.
L'utente è responsabile della conformità ai Termini di Servizio di ogni store monitorato.
```

- [ ] **Step 3: Commit**
```bash
git add server/_core/index.ts README.md
git commit -m "feat(market): seed 3 store competitor + sezione legale README"
```

---

## Task 13: Smoke test end-to-end sui 3 store reali

**Files:** nessuno nuovo (verifica manuale + eventuale fix).

- [ ] **Step 1: Avviare in locale** — `pnpm dev` (o build+start). Assicurarsi che `DATABASE_URL` e `CARE_WEBHOOK_SECRET` siano nel `.env`.

- [ ] **Step 2: Trigger del ciclo** via REST:
```bash
curl -s -X POST "$SOCIAL_BASE_URL/api/market/refresh" -H "x-care-secret: $CARE_WEBHOOK_SECRET" -H "Content-Type: application/json" -d '{}'
```
Expected: JSON `{success:true, stores:3, changes:N, errors:[…]}` con `changes ≥ 0` e `errors` vuoto o solo warning.

- [ ] **Step 3: Verifica dati** :
```bash
curl -s "$SOCIAL_BASE_URL/api/market/changes?hours=999&limit=20" -H "x-care-secret: $CARE_WEBHOOK_SECRET"
```
Expected: elenco cambiamenti (al primo run tipicamente molti NEW_PRODUCT — è il baseline; ai run successivi solo i delta).

- [ ] **Step 4: Verifica UI** — aprire `/gelato/market-fit`: i 3 store compaiono, "Aggiorna ora" popola i cambiamenti, il brief mostra i conteggi.

- [ ] **Step 5: Verifica onestà stima** — su un prodotto dei 3 store (POD), `estMethod` deve essere `rank`/`none` e MAI un numero di unità inventato. (Controllo diretto in `market_products.estMethod`.)

- [ ] **Step 6: Full test suite** — Run: `pnpm exec vitest run` → tutti verdi. Commit di eventuali fix.

```bash
git add -A && git commit -m "test(market): smoke E2E sui 3 store reali + fix"
```

---

## Self-Review (svolto)

**Spec coverage:** §3 architettura → Task 1-10; §4 modello dati → Task 1,5; §5 raccolta+stima → Task 2,4; §5.4 motore onesto → Task 4; §6 versioning → Task 6; §7 interfacce → Task 7,8; §8 agente → Task 11; §9 pagina/notifiche → Task 10; §10 scheduler/legale/test → Task 9,12,13. Tutte coperte.

**Placeholder scan:** nessun "TBD/TODO"; ogni step ha codice reale o comando eseguibile.

**Type consistency:** `NormProduct`/`ChangeEvent`/`SalesEstimate` definiti in Task 2 e usati coerentemente in Task 3,4,6; firme db (Task 5) combaciano con service (Task 6), routes (Task 7), router (Task 8). `estMethod`/`estConfidence` coerenti tra schema (Task 1), motore (Task 4) e persistenza (Task 6).

**Nota di rischio:** i nomi esportati da `./research` (`runResearchLLM`, `extractJson`, `sanitizeText`, `DEFAULT_BRAND_CONTEXT`) vanno confermati aprendo `server/research.ts` al primo uso in Task 6 (già usati da `researchService.ts`); se `DEFAULT_BRAND_CONTEXT` non è esportato lì, usare `(await getResearchConfig(userId)).brandContext`.
