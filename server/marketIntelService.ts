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
  fetchShopifyCatalog, fetchBestSellerRanks, fetchShopifyReviewCounts, detectChanges,
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
  deps: { fetchCatalog?: typeof fetchShopifyCatalog; fetchRanks?: typeof fetchBestSellerRanks } = {},
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
    const prevRows = await getMarketProducts(storeId);
    const prev: NormProduct[] = prevRows
      .filter((p) => p.active !== false)
      .map((p) => ({
        productId: p.productId, handle: p.handle ?? "", title: p.title, productType: p.productType, vendor: p.vendor,
        tags: p.tags ?? "", url: p.url ?? "", imageUrl: p.imageUrl, minPrice: p.minPrice != null ? Number(p.minPrice) : null,
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null, currency: p.currency,
        available: !!p.available, totalVariants: p.totalVariants ?? 0, variantsAvailable: p.variantsAvailable ?? 0,
        variants: [], publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
      }));
    const events = detectChanges(storeId, prev, curr);
    // recensioni per-prodotto sui top best-seller (una recensione = almeno una vendita)
    const topHandles = Array.from(ranks.entries()).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([h]) => h);
    const reviewCounts = topHandles.length
      ? await fetchShopifyReviewCounts(store.domain, topHandles).catch(() => new Map<string, number>())
      : new Map<string, number>();
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
        reviewCount: reviewCounts.get(p.handle) ?? null,
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
  const stores = (await listMarketStores(userId)).filter((s) => s.status !== "paused");
  let changes = 0;
  const errors: string[] = [];
  for (const s of stores) {
    const r = await runStoreMonitorCycle(userId, s.id);
    changes += r.changes;
    errors.push(...r.errors.map((e) => `${s.label}: ${e}`));
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
  if (changes.length === 0) return `Nessun cambiamento rilevante nelle ultime ${hours}h.`;
  const news = changes.filter((c) => c.changeType === "NEW_PRODUCT");
  const price = changes.filter((c) => c.changeType === "PRICE_CHANGE");
  const stock = changes.filter((c) => c.changeType === "STOCK_OUT" || c.changeType === "RESTOCK");
  const top = changes.filter((c) => (c.score ?? 0) >= 7).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
  const line = (c: typeof changes[number]) => `- [${c.score ?? "?"}] ${c.title ?? c.changeType}${c.angle ? " — " + c.angle : ""}`;
  return [
    `# Product Market FIT — brief ${new Date().toLocaleDateString("it-IT")}`,
    `${news.length} nuovi prodotti · ${price.length} variazioni prezzo · ${stock.length} eventi stock`,
    top.length ? `\n## Top opportunità\n${top.map(line).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

export { OWNER_USER_ID };
