/**
 * Market Intelligence — fetch/parse/diff/estimate PURI per store Shopify.
 * Solo dati pubblici (products.json, collections, best-selling, cart-probe).
 * Nessun accesso al DB qui: tutto testabile con fixture.
 */

// ─── Tipi ─────────────────────────────────────────────────────────────────────
export type ChangeType =
  | "NEW_PRODUCT" | "PRICE_CHANGE" | "STOCK_OUT" | "RESTOCK" | "REMOVED_PRODUCT" | "COLLECTION_CHANGE";

export interface NormVariant { variantId: string; price: number; compareAtPrice: number | null; available: boolean; }

export interface NormProduct {
  productId: string; handle: string; title: string; productType: string | null; vendor: string | null;
  tags: string; url: string; imageUrl: string | null; minPrice: number | null; compareAtPrice: number | null;
  currency: string | null; available: boolean; totalVariants: number; variantsAvailable: number;
  variants: NormVariant[]; publishedAt: Date | null;
}

export interface ChangeEvent {
  storeId: number; productId?: string; changeType: ChangeType;
  title?: string; url?: string; oldValue?: string; newValue?: string; detail?: string;
}

export type EstMethod = "inventory" | "reviews" | "rank" | "none";
export type EstConfidence = "high" | "medium" | "low" | "none";
export interface SalesEstimate { units: number | null; method: EstMethod; confidence: EstConfidence; rationale: string; }

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];
function pickUA(seed = 0): string { return USER_AGENTS[seed % USER_AGENTS.length]; }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

// ─── Normalizzazione catalogo ─────────────────────────────────────────────────
export function normalizeShopifyProduct(raw: any, storeDomain: string): NormProduct {
  const variants: NormVariant[] = Array.isArray(raw?.variants) ? raw.variants.map((v: any) => ({
    variantId: String(v.id),
    price: toNum(v.price) ?? 0,
    compareAtPrice: toNum(v.compare_at_price),
    available: !!v.available,
  })) : [];
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
    currency: null,
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

// ─── Diff engine ──────────────────────────────────────────────────────────────
export function detectChanges(storeId: number, prev: NormProduct[], curr: NormProduct[]): ChangeEvent[] {
  const prevById = new Map(prev.map((p) => [p.productId, p]));
  const currById = new Map(curr.map((p) => [p.productId, p]));
  const events: ChangeEvent[] = [];
  for (const p of curr) {
    const before = prevById.get(p.productId);
    if (!before) {
      events.push({
        storeId, productId: p.productId, changeType: "NEW_PRODUCT", title: p.title, url: p.url,
        newValue: p.minPrice != null ? String(p.minPrice) : undefined, detail: p.productType ?? undefined,
      });
      continue;
    }
    if (before.minPrice != null && p.minPrice != null && before.minPrice !== p.minPrice) {
      events.push({
        storeId, productId: p.productId, changeType: "PRICE_CHANGE", title: p.title, url: p.url,
        oldValue: String(before.minPrice), newValue: String(p.minPrice),
        detail: p.minPrice < before.minPrice ? "ribasso" : "rialzo",
      });
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

// ─── Motore stima vendite (onesto per design) ─────────────────────────────────
/** I cap di /cart/add.js sono fasulli se tutti uguali (placeholder/max-per-ordine), non stock reale. */
export function looksFakeStockCap(values: number[]): boolean {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return true; // troppo pochi dati per fidarsi
  const uniq = new Set(v);
  if (uniq.size === 1) return true; // tutti identici -> placeholder
  const round = v.filter((n) => n % 10 === 0).length;
  return round / v.length >= 0.8 && uniq.size <= 2;
}

export interface EstimateInput {
  trueStockPrev?: number; trueStockNow?: number; hoursElapsed?: number;
  reviewPrev?: number; reviewNow?: number; reviewRate?: number;
  bestSellerRank?: number; allStockValues?: number[];
}

export function estimateSales(input: EstimateInput): SalesEstimate {
  const stockReal = input.allStockValues?.length ? !looksFakeStockCap(input.allStockValues) : false;
  // TIER A — inventory decrement (solo se stock reale e cala)
  if (stockReal && typeof input.trueStockPrev === "number" && typeof input.trueStockNow === "number") {
    const delta = input.trueStockPrev - input.trueStockNow;
    if (delta >= 0) {
      return {
        units: delta, method: "inventory", confidence: "high",
        rationale: `Inventario reale ${input.trueStockPrev}→${input.trueStockNow} in ${input.hoursElapsed ?? "?"}h = ${delta} unità vendute.`,
      };
    }
    // delta<0 = restock: non stimabile da questo ciclo, cade ai tier sotto
  }
  // TIER B — review velocity
  const rate = input.reviewRate && input.reviewRate > 0 ? input.reviewRate : 0.03;
  if (typeof input.reviewPrev === "number" && typeof input.reviewNow === "number") {
    const dRev = input.reviewNow - input.reviewPrev;
    if (dRev > 0) {
      return {
        units: Math.round(dRev / rate), method: "reviews", confidence: "medium",
        rationale: `+${dRev} recensioni; review-rate stimato ${(rate * 100).toFixed(0)}% → ~${Math.round(dRev / rate)} ordini.`,
      };
    }
  }
  // TIER C — best-seller rank (relativo, niente unità assolute)
  if (typeof input.bestSellerRank === "number") {
    return {
      units: null, method: "rank", confidence: "low",
      rationale: `Vendite assolute non misurabili pubblicamente (POD/stock non tracciato). Rank best-seller #${input.bestSellerRank} = domanda relativa reale.`,
    };
  }
  return {
    units: null, method: "none", confidence: "none",
    rationale: "Nessun segnale pubblico di vendita disponibile per questo prodotto.",
  };
}

// ─── Rete (integration-tested dal ciclo reale, non nei test unitari) ──────────
export async function politeFetch(
  url: string,
  opts: { seed?: number; timeoutMs?: number; method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "User-Agent": pickUA(opts.seed),
        "Accept": "application/json,text/html;q=0.9",
        "Accept-Language": "en,it;q=0.8",
        ...(opts.headers ?? {}),
      },
      body: opts.body,
      signal: ctrl.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function isShopifyStore(domain: string): Promise<boolean> {
  const d = normalizeDomain(domain);
  try {
    const r = await politeFetch(`https://${d}/products.json?limit=1`, { timeoutMs: 10000 });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j?.products);
  } catch {
    return false;
  }
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
      page--;
      continue;
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

/** Cart-probe: max quantita' acquistabile per variante (per rilevare stock reale vs cap fasullo). */
export async function probeTrueStock(domain: string, variantIds: string[]): Promise<Map<string, number | null>> {
  const d = normalizeDomain(domain);
  const out = new Map<string, number | null>();
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
      } else {
        out.set(vid, null);
      }
    } catch {
      out.set(vid, null);
    }
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
    const re = /\/products\/([a-z0-9\-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (!seen.includes(m[1])) seen.push(m[1]);
    }
    seen.forEach((handle, i) => ranks.set(handle, i + 1));
  } catch {
    // best-effort
  }
  return ranks;
}
