import { describe, it, expect } from "vitest";
import {
  parsePrice, estimateLifetimeSalesFromReviews, scoreEtsyOpportunity,
  normalizeEtsyListing, rankEtsyListings, normalizeEtsyShop,
} from "./etsyIntel";

describe("parsePrice", () => {
  it("parses USD/EUR/GBP and separators", () => {
    expect(parsePrice("$68.60")).toEqual({ value: 68.6, currency: "USD" });
    expect(parsePrice("€12,00")).toEqual({ value: 12, currency: "EUR" });
    expect(parsePrice("$1,234.56")).toEqual({ value: 1234.56, currency: "USD" });
    expect(parsePrice("£5.19")).toEqual({ value: 5.19, currency: "GBP" });
    expect(parsePrice("")).toEqual({ value: null, currency: "USD" });
  });
});

describe("estimateLifetimeSalesFromReviews", () => {
  it("lifetime = reviews / reviewRate, rounded; null se 0", () => {
    expect(estimateLifetimeSalesFromReviews(13700, 0.10)).toBe(137000);
    expect(estimateLifetimeSalesFromReviews(100, 0.05)).toBe(2000);
    expect(estimateLifetimeSalesFromReviews(0)).toBeNull();
    expect(estimateLifetimeSalesFromReviews(50)).toBe(500); // default 0.10
  });
});

describe("scoreEtsyOpportunity", () => {
  it("bestseller ad alti reviews batte non-bestseller a bassi reviews", () => {
    const arena = scoreEtsyOpportunity({ reviewCount: 13700, isBestseller: true, isStarSeller: true, starRating: 4.9 });
    const comfort = scoreEtsyOpportunity({ reviewCount: 112, isBestseller: false, isStarSeller: false, starRating: 4.6 });
    expect(arena).toBeGreaterThan(comfort);
    expect(arena).toBeGreaterThan(0);
    expect(arena).toBeLessThanOrEqual(100);
  });
});

describe("normalizeEtsyListing", () => {
  it("mappa raw -> tipizzato con stima, score e url", () => {
    const l = normalizeEtsyListing({ listingId: "1789111308", title: "Man in the Arena", price: "$68.60", shopName: "WanderingHeartSigns", reviewCount: 13700, starRating: 4.9, isBestseller: true, isStarSeller: true });
    expect(l.listingId).toBe("1789111308");
    expect(l.price).toBe(68.6);
    expect(l.estLifetimeSales).toBe(137000);
    expect(l.url).toBe("https://www.etsy.com/listing/1789111308/");
    expect(l.opportunityScore).toBeGreaterThan(50);
  });
});

describe("rankEtsyListings", () => {
  it("ordina per opportunità: il bestseller ad alti reviews va in cima", () => {
    const ranked = rankEtsyListings([
      { listingId: "1", title: "Comfort Zone", price: "$5.19", reviewCount: 112, starRating: 4.6, isBestseller: false, isStarSeller: false },
      { listingId: "2", title: "Man in the Arena", price: "$68.60", reviewCount: 13700, starRating: 4.9, isBestseller: true, isStarSeller: true },
      { listingId: "3", title: "Affirmations", price: "$19.00", reviewCount: 21100, starRating: 5, isBestseller: true, isStarSeller: false },
    ]);
    expect(ranked[0].reviewCount).toBeGreaterThanOrEqual(13700); // un bestseller ad alti reviews
    expect(ranked[ranked.length - 1].title).toBe("Comfort Zone");
  });
});

describe("normalizeEtsyShop", () => {
  it("calcola media mensile storica da totalSales e anno di apertura", () => {
    const s = normalizeEtsyShop({ shopName: "ModParty", totalSales: 2100000, reviewCount: 285149, reviewAverage: 4.9, onEtsySince: 2013 });
    expect(s.totalSales).toBe(2100000);
    expect(s.onEtsySinceYear).toBe(2013);
    expect(s.avgMonthlySales).toBe(Math.round(2100000 / ((2026 - 2013) * 12)));
  });
  it("gestisce anno mancante/invalido senza rompere", () => {
    const s = normalizeEtsyShop({ shopName: "X", totalSales: 1000, onEtsySince: 12 });
    expect(s.onEtsySinceYear).toBeNull();
    expect(s.avgMonthlySales).toBeNull();
  });
});
