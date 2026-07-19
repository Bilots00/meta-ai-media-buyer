/**
 * Ad Library scanner — metodo Kalodata / PiPiads / Minea / Winning Hunter + GLITCH Scanner.
 * Meta Ad Library + TikTok Creative Center via Firecrawl (pagine JS-heavy → proxy anti-bot).
 * Solo dati pubblici. Estrazione best-effort: se la pagina non rende dati, lo DICIAMO.
 *
 * REGOLA UX: mai nascondere i risultati trovati. `minAds` è una SOGLIA DI EVIDENZA
 * (passesThreshold), non un filtro che cancella — l'utente vede sempre tutto con i link.
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
  adCount: number;
  passesThreshold: boolean;      // ≥ minAds (evidenza, non filtro)
  adLibraryUrl: string;          // link diretto alla Ad Library per questo advertiser
  imageUrl: string | null;
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
          advertiser: { type: "string", description: "advertiser / Facebook page name shown on the ad card" },
          activeAdsCount: { type: "integer", description: "if the card shows something like 'N ads use this creative' or the page's number of active ads, extract it" },
          pageUrl: { type: "string", description: "link to the advertiser Facebook page if present" },
          destinationUrl: { type: "string", description: "the website/landing link the ad points to (CTA link)" },
          imageUrl: { type: "string", description: "the ad creative image/thumbnail URL if visible" },
          caption: { type: "string", description: "primary text of the ad" },
        },
      },
    },
  },
};

const COUNTRY: Record<string, string> = { IT: "IT", US: "US", UK: "GB", GB: "GB", DE: "DE", FR: "FR", ES: "ES", ALL: "ALL" };

function adLibrarySearchUrl(q: string, cc: string): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${cc}&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=all`;
}

/** Scanner Meta Ad Library: raggruppa per advertiser. Restituisce SEMPRE tutti gli advertiser
 *  trovati (ordinati per adCount); `passesThreshold` marca chi supera minAds. */
export async function scanMetaAdLibrary(opts: { keyword: string; country?: string; minAds?: number; shopifyOnly?: boolean }): Promise<{ advertisers: AdAdvertiser[]; totalAds: number; note: string }> {
  const cc = COUNTRY[(opts.country || "ALL").toUpperCase()] || "ALL";
  const minAds = opts.minAds ?? 3;
  const url = adLibrarySearchUrl(opts.keyword, cc);
  let raw: Array<{ advertiser?: string; activeAdsCount?: number; pageUrl?: string; destinationUrl?: string; imageUrl?: string; caption?: string }> = [];
  let scrapeNote = "";
  try {
    const json = await firecrawlJson(url, "This is Meta (Facebook) Ad Library search results. Extract every ad card: advertiser/page name, the number of active ads if shown, advertiser page link, destination/CTA website link, ad creative image URL, and primary text.", META_SCHEMA, 8000);
    raw = Array.isArray(json?.ads) ? json.ads : [];
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ERR_ABORTED|ERR_|HTTP 5\d\d|timeout/i.test(m)) scrapeNote = `La Ad Library non si è caricata al primo colpo (${m.slice(0, 120)}). Riprova: spesso il secondo tentativo passa.`;
    else throw err;
  }
  const byAdv = new Map<string, AdAdvertiser>();
  for (const a of raw) {
    const name = String(a.advertiser ?? "").trim();
    if (!name) continue;
    const dest = a.destinationUrl ? String(a.destinationUrl) : null;
    const domain = dest ? safeDomain(dest) : null;
    const declared = a.activeAdsCount != null ? Number(a.activeAdsCount) : 0;
    const cur = byAdv.get(name);
    if (cur) {
      cur.adCount = Math.max(cur.adCount + 1, declared);
      if (!cur.destinationUrl && dest) { cur.destinationUrl = dest; cur.domain = domain; }
      if (!cur.imageUrl && a.imageUrl) cur.imageUrl = String(a.imageUrl);
      if (!cur.sampleCaption && a.caption) cur.sampleCaption = String(a.caption).slice(0, 200);
    } else {
      byAdv.set(name, {
        advertiser: name,
        pageUrl: a.pageUrl ? String(a.pageUrl) : null,
        destinationUrl: dest, domain, isShopify: false,
        adCount: Math.max(1, declared),
        passesThreshold: false,
        adLibraryUrl: adLibrarySearchUrl(name, cc),
        imageUrl: a.imageUrl ? String(a.imageUrl) : null,
        sampleCaption: a.caption ? String(a.caption).slice(0, 200) : null,
      });
    }
  }
  let advertisers = Array.from(byAdv.values()).sort((a, b) => b.adCount - a.adCount).slice(0, 30);
  advertisers.forEach((a) => { a.passesThreshold = a.adCount >= minAds; });
  const toCheck = advertisers.filter((a) => a.domain).slice(0, 12);
  await Promise.all(toCheck.map(async (a) => { a.isShopify = a.domain ? await isShopifyStore(a.domain).catch(() => false) : false; }));
  if (opts.shopifyOnly) advertisers = advertisers.filter((a) => a.isShopify);
  const above = advertisers.filter((a) => a.passesThreshold).length;
  const note = scrapeNote || (raw.length === 0
    ? "La Ad Library non ha reso dati strutturati per questa query (pagina JS/anti-bot). Riprova o cambia keyword; con FIRECRAWL_PROXY=enhanced l'estrazione è più affidabile."
    : `${raw.length} ad estratte · ${advertisers.length} advertiser trovati · ${above} sopra soglia (≥${minAds} ads, evidenziati). Ogni riga ha il link alla Ad Library.`);
  return { advertisers, totalAds: raw.length, note };
}

