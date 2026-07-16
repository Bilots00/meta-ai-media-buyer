import { describe, it, expect } from "vitest";
import {
  parsePrice, computeReviewRate, estimateSalesCalibrated, estimateLifetimeSalesFromReviews,
  scoreEtsyOpportunity, normalizeEtsyListing, rankEtsyListings, normalizeEtsyShop, computeEtsyVelocity,
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

describe("computeReviewRate (calibrazione per-shop, metodo Alura)", () => {
  it("rate = reviews/sales, con clamp difensivo", () => {
    // BabylonPrints reale: 5015 review / 28040 vendite
    expect(computeReviewRate(5015, 28040)).toBeCloseTo(0.1788, 3);
    // BoundlessInkPrints: 675/7041 = 9.59% (= review rate mostrato da Alura)
    expect(computeReviewRate(675, 7041)).toBeCloseTo(0.0959, 3);
    expect(computeReviewRate(0, 100)).toBeNull();
    expect(computeReviewRate(100, 0)).toBeNull();
  });
});

describe("estimateSalesCalibrated — VALIDAZIONE vs Alura", () => {
  it("Peter Pan: 4 review / rate BabylonPrints ≈ 22 (Alura mostra 23)", () => {
    const rate = computeReviewRate(5015, 28040); // 0.1788
    const est = estimateSalesCalibrated(4, rate);
    expect(est).toBeGreaterThanOrEqual(21);
    expect(est).toBeLessThanOrEqual(24); // Alura: 23 → match entro 1 unità
  });
  it("null quando la rate è sconosciuta; 0 quando 0 review", () => {
    expect(estimateSalesCalibrated(4, null)).toBeNull();
    expect(estimateSalesCalibrated(0, 0.1)).toBe(0);
  });
});

describe("estimateLifetimeSalesFromReviews (fallback rate di default)", () => {
  it("lifetime = reviews / 0.10 di default", () => {
    expect(estimateLifetimeSalesFromReviews(100)).toBe(1000);
    expect(estimateLifetimeSalesFromReviews(0)).toBeNull();
  });
});

describe("scoreEtsyOpportunity", () => {
  it("bestseller ad alti reviews batte non-bestseller a bassi reviews", () => {
    const arena = scoreEtsyOpportunity({ reviewCount: 13700, isBestseller: true, isStarSeller: true, starRating: 4.9 });
    const comfort = scoreEtsyOpportunity({ reviewCount: 112, isBestseller: false, isStarSeller: false, starRating: 4.6 });
    expect(arena).toBeGreaterThan(comfort);
  });
});

describe("normalizeEtsyListing", () => {
  it("usa il metodo calibrato quando reviewRate è nota", () => {
    const rate = computeReviewRate(5015, 28040);
    const l = normalizeEtsyListing({ listingId: "4420367145", title: "Peter Pan", price: "$36.55", reviewCount: 4, favorites: 443, inCarts: 12 }, rate);
    expect(l.estMethod).toBe("calibrated");
    expect(l.estSales).toBeGreaterThanOrEqual(21);
    expect(l.estSales).toBeLessThanOrEqual(24);
    expect(l.estRevenue).toBe(Math.round((l.estSales ?? 0) * 36.55));
    expect(l.favorites).toBe(443);
    expect(l.inCarts).toBe(12);
    expect(l.url).toBe("https://www.etsy.com/listing/4420367145/");
  });
  it("senza reviewRate usa la rate di default (labeled)", () => {
    const l = normalizeEtsyListing({ listingId: "1", title: "x", price: "$10", reviewCount: 50 });
    expect(l.estMethod).toBe("default-rate");
    expect(l.estSales).toBe(500);
  });
});

describe("rankEtsyListings", () => {
  it("ordina per vendite stimate (desc)", () => {
    const ranked = rankEtsyListings([
      { listingId: "1", title: "Low", reviewCount: 112 },
      { listingId: "2", title: "Mid", reviewCount: 13700 },
      { listingId: "3", title: "High", reviewCount: 21100 },
    ]);
    expect(ranked[0].title).toBe("High");
    expect(ranked[ranked.length - 1].title).toBe("Low");
  });
});

describe("normalizeEtsyShop", () => {
  it("calcola reviewRate e media mensile", () => {
    const s = normalizeEtsyShop({ shopName: "BabylonPrints", totalSales: 28040, totalReviews: 5015, reviewAverage: 4.9, onEtsySince: 2023 });
    expect(s.totalSales).toBe(28040);
    expect(s.reviewCount).toBe(5015);
    expect(s.reviewRate).toBeCloseTo(0.1788, 3);
    expect(s.onEtsySinceYear).toBe(2023);
    expect(s.avgMonthlySales).toBe(Math.round(28040 / ((2026 - 2023) * 12)));
  });
});

describe("computeEtsyVelocity — vendite ESATTE dal contatore pubblico", () => {
  it("Δ vendite fra due snapshot → daily/monthly", () => {
    const v = computeEtsyVelocity(
      { totalSales: 28000, reviewCount: 5000, at: "2026-07-01T00:00:00Z" },
      { totalSales: 28300, reviewCount: 5050, at: "2026-07-11T00:00:00Z" },
    );
    expect(v.salesDelta).toBe(300);
    expect(v.reviewsDelta).toBe(50);
    expect(v.days).toBe(10);
    expect(v.dailySales).toBeCloseTo(30, 5);
    expect(v.monthlySales).toBe(900);
  });
  it("primo snapshot (nessun prev) → null senza rompere", () => {
    const v = computeEtsyVelocity(null, { totalSales: 100, reviewCount: 10, at: "2026-07-11T00:00:00Z" });
    expect(v.salesDelta).toBeNull();
  });
});
