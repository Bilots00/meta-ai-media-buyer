import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormProduct } from "./marketIntel";

// Mock del layer DB (hoisted per vi.mock) — il ciclo si verifica senza database reale.
const dbMock = vi.hoisted(() => ({
  getMarketStore: vi.fn(),
  getMarketProducts: vi.fn(),
  upsertMarketProduct: vi.fn(),
  insertMarketSnapshot: vi.fn(),
  insertMarketChanges: vi.fn(),
  markMarketProductsInactive: vi.fn(),
  updateMarketStore: vi.fn(),
  listMarketStores: vi.fn(),
  getUnenrichedMarketChanges: vi.fn(),
  updateMarketChange: vi.fn(),
  getMarketChanges: vi.fn(),
  getAllUserSettings: vi.fn(),
  upsertUserSetting: vi.fn(),
}));
vi.mock("./db", () => dbMock);

import { runStoreMonitorCycle } from "./marketIntelService";

const P = (id: string, over: Partial<NormProduct> = {}): NormProduct => ({
  productId: id, handle: "h" + id, title: "T" + id, productType: null, vendor: null, tags: "",
  url: "https://x/products/h" + id, imageUrl: null, minPrice: 10, compareAtPrice: null, currency: null,
  available: true, totalVariants: 1, variantsAvailable: 1, variants: [], publishedAt: null, ...over,
});

beforeEach(() => {
  for (const fn of Object.values(dbMock)) (fn as any).mockReset?.();
  dbMock.upsertMarketProduct.mockResolvedValue(undefined);
  dbMock.insertMarketSnapshot.mockResolvedValue(undefined);
  dbMock.insertMarketChanges.mockResolvedValue(undefined);
  dbMock.markMarketProductsInactive.mockResolvedValue(undefined);
  dbMock.updateMarketStore.mockResolvedValue(undefined);
});

describe("runStoreMonitorCycle", () => {
  it("rileva un NEW_PRODUCT e lo scrive in market_changes", async () => {
    dbMock.getMarketStore.mockResolvedValue({ id: 5, userId: 1, domain: "x.com", label: "X", status: "active", collectionsFilter: null });
    dbMock.getMarketProducts.mockResolvedValue([{ productId: "1", minPrice: "10", available: true, active: true, title: "T1" }]);

    const r = await runStoreMonitorCycle(1, 5, {
      fetchCatalog: async () => [P("1"), P("2")],
      fetchRanks: async () => new Map([["h1", 1], ["h2", 2]]),
    });

    expect(r.changes).toBe(1);
    expect(dbMock.insertMarketChanges).toHaveBeenCalledTimes(1);
    const written = dbMock.insertMarketChanges.mock.calls[0][0] as any[];
    expect(written.some((c) => c.changeType === "NEW_PRODUCT" && c.productId === "2")).toBe(true);
    expect(dbMock.updateMarketStore).toHaveBeenCalledWith(5, expect.objectContaining({ status: "active", productCount: 2 }));
  });

  it("nessun cambiamento se il catalogo è identico", async () => {
    dbMock.getMarketStore.mockResolvedValue({ id: 5, userId: 1, domain: "x.com", label: "X", status: "active", collectionsFilter: null });
    dbMock.getMarketProducts.mockResolvedValue([{ productId: "1", minPrice: "10", available: true, active: true, title: "T1" }]);
    const r = await runStoreMonitorCycle(1, 5, { fetchCatalog: async () => [P("1")], fetchRanks: async () => new Map() });
    expect(r.changes).toBe(0);
    expect(dbMock.insertMarketChanges).not.toHaveBeenCalled();
  });

  it("store inesistente -> errore controllato", async () => {
    dbMock.getMarketStore.mockResolvedValue(undefined);
    const r = await runStoreMonitorCycle(1, 999, { fetchCatalog: async () => [], fetchRanks: async () => new Map() });
    expect(r.changes).toBe(0);
    expect(r.errors[0]).toMatch(/non trovato/);
  });
});
