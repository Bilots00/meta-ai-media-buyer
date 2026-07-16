import { describe, it, expect } from "vitest";
import {
  normalizeDomain, parseCatalog, normalizeShopifyProduct,
  detectChanges, looksFakeStockCap, estimateSales,
  type NormProduct,
} from "./marketIntel";

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
  it("computes minPrice/compare from cheapest variant, availability, counts", () => {
    const p = normalizeShopifyProduct(RAW, "brand.com");
    expect(p.productId).toBe("123");
    expect(p.minPrice).toBe(24.99);          // cheapest variant
    expect(p.compareAtPrice).toBeNull();      // cheapest variant's compare is null
    expect(p.available).toBe(true);           // at least one variant available
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

const P = (id: string, over: Partial<NormProduct> = {}): NormProduct => ({
  productId: id, handle: "h" + id, title: "T" + id, productType: null, vendor: null, tags: "",
  url: "https://x/products/h" + id, imageUrl: null, minPrice: 10, compareAtPrice: null, currency: null,
  available: true, totalVariants: 1, variantsAvailable: 1, variants: [], publishedAt: null, ...over,
});

describe("detectChanges", () => {
  it("NEW_PRODUCT when a new id appears", () => {
    const c = detectChanges(7, [P("1")], [P("1"), P("2", { title: "Nuovo" })]);
    expect(c.filter((e) => e.changeType === "NEW_PRODUCT").map((e) => e.productId)).toEqual(["2"]);
  });
  it("REMOVED_PRODUCT when an id disappears", () => {
    const c = detectChanges(7, [P("1"), P("2")], [P("1")]);
    expect(c.filter((e) => e.changeType === "REMOVED_PRODUCT").map((e) => e.productId)).toEqual(["2"]);
  });
  it("PRICE_CHANGE when minPrice changes", () => {
    const c = detectChanges(7, [P("1", { minPrice: 10 })], [P("1", { minPrice: 8 })]);
    const e = c.find((x) => x.changeType === "PRICE_CHANGE");
    expect(e?.oldValue).toBe("10"); expect(e?.newValue).toBe("8"); expect(e?.detail).toBe("ribasso");
  });
  it("STOCK_OUT and RESTOCK on availability flip", () => {
    const out = detectChanges(7, [P("1", { available: true })], [P("1", { available: false })]);
    expect(out.some((e) => e.changeType === "STOCK_OUT")).toBe(true);
    const back = detectChanges(7, [P("1", { available: false })], [P("1", { available: true })]);
    expect(back.some((e) => e.changeType === "RESTOCK")).toBe(true);
  });
  it("no events when nothing changes", () => {
    expect(detectChanges(7, [P("1")], [P("1")])).toEqual([]);
  });
});

describe("looksFakeStockCap", () => {
  it("true when all caps identical (placeholder)", () => {
    expect(looksFakeStockCap([10, 10, 10, 10])).toBe(true);   // ikonick
    expect(looksFakeStockCap([50, 50, 50])).toBe(true);        // gernucci
    expect(looksFakeStockCap([1000, 1000])).toBe(true);        // dotcomcanvas
  });
  it("false when values vary (real inventory)", () => {
    expect(looksFakeStockCap([47, 3, 112, 8])).toBe(false);
  });
});

describe("estimateSales — picks the honest tier, never fabricates", () => {
  it("Tier A: real declining inventory -> exact units, high confidence", () => {
    const e = estimateSales({ trueStockPrev: 50, trueStockNow: 44, hoursElapsed: 24, allStockValues: [47, 3, 112], reviewRate: 0.03 });
    expect(e.method).toBe("inventory"); expect(e.units).toBe(6); expect(e.confidence).toBe("high");
  });
  it("Tier A skipped when caps are fake (uniform) -> fallback", () => {
    const e = estimateSales({ trueStockPrev: 50, trueStockNow: 44, hoursElapsed: 24, allStockValues: [50, 50, 50], bestSellerRank: 4, reviewRate: 0.03 });
    expect(e.method).not.toBe("inventory");
  });
  it("Tier B: review velocity -> estimated orders, medium", () => {
    const e = estimateSales({ reviewPrev: 100, reviewNow: 106, hoursElapsed: 24 * 7, reviewRate: 0.03, allStockValues: [10, 10] });
    expect(e.method).toBe("reviews"); expect(e.units).toBe(Math.round(6 / 0.03)); expect(e.confidence).toBe("medium");
  });
  it("Tier C: rank only -> units null, low, honest rationale", () => {
    const e = estimateSales({ bestSellerRank: 4, allStockValues: [50, 50], reviewRate: 0.03 });
    expect(e.method).toBe("rank"); expect(e.units).toBeNull(); expect(e.confidence).toBe("low");
  });
  it("no signal -> none, units null", () => {
    const e = estimateSales({ allStockValues: [50, 50], reviewRate: 0.03 });
    expect(e.method).toBe("none"); expect(e.units).toBeNull();
  });
});
