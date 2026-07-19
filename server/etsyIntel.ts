/**
 * Etsy Product Research — replica del metodo Alura/Everbee, VALIDATO.
 *
 * Trasporto: Etsy blocca lo scraping diretto (403). Everbee/Alura sono estensioni Chrome
 * perché girano nel browser reale. Noi usiamo Firecrawl (proxy anti-bot) come trasporto.
 *
 * METODO VENDITE (validato dal vivo 2026-07-16 vs Alura, match <1 unità):
 *   review_rate(shop) = shop_total_reviews / shop_total_sales      (entrambi PUBBLICI = esatti)
 *   est_sales(listing) = listing_review_count / review_rate(shop)
 *   Esempio: BabylonPrints rate = 5015/28040 = 17.88% → Peter Pan 4 review / 0.1788 = 22 (Alura: 23).
 *   Proof indipendente: BoundlessInkPrints 675 review / 7041 vendite = 9.59% = review rate mostrato da Alura.
 * Velocità vendite shop = Δ(contatore vendite pubblico) nel tempo = ESATTA (non stimata).
 */

// ─── Tipi ─────────────────────────────────────────────────────────────────────
export interface EtsyListing {
  listingId: string;
  title: string;
  price: number | null;
  currency: string;
  shopName: string | null;
  reviewCount: number;
  starRating: number | null;
  isBestseller: boolean;
  isStarSeller: boolean;
  favorites: number | null;
  inCarts: number | null;
  imageUrl: string | null;
  estSales: number | null;      // stima calibrata = reviewCount / reviewRate
  estRevenue: number | null;    // estSales * price
  estMethod: "calibrated" | "default-rate" | "none";
  opportunityScore: number;
  url: string;
}

export interface EtsyShopStats {
  shopName: string;
  totalSales: number | null;    // PUBBLICO / esatto
  reviewCount: number | null;   // PUBBLICO / esatto
  reviewAverage: number | null;
  onEtsySinceYear: number | null;
  reviewRate: number | null;    // reviewCount / totalSales (calibrazione per-shop)
  avgMonthlySales: number | null;
}

export interface EtsyVelocity {
  salesDelta: number | null;    // vendite ESATTE nel periodo (Δ contatore pubblico)
  reviewsDelta: number | null;
  days: number;
  dailySales: number | null;
  monthlySales: number | null;
}

// ─── Utility di parsing/stima (PURE, testate) ─────────────────────────────────
export function parsePrice(s: unknown): { value: number | null; currency: string } {
  const str = String(s ?? "").trim();
  if (!str) return { value: null, currency: "USD" };
  const currency = str.includes("€") ? "EUR" : str.includes("£") ? "GBP" : "USD";
  let num = str.replace(/[^\d.,]/g, "");
  if (num.includes(",") && num.includes(".")) num = num.replace(/,/g, "");
  else if (num.includes(",") && !num.includes(".")) num = num.replace(",", ".");
  const value = parseFloat(num);
  return { value: Number.isFinite(value) ? value : null, currency };
}

/** Calibrazione per-shop: quota di acquirenti che lascia recensione. Clamp difensivo. */
export function computeReviewRate(totalReviews: number | null | undefined, totalSales: number | null | undefined): number | null {
  const r = Number(totalReviews), s = Number(totalSales);
  if (!Number.isFinite(r) || !Number.isFinite(s) || s <= 0 || r <= 0) return null;
  const rate = r / s;
  if (rate <= 0) return null;
  return Math.min(0.9, Math.max(0.01, rate)); // rate plausibili 1%..90%
}

/** Stima vendite calibrata: metodo Alura. reviewRate deve venire dallo shop stesso. */
export function estimateSalesCalibrated(reviewCount: number, reviewRate: number | null): number | null {
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return reviewCount === 0 ? 0 : null;
  if (!reviewRate || reviewRate <= 0) return null;
  return Math.round(reviewCount / reviewRate);
}

/** Fallback quando non conosciamo la review rate dello shop (ricerca cross-shop). */
export function estimateLifetimeSalesFromReviews(reviewCount: number, reviewRate = 0.10): number | null {
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return null;
  const rate = reviewRate > 0 ? reviewRate : 0.10;
  return Math.round(reviewCount / rate);
}

