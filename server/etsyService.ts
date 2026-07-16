/**
 * Etsy watchlist service — l'AI agent monitora gli shop preferiti e ne estrae
 * i prodotti vincenti (metodo Alura, calibrato per-shop). Velocità vendite ESATTA
 * dal contatore pubblico; vendite per-prodotto stimate da review/reviewRate.
 */
import {
  addEtsyShop, removeEtsyShop, listEtsyShops, getEtsyShop, updateEtsyShop,
  insertEtsyShopSnapshot, getPrevEtsyShopSnapshot, upsertEtsyListing, getEtsyListingsByShop,
} from "./db";
import { analyzeEtsyShop, analyzeEtsyShopListings, computeEtsyVelocity, type EtsyVelocity } from "./etsyIntel";

function shopSlug(input: string): string {
  const m = String(input).match(/etsy\.com\/shop\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : String(input).trim().replace(/^@/, "").split("/")[0];
}

export async function addEtsyWatchShop(userId: number, input: string): Promise<{ id: number; shopName: string }> {
  const slug = shopSlug(input);
  const id = await addEtsyShop(userId, { shopName: slug, url: `https://www.etsy.com/shop/${slug}` });
  return { id, shopName: slug };
}

export async function removeEtsyWatchShop(userId: number, id: number): Promise<void> {
  await removeEtsyShop(userId, id);
}

export async function listEtsyWatchShops(userId: number) {
  return listEtsyShops(userId);
}

/** Refresh di uno shop: snapshot vendite (velocità esatta) + deep-analyze top prodotti. */
export async function refreshEtsyShop(userId: number, shopId: number, opts: { topN?: number } = {}): Promise<{ velocity: EtsyVelocity; listings: number; error?: string }> {
  const shop = await getEtsyShop(userId, shopId);
  if (!shop) return { velocity: emptyVelocity(), listings: 0, error: "shop non trovato" };
  try {
    const { shop: stats, listings } = await analyzeEtsyShopListings(shop.url || shop.shopName, { topN: opts.topN ?? 12 });
    const now = new Date();
    const prev = await getPrevEtsyShopSnapshot(shopId);
    const velocity = computeEtsyVelocity(
      prev ? { totalSales: prev.totalSales, reviewCount: prev.reviewCount, at: prev.capturedAt } : null,
      { totalSales: stats.totalSales, reviewCount: stats.reviewCount, at: now },
    );
    await insertEtsyShopSnapshot({ shopId, totalSales: stats.totalSales, reviewCount: stats.reviewCount, capturedAt: now });
    for (const l of listings) {
      await upsertEtsyListing({
        userId, shopId, listingId: l.listingId, title: l.title, url: l.url,
        price: l.price != null ? String(l.price) : null, currency: l.currency,
        reviewCount: l.reviewCount, favorites: l.favorites, inCarts: l.inCarts, isBestseller: l.isBestseller,
        estSales: l.estSales, estRevenue: l.estRevenue, opportunityScore: l.opportunityScore, capturedAt: now,
      });
    }
    await updateEtsyShop(shopId, {
      status: "active", lastError: null, shopName: stats.shopName || shop.shopName,
      lastTotalSales: stats.totalSales ?? undefined, lastReviewCount: stats.reviewCount ?? undefined,
      reviewRate: stats.reviewRate != null ? String(stats.reviewRate) : undefined,
      reviewAverage: stats.reviewAverage != null ? String(stats.reviewAverage) : undefined,
      onEtsySinceYear: stats.onEtsySinceYear ?? undefined, lastRefreshAt: now,
    });
    return { velocity, listings: listings.length };
  } catch (err) {
    const m = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : String(err);
    await updateEtsyShop(shopId, { status: "error", lastError: m, lastRefreshAt: new Date() });
    return { velocity: emptyVelocity(), listings: 0, error: m };
  }
}

export async function runAllEtsyShops(userId: number): Promise<{ shops: number; listings: number; errors: string[] }> {
  const shops = (await listEtsyShops(userId)).filter((s) => s.status !== "paused");
  let listings = 0; const errors: string[] = [];
  for (const s of shops) {
    const r = await refreshEtsyShop(userId, s.id);
    listings += r.listings;
    if (r.error) errors.push(`${s.shopName}: ${r.error}`);
  }
  return { shops: shops.length, listings, errors };
}

export async function getEtsyShopDetail(userId: number, shopId: number) {
  const shop = await getEtsyShop(userId, shopId);
  if (!shop) return null;
  const listings = await getEtsyListingsByShop(shopId);
  return { shop, listings };
}

/** Analisi live on-demand (senza salvare) per l'analizzatore stile Alura. */
export async function analyzeEtsyShopLive(shopInput: string, topN = 12) {
  return analyzeEtsyShopListings(shopInput, { topN });
}

export { analyzeEtsyShop };

function emptyVelocity(): EtsyVelocity {
  return { salesDelta: null, reviewsDelta: null, days: 0, dailySales: null, monthlySales: null };
}
