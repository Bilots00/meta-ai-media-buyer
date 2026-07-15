/**
 * Etsy Product Research — replica del metodo Everbee/Alura, ma nostro.
 *
 * Perché diverso da Shopify: Etsy BLOCCA lo scraping diretto server-side (403 anti-bot).
 * Everbee/Alura sono estensioni Chrome perché girano nel browser reale dell'utente.
 * Noi usiamo Firecrawl (proxy "stealth" = browser reale + IP residenziale) come trasporto:
 * bypassa l'anti-bot e restituisce JSON strutturato. Dati SOLO pubblici (pagine shop/ricerca).
 *
 * Onestà sulle vendite (stessa regola del monitor Shopify): niente numeri inventati.
 * - `reviewCount` e i badge Bestseller/Star Seller sono FATTI pubblici (segnale forte, hard).
 * - La stima vendite lifetime = reviewCount / reviewRate è una STIMA calibrabile, etichettata come tale.
 * - Il ranking primario usa i segnali hard (reviewCount + Bestseller), non la stima.
 */

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
  estLifetimeSales: number | null; // stima (reviewCount/reviewRate), etichettata
  opportunityScore: number;        // 0-100, da segnali hard
  url: string;
}

export interface EtsyShopStats {
  shopName: string;
  totalSales: number | null;       // FATTO pubblico (conteggio vendite dello shop)
  reviewCount: number | null;
  reviewAverage: number | null;
  onEtsySinceYear: number | null;
  avgMonthlySales: number | null;  // totalSales / mesi di attività (media storica)
}

/** "$68.60" -> {value:68.6,currency:"USD"}; "€12,00" -> {value:12,currency:"EUR"}. */
export function parsePrice(s: unknown): { value: number | null; currency: string } {
  const str = String(s ?? "").trim();
  if (!str) return { value: null, currency: "USD" };
  const currency = str.includes("€") ? "EUR" : str.includes("£") ? "GBP" : "USD";
  // rimuove simboli e separatori delle migliaia; gestisce virgola decimale EU
  let num = str.replace(/[^\d.,]/g, "");
  if (num.includes(",") && num.includes(".")) num = num.replace(/,/g, "");        // 1,234.56
  else if (num.includes(",") && !num.includes(".")) num = num.replace(",", "."); // 12,00
  const value = parseFloat(num);
  return { value: Number.isFinite(value) ? value : null, currency };
}

/** Stima vendite lifetime dai reviews: una frazione nota di acquirenti recensisce. */
export function estimateLifetimeSalesFromReviews(reviewCount: number, reviewRate = 0.10): number | null {
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return null;
  const rate = reviewRate > 0 ? reviewRate : 0.10;
  return Math.round(reviewCount / rate);
}

/** Punteggio opportunità 0-100 da segnali HARD (reviewCount, Bestseller, rating). Niente stime. */
export function scoreEtsyOpportunity(l: { reviewCount: number; isBestseller: boolean; isStarSeller: boolean; starRating: number | null }): number {
  const reviewScore = Math.min(1, Math.log10((l.reviewCount || 0) + 1) / Math.log10(50000)); // 50k rec ~ tetto
  const bestseller = l.isBestseller ? 1 : 0;
  const starSeller = l.isStarSeller ? 1 : 0;
  const ratingScore = l.starRating != null ? Math.max(0, Math.min(1, (l.starRating - 4) / 1)) : 0.5;
  const score = 0.55 * reviewScore + 0.22 * bestseller + 0.08 * starSeller + 0.15 * ratingScore;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

interface RawListing {
  listingId?: string | number; title?: string; price?: string; shopName?: string;
  reviewCount?: number; starRating?: number; isBestseller?: boolean; isStarSeller?: boolean;
}

export function normalizeEtsyListing(raw: RawListing, reviewRate = 0.10): EtsyListing {
  const reviewCount = Number(raw.reviewCount ?? 0) || 0;
  const { value, currency } = parsePrice(raw.price);
  const isBestseller = !!raw.isBestseller;
  const isStarSeller = !!raw.isStarSeller;
  const starRating = raw.starRating != null ? Number(raw.starRating) : null;
  const listingId = String(raw.listingId ?? "");
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
    estLifetimeSales: estimateLifetimeSalesFromReviews(reviewCount, reviewRate),
    opportunityScore: scoreEtsyOpportunity({ reviewCount, isBestseller, isStarSeller, starRating }),
    url: listingId ? `https://www.etsy.com/listing/${listingId}/` : "https://www.etsy.com",
  };
}