export function scoreEtsyOpportunity(l: { reviewCount: number; isBestseller: boolean; isStarSeller: boolean; starRating: number | null }): number {
  const reviewScore = Math.min(1, Math.log10((l.reviewCount || 0) + 1) / Math.log10(50000));
  const bestseller = l.isBestseller ? 1 : 0;
  const starSeller = l.isStarSeller ? 1 : 0;
  const ratingScore = l.starRating != null ? Math.max(0, Math.min(1, (l.starRating - 4) / 1)) : 0.5;
  const score = 0.55 * reviewScore + 0.22 * bestseller + 0.08 * starSeller + 0.15 * ratingScore;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

interface RawListing {
  listingId?: string | number; title?: string; price?: string; shopName?: string;
  reviewCount?: number; starRating?: number; isBestseller?: boolean; isStarSeller?: boolean;
  favorites?: number; inCarts?: number; imageUrl?: string;
}

/** Normalizza un listing. Se reviewRate è nota (shop analizzato) usa il metodo calibrato. */
export function normalizeEtsyListing(raw: RawListing, reviewRate: number | null = null): EtsyListing {
  const reviewCount = Number(raw.reviewCount ?? 0) || 0;
  const { value, currency } = parsePrice(raw.price);
  const isBestseller = !!raw.isBestseller;
  const isStarSeller = !!raw.isStarSeller;
  const starRating = raw.starRating != null ? Number(raw.starRating) : null;
  const listingId = String(raw.listingId ?? "");
  const calibrated = reviewRate ? estimateSalesCalibrated(reviewCount, reviewRate) : null;
  const estSales = calibrated != null ? calibrated : estimateLifetimeSalesFromReviews(reviewCount);
  const estMethod: EtsyListing["estMethod"] = reviewRate ? "calibrated" : (estSales != null ? "default-rate" : "none");
  return {
    listingId,
    title: String(raw.title ?? "").slice(0, 400),
    price: value,
    currency,
    shopName: raw.shopName ? String(raw.shopName) : null,
    reviewCount,
    starRating,
    isBestseller,
    isStarSeller,
    favorites: raw.favorites != null ? Number(raw.favorites) : null,
    inCarts: raw.inCarts != null ? Number(raw.inCarts) : null,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : null,
    estSales,
    estRevenue: estSales != null && value != null ? Math.round(estSales * value) : null,
    estMethod,
    opportunityScore: scoreEtsyOpportunity({ reviewCount, isBestseller, isStarSeller, starRating }),
    url: listingId ? `https://www.etsy.com/listing/${listingId}/` : "https://www.etsy.com",
  };
}

export function rankEtsyListings(rawListings: RawListing[], reviewRate: number | null = null): EtsyListing[] {
  return rawListings
    .map((r) => normalizeEtsyListing(r, reviewRate))
    .filter((l) => l.listingId || l.title)
    .sort((a, b) => (b.estSales ?? -1) - (a.estSales ?? -1) || b.reviewCount - a.reviewCount);
}

export function normalizeEtsyShop(raw: Record<string, unknown>): EtsyShopStats {
  const yr = Number(raw.onEtsySince ?? raw.onEtsySinceYear ?? 0);
  const onEtsySinceYear = yr > 1900 && yr < 2100 ? yr : null;
  const totalSales = raw.totalSales != null ? Number(raw.totalSales) : null;
  const reviewCount = (raw.reviewCount ?? raw.totalReviews) != null ? Number(raw.reviewCount ?? raw.totalReviews) : null;
  const reviewRate = computeReviewRate(reviewCount, totalSales);
  const nowYear = 2026;
  const months = onEtsySinceYear ? Math.max(1, (nowYear - onEtsySinceYear) * 12) : null;
  const avgMonthlySales = totalSales != null && months ? Math.round(totalSales / months) : null;
  return {
    shopName: String(raw.shopName ?? ""),
    totalSales: totalSales != null && Number.isFinite(totalSales) ? totalSales : null,
    reviewCount: reviewCount != null && Number.isFinite(reviewCount) ? reviewCount : null,
    reviewAverage: raw.reviewAverage != null ? Number(raw.reviewAverage) : null,
    onEtsySinceYear,
    reviewRate,
    avgMonthlySales,
  };
}

/** Velocità vendite ESATTA fra due snapshot del contatore pubblico. */
export function computeEtsyVelocity(prev: { totalSales: number | null; reviewCount: number | null; at: Date | string } | null, curr: { totalSales: number | null; reviewCount: number | null; at: Date | string }): EtsyVelocity {
  if (!prev || prev.totalSales == null || curr.totalSales == null) {
    return { salesDelta: null, reviewsDelta: null, days: 0, dailySales: null, monthlySales: null };
  }
  const ms = new Date(curr.at).getTime() - new Date(prev.at).getTime();
  const days = Math.max(ms / 86400000, 0);
  const salesDelta = Math.max(0, curr.totalSales - prev.totalSales);
  const reviewsDelta = prev.reviewCount != null && curr.reviewCount != null ? Math.max(0, curr.reviewCount - prev.reviewCount) : null;
  const dailySales = days > 0 ? salesDelta / days : null;
  return { salesDelta, reviewsDelta, days: Math.round(days * 10) / 10, dailySales, monthlySales: dailySales != null ? Math.round(dailySales * 30) : null };
}

// ─── Trasporto: Firecrawl v2 (formato corretto: formats:[{type:"json",...}]) ──
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v2";

async function firecrawlScrapeJson(url: string, prompt: string, schema: unknown): Promise<any | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configurata sul server (Railway → Variables).");
  const proxy = process.env.FIRECRAWL_PROXY || "auto"; // basic|enhanced|auto (v2); Etsy richiede enhanced/auto
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: [{ type: "json", prompt, schema }], proxy, waitFor: 4000 }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) {
      let detail: unknown = text.slice(0, 400);
      try { const j = JSON.parse(text); detail = j.error || j.details || j.message || detail; } catch { /* keep text */ }
      throw new Error(`Firecrawl HTTP ${r.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    }
    return JSON.parse(text)?.data?.json ?? null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

// ─── Schemi estrazione ────────────────────────────────────────────────────────
const SHOP_SCHEMA = { type: "object", properties: {
  shopName: { type: "string" }, totalSales: { type: "integer", description: "big 'X Sales' number" },
  totalReviews: { type: "integer", description: "count next to shop stars" }, reviewAverage: { type: "number" },
  onEtsySince: { type: "integer", description: "opening year, 4 digits" },
} };
const SHOP_GRID_SCHEMA = { type: "object", properties: { listings: { type: "array", items: { type: "object", properties: {
  title: { type: "string" }, price: { type: "string" }, listingId: { type: "string" }, isBestseller: { type: "boolean" },
  imageUrl: { type: "string", description: "product thumbnail image URL" },
} } } } };
const LISTING_SCHEMA = { type: "object", properties: {
  title: { type: "string" }, price: { type: "string" }, shopName: { type: "string" },
  itemReviewCount: { type: "integer", description: "reviews for THIS item only" },
  favorites: { type: "integer" }, inCarts: { type: "integer" }, isBestseller: { type: "boolean" },
  imageUrl: { type: "string", description: "main product image URL" },
} };
const SEARCH_SCHEMA = { type: "object", properties: { listings: { type: "array", items: { type: "object", properties: {
  title: { type: "string" }, price: { type: "string" }, shopName: { type: "string" }, listingId: { type: "string" },
  reviewCount: { type: "integer" }, starRating: { type: "number" }, isBestseller: { type: "boolean" }, isStarSeller: { type: "boolean" },
  imageUrl: { type: "string", description: "product thumbnail image URL" },
} } } } };

function shopUrlFrom(input: string): { url: string; slug: string } {
  const s = String(input).trim();
  const m = s.match(/etsy\.com\/shop\/([A-Za-z0-9_-]+)/i);
  const slug = m ? m[1] : s.replace(/^@/, "").split("/")[0];
  return { url: `https://www.etsy.com/shop/${slug}`, slug };
}

// ─── API di alto livello ──────────────────────────────────────────────────────
export async function analyzeEtsyShop(shopInput: string): Promise<EtsyShopStats> {
  const { url } = shopUrlFrom(shopInput);
  const json = await firecrawlScrapeJson(url, "Etsy shop page. Extract shop total sales count, total review count, review average, and opening year.", SHOP_SCHEMA);
  return normalizeEtsyShop(json ?? {});
}

/** Analisi accurata di un singolo listing (metodo Alura per-prodotto). */
export async function analyzeEtsyListing(listingUrl: string, reviewRate: number | null = null): Promise<EtsyListing> {
  const json = await firecrawlScrapeJson(listingUrl, "Single Etsy listing page. Extract this item's own review count (next to the ITEM star rating, not the shop total), price, shop name, favorites, 'in X carts', bestseller badge, and main product image URL.", LISTING_SCHEMA);
  const idm = listingUrl.match(/\/listing\/(\d+)/);
  return normalizeEtsyListing({
    listingId: idm ? idm[1] : "", title: json?.title, price: json?.price, shopName: json?.shopName,
    reviewCount: json?.itemReviewCount, favorites: json?.favorites, inCarts: json?.inCarts, isBestseller: json?.isBestseller,
    imageUrl: json?.imageUrl,
  }, reviewRate);
}

/**
 * Analizzatore shop stile Alura: stats shop (rate calibrata) + i top-N listing con
 * vendite per-prodotto (deep-scrape delle singole pagine listing = review count accurato).
 * La griglia viene letta su 2 pagine (~48 item) per una copertura più ampia.
 */
export async function analyzeEtsyShopListings(shopInput: string, opts: { topN?: number } = {}): Promise<{ shop: EtsyShopStats; listings: EtsyListing[] }> {
  const { url, slug } = shopUrlFrom(shopInput);
  const topN = Math.min(opts.topN ?? 18, 30);
  // 1) stats shop (rate)
  const shopJson = await firecrawlScrapeJson(url, "Etsy shop page. Extract total sales, total reviews, review average, opening year.", SHOP_SCHEMA);
  const shop = normalizeEtsyShop(shopJson ?? {});
  // 2) griglia items su 2 pagine → id + titoli + thumbnail (i card non espongono review count)
  const gridPrompt = "Etsy shop items grid. For each product card extract title, price, listingId from the /listing/<id>/ link, bestseller badge, and thumbnail image URL. Return every item visible.";
  const [g1, g2] = await Promise.all([
    firecrawlScrapeJson(url, gridPrompt, SHOP_GRID_SCHEMA).catch(() => null),
    firecrawlScrapeJson(`${url}?page=2`, gridPrompt, SHOP_GRID_SCHEMA).catch(() => null),
  ]);
  const grid: RawListing[] = [...(Array.isArray(g1?.listings) ? g1.listings : []), ...(Array.isArray(g2?.listings) ? g2.listings : [])];
  const seen = new Set<string>();
  const uniqueGrid = grid.filter((g) => { const id = String(g.listingId ?? ""); return id && !seen.has(id) && seen.add(id); });
  const imgById = new Map(uniqueGrid.map((g) => [String(g.listingId), g.imageUrl ? String(g.imageUrl) : null]));
  const ids = uniqueGrid.map((g) => String(g.listingId)).slice(0, topN);
  // 3) deep-scrape dei singoli listing per il review count reale → vendite calibrate
  const listings = (await mapLimit(ids, 3, async (id) => {
    try {
      const l = await analyzeEtsyListing(`https://www.etsy.com/listing/${id}/`, shop.reviewRate);
      if (!l.imageUrl && imgById.get(id)) l.imageUrl = imgById.get(id)!;
      return l;
    } catch { return null; }
  })).filter((l): l is EtsyListing => !!l);
  listings.sort((a, b) => (b.estSales ?? -1) - (a.estSales ?? -1));
  return { shop: { ...shop, shopName: shop.shopName || slug }, listings };
}

/** Ricerca per keyword (cross-shop): bestseller di una nicchia. Rate default (non calibrabile per-shop). */
export async function researchEtsyKeyword(query: string, opts: { limit?: number } = {}): Promise<{ query: string; listings: EtsyListing[] }> {
  const url = `https://www.etsy.com/search?q=${encodeURIComponent(query)}`;
  const json = await firecrawlScrapeJson(url, "Etsy search results page. Extract each listing: title, price, shopName, listingId, reviewCount, starRating, bestseller and star-seller badges, and thumbnail image URL.", SEARCH_SCHEMA);
  const raw: RawListing[] = Array.isArray(json?.listings) ? json.listings : [];
  const listings = rankEtsyListings(raw, null).slice(0, opts.limit ?? 30);
  return { query, listings };
}