function safeDomain(u: string): string | null {
  try {
    const withProto = /^https?:\/\//.test(u) ? u : `https://${u}`;
    return normalizeDomain(new URL(withProto).hostname);
  } catch { return normalizeDomain(u) || null; }
}

// ─── TikTok Creative Center — top products/ads (best-effort) ──────────────────
export interface TikTokAd { title: string; brand: string | null; likes: number | null; views: number | null; ctr: number | null; url: string | null; imageUrl: string | null; }

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
          imageUrl: { type: "string", description: "video thumbnail/cover image URL" },
        },
      },
    },
  },
};

export async function scanTikTokTopAds(opts: { keyword?: string; region?: string } = {}): Promise<{ items: TikTokAd[]; note: string }> {
  const region = (opts.region || "IT").toUpperCase();
  const url = `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?region=${region}${opts.keyword ? `&keyword=${encodeURIComponent(opts.keyword)}` : ""}`;
  let raw: any[] = [];
  let scrapeNote = "";
  try {
    const json = await firecrawlJson(url, "TikTok Creative Center Top Ads. Extract each top ad card: title/product, brand name, likes, views, CTR, thumbnail image URL, and the link.", TT_SCHEMA, 9000);
    raw = Array.isArray(json?.items) ? json.items : [];
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ERR_ABORTED|ERR_|HTTP 5\d\d|timeout/i.test(m)) {
      scrapeNote = "TikTok Creative Center ha rifiutato il caricamento (ERR_ABORTED: capita spesso, il loro anti-bot è aggressivo). Riprova 1-2 volte o cambia regione — non è un errore tuo.";
    } else throw err;
  }
  const items: TikTokAd[] = raw.map((x) => ({
    title: String(x.title ?? "").slice(0, 200), brand: x.brand ? String(x.brand) : null,
    likes: x.likes != null ? Number(x.likes) : null, views: x.views != null ? Number(x.views) : null,
    ctr: x.ctr != null ? Number(x.ctr) : null, url: x.url ? String(x.url) : null,
    imageUrl: x.imageUrl ? String(x.imageUrl) : null,
  })).filter((x) => x.title).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 30);
  const note = scrapeNote || (raw.length === 0
    ? "TikTok Creative Center non ha reso dati strutturati. Riprova o cambia regione (best-effort)."
    : `${items.length} top ad TikTok estratte.`);
  return { items, note };
}
