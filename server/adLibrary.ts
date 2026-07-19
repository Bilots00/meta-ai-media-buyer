/**
 * Ad Library scanner — metodo Kalodata / PiPiads / Minea / Winning Hunter + GLITCH Scanner.
 * Meta Ad Library + TikTok Creative Center via Firecrawl (pagine JS-heavy → proxy anti-bot).
 * Solo dati pubblici. L'estrazione delle ad library è best-effort: se la pagina non rende
 * dati strutturati, restituiamo poco e lo DICHIARIAMO (niente numeri inventati).
 */
import { isShopifyStore, normalizeDomain } from "./marketIntel";

const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v2";

async function firecrawlJson(url: string, prompt: string, schema: unknown, waitFor = 6000): Promise<any | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configurata sul server (Railway → Variables).");
  const proxy = process.env.FIRECRAWL_PROXY || "auto";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: [{ type: "json", prompt, schema }], proxy, waitFor }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) {
      let detail: unknown = text.slice(0, 400);
      try { const j = JSON.parse(text); detail = j.error || j.details || j.message || detail; } catch { /* keep */ }
      throw new Error(`Firecrawl HTTP ${r.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    }
    return JSON.parse(text)?.data?.json ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export interface AdAdvertiser {
  advertiser: string;
  pageUrl: string | null;
  destinationUrl: string | null;
  domain: string | null;
  isShopify: boolean;
  adCount: number;      // n. di ad viste per questo advertiser (proxy di budget/scaling)
  sampleCaption: string | null;
}

const META_SCHEMA = {
  type: "object",
  properties: {
    ads: {
      type: "array",
      items: {
        type: "object",
        properties: {
          advertiser: { type: "string", description: "advertiser / Facebook page name" },
          pageUrl: { type: "string", description: "link to the advertiser page if present" },
          destinationUrl: { type: "string", description: "the website/landing link the ad points to (CTA link)" },
          caption: { type: "string", description: "primary text of the ad" },
        },
      },
    },
  },
};

const COUNTRY: Record<string, string> = { IT: "IT", US: "US", UK: "GB", GB: "GB", DE: "DE", FR: "FR", ES: "ES", ALL: "ALL" };

/** GLITCH Scanner core: cerca la Meta Ad Library per keyword+paese, raggruppa per advertiser,
 *  filtra chi ha ≥ minAds ad attive e (opz.) solo chi punta a uno store Shopify. */
export async function scanMetaAdLibrary(opts: { keyword: string; country?: string; minAds?: number; shopifyOnly?: boolean }): Promise<{ advertisers: AdAdvertiser[]; note: string }> {
  const cc = COUNTRY[(opts.country || "ALL").toUpperCase()] || "ALL";
  const minAds = opts.minAds ?? 1;
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${cc}&q=${encodeURIComponent(opts.keyword)}&search_type=keyword_unordered&media_type=all`;
  const json = await firecrawlJson(url, "This is Meta (Facebook) Ad Library search results. Extract every ad card you can see: the advertiser / page name, the advertiser page link, the destination/CTA website link the ad points to, and the ad primary text.", META_SCHEMA);
  const raw: Array<{ advertiser?: string; pageUrl?: string; destinationUrl?: string; caption?: string }> = Array.isArray(json?.ads) ? json.ads : [];
  // raggruppa per advertiser
  const byAdv = new Map<string, AdAdvertiser>();
  for (const a of raw) {
    const name = String(a.advertiser ?? "").trim();
    if (!name) continue;
    const dest = a.destinationUrl ? String(a.destinationUrl) : null;
    const domain = dest ? safeDomain(dest) : null;
    const cur = byAdv.get(name);
    if (cur) {
      cur.adCount++;
      if (!cur.destinationUrl && dest) { cur.destinationUrl = dest; cur.domain = domain; }
      if (!cur.sampleCaption && a.caption) cur.sampleCaption = String(a.caption).slice(0, 200);
    } else {
      byAdv.set(name, {
        advertiser: name, pageUrl: a.pageUrl ? String(a.pageUrl) : null,
        destinationUrl: dest, domain, isShopify: false, adCount: 1,
        sampleCaption: a.caption ? String(a.caption).slice(0, 200) : null,
      });
    }
  }
  let advertisers = Array.from(byAdv.values()).filter((a) => a.adCount >= minAds).sort((a, b) => b.adCount - a.adCount).slice(0, 30);
  // step GLITCH: verifica quali domini sono Shopify (limita a 12 check per costo/tempo)
  const toCheck = advertisers.filter((a) => a.domain).slice(0, 12);
  await Promise.all(toCheck.map(async (a) => { a.isShopify = a.domain ? await isShopifyStore(a.domain).catch(() => false) : false; }));
  if (opts.shopifyOnly) advertisers = advertisers.filter((a) => a.isShopify);
  const note = raw.length === 0
    ? "Meta Ad Library non ha reso dati strutturati per questa query (pagina JS/anti-bot). Prova un'altra keyword o riprova; se persiste serve tarare il proxy Firecrawl (enhanced)."
    : `${raw.length} ad estratte, ${advertisers.length} advertiser (≥${minAds} ad). I link a store Shopify sono marcati.`;
  return { advertisers, note };
}

function safeDomain(u: string): string | null {
  try {
    const withProto = /^https?:\/\//.test(u) ? u : `https://${u}`;
    return normalizeDomain(new URL(withProto).hostname);
  } catch { return normalizeDomain(u) || null; }
}

// ─── TikTok Creative Center — top products/ads (best-effort) ──────────────────
export interface TikTokAd { title: string; brand: string | null; likes: number | null; views: number | null; ctr: number | null; url: string | null; }

const TT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, brand: { type: "string" }, likes: { type: "integer" },
          views: { type: "integer" }, ctr: { type: "number" }, url: { type: "string" },
        },
      },
    },
  },
};

export async function scanTikTokTopAds(opts: { keyword?: string; region?: string } = {}): Promise<{ items: TikTokAd[]; note: string }> {
  const region = (opts.region || "IT").toUpperCase();
  const url = `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?region=${region}${opts.keyword ? `&keyword=${encodeURIComponent(opts.keyword)}` : ""}`;
  const json = await firecrawlJson(url, "TikTok Creative Center Top Ads. Extract each top ad card: title/product, brand name, likes, views, CTR, and the link.", TT_SCHEMA, 8000);
  const raw: any[] = Array.isArray(json?.items) ? json.items : [];
  const items: TikTokAd[] = raw.map((x) => ({
    title: String(x.title ?? "").slice(0, 200), brand: x.brand ? String(x.brand) : null,
    likes: x.likes != null ? Number(x.likes) : null, views: x.views != null ? Number(x.views) : null,
    ctr: x.ctr != null ? Number(x.ctr) : null, url: x.url ? String(x.url) : null,
  })).filter((x) => x.title).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 30);
  const note = raw.length === 0
    ? "TikTok Creative Center non ha reso dati strutturati (spesso richiede regione/login). Best-effort: riprova o cambia regione."
    : `${items.length} top ad TikTok estratte.`;
  return { items, note };
}