/** Normalizza + ordina per opportunità (segnali hard). */
export function rankEtsyListings(rawListings: RawListing[], reviewRate = 0.10): EtsyListing[] {
  return rawListings
    .map((r) => normalizeEtsyListing(r, reviewRate))
    .filter((l) => l.listingId || l.title)
    .sort((a, b) => b.opportunityScore - a.opportunityScore || b.reviewCount - a.reviewCount);
}

export function normalizeEtsyShop(raw: Record<string, unknown>): EtsyShopStats {
  const yr = Number(raw.onEtsySince ?? raw.onEtsySinceYear ?? 0);
  const onEtsySinceYear = yr > 1900 && yr < 2100 ? yr : null;
  const totalSales = raw.totalSales != null ? Number(raw.totalSales) : null;
  // mesi di attività dallo storico shop (approssimazione media, non mensile puntuale)
  const nowYear = 2026;
  const months = onEtsySinceYear ? Math.max(1, (nowYear - onEtsySinceYear) * 12) : null;
  const avgMonthlySales = totalSales != null && months ? Math.round(totalSales / months) : null;
  return {
    shopName: String(raw.shopName ?? ""),
    totalSales: totalSales != null && Number.isFinite(totalSales) ? totalSales : null,
    reviewCount: raw.reviewCount != null ? Number(raw.reviewCount) : null,
    reviewAverage: raw.reviewAverage != null ? Number(raw.reviewAverage) : null,
    onEtsySinceYear,
    avgMonthlySales,
  };
}

// ─── Trasporto: Firecrawl (stealth) — bypassa l'anti-bot di Etsy ──────────────
const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v2";

async function firecrawlScrapeJson(url: string, prompt: string, schema: unknown): Promise<any | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configurata (serve per lo scraping Etsy)");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["json"], proxy: "stealth", waitFor: 3500, jsonOptions: { prompt, schema } }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Firecrawl HTTP ${r.status}`);
    const body = await r.json();
    return body?.data?.json ?? null;
  } finally {
    clearTimeout(timer);
  }
}

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, price: { type: "string" }, shopName: { type: "string" },
          listingId: { type: "string" }, reviewCount: { type: "integer" }, starRating: { type: "number" },
          isBestseller: { type: "boolean" }, isStarSeller: { type: "boolean" },
        },
      },
    },
  },
};

const SHOP_SCHEMA = {
  type: "object",
  properties: {
    shopName: { type: "string" }, totalSales: { type: "integer" }, reviewCount: { type: "integer" },
    reviewAverage: { type: "number" }, onEtsySince: { type: "integer", description: "anno di apertura (4 cifre)" },
  },
};

/** Ricerca per keyword: i bestseller di una nicchia su Etsy, con stima e ranking. */
export async function researchEtsyKeyword(query: string, opts: { limit?: number; reviewRate?: number } = {}): Promise<{ query: string; listings: EtsyListing[] }> {
  const url = `https://www.etsy.com/search?q=${encodeURIComponent(query)}`;
  const json = await firecrawlScrapeJson(url, "Estrai i listing dalla pagina risultati di ricerca Etsy per ricerca prodotto competitiva.", SEARCH_SCHEMA);
  const raw: RawListing[] = Array.isArray(json?.listings) ? json.listings : [];
  const listings = rankEtsyListings(raw, opts.reviewRate).slice(0, opts.limit ?? 30);
  return { query, listings };
}

/** Analisi di uno shop competitor: vendite totali (fatto), reviews, media mensile storica. */
export async function analyzeEtsyShop(shopUrl: string): Promise<EtsyShopStats> {
  const url = shopUrl.startsWith("http") ? shopUrl : `https://www.etsy.com/shop/${shopUrl}`;
  const json = await firecrawlScrapeJson(url, "Estrai i dati di competitive-intelligence dello shop Etsy.", SHOP_SCHEMA);
  return normalizeEtsyShop(json ?? {});
}
