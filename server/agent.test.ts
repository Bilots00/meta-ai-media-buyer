/**
 * Tests for META AI Media Buyer Agent
 * Covers: auth, campaigns, goals, alerts, copy generation, agent logs
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getMetaAccountsByUserId: vi.fn().mockResolvedValue([]),
  getCampaignsByUserId: vi.fn().mockResolvedValue([]),
  getGoalsByUserId: vi.fn().mockResolvedValue([]),
  getGoalById: vi.fn().mockResolvedValue(null),
  createGoal: vi.fn().mockResolvedValue(undefined),
  updateGoal: vi.fn().mockResolvedValue(undefined),
  getAlertsByUserId: vi.fn().mockResolvedValue([]),
  markAlertRead: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
  getCopyGenerationsByUserId: vi.fn().mockResolvedValue([]),
  insertCopyGeneration: vi.fn().mockResolvedValue({ insertId: 1 }),
  getAgentLogsByUserId: vi.fn().mockResolvedValue([]),
  insertAgentLog: vi.fn().mockResolvedValue(undefined),
  getKpiSnapshotsByUserId: vi.fn().mockResolvedValue([]),
  getAdSetsByCampaignId: vi.fn().mockResolvedValue([]),
  getAbTestsByUserId: vi.fn().mockResolvedValue([]),
  getTrackingConfigByAccount: vi.fn().mockResolvedValue(null),
}));

vi.mock("./metaApi", () => ({
  getMetaCampaigns: vi.fn().mockResolvedValue([]),
  getCampaignInsights: vi.fn().mockResolvedValue([]),
  getAdInsights: vi.fn().mockResolvedValue([]),
  parseInsightKpis: vi.fn().mockReturnValue({ spend: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0, reach: 0, frequency: 0, ctr: 0, cpc: 0, cpm: 0, cpa: 0, cpl: 0, roas: 0, conversionRate: 0, revenue: 0 }),
  getPixels: vi.fn().mockResolvedValue([]),
}));

vi.mock("./aiAgent", () => ({
  runAccountAudit: vi.fn().mockResolvedValue("## Audit Report\n\nAnalisi completata con successo."),
  generateAdCopy: vi.fn().mockResolvedValue({
    headlines: ["Titolo 1", "Titolo 2", "Titolo 3"],
    primaryTexts: ["Testo primario 1", "Testo primario 2", "Testo primario 3"],
    descriptions: ["Desc 1", "Desc 2", "Desc 3"],
  }),
  runOptimizationCycle: vi.fn().mockResolvedValue(undefined),
  triggerAlert: vi.fn().mockResolvedValue(undefined),
  evaluateAbTest: vi.fn().mockResolvedValue({ winner: "A", confidence: 97, reasoning: "Variante A superiore" }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Test context factory ─────────────────────────────────────────────────────
function makeCtx(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-open-id",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const user = await caller.auth.me();
    expect(user).toMatchObject({ id: 42, email: "test@example.com" });
  });

  it("returns null for unauthenticated context", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
describe("campaigns.list", () => {
  it("returns empty list when no campaigns exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.campaigns.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ─── Goals ────────────────────────────────────────────────────────────────────
describe("goals.list", () => {
  it("returns empty list when no goals exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.goals.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("goals.create", () => {
  it("creates a goal successfully", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.goals.create({
      metaAccountId: 1,
      title: "1000 Iscritti Webinar",
      description: "Obiettivo: 1000 iscritti al webinar di giugno",
      goalType: "leads",
      targetValue: 1000,
      targetUnit: "iscritti",
      budgetMax: 2000,
      campaignId: undefined,
    });
    expect(result).toEqual({ success: true });
  });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────
describe("alerts.list", () => {
  it("returns empty list when no alerts exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.alerts.list({ onlyUnread: false });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("alerts.markRead", () => {
  it("marks an alert as read", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.alerts.markRead({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("alerts.resolve", () => {
  it("resolves an alert", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.alerts.resolve({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ─── Copy Generator ───────────────────────────────────────────────────────────
describe("copyGen.generate", () => {
  it("generates ad copy successfully", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.copyGen.generate({
      objective: "Vendite e-commerce",
      productDescription: "Scarpe sportive premium",
      targetAudience: "Uomini 25-45 anni appassionati di sport",
      tone: "energico",
    });
    expect(result).toHaveProperty("generationId");
    expect(result).toHaveProperty("headlines");
    expect(result).toHaveProperty("primaryTexts");
    expect(result).toHaveProperty("descriptions");
    expect(Array.isArray(result.headlines)).toBe(true);
  });
});

// ─── Agent Logs ───────────────────────────────────────────────────────────────
describe("agentLogs.list", () => {
  it("returns empty list when no logs exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.agentLogs.list({ limit: 50 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── KPI Dashboard ────────────────────────────────────────────────────────────
describe("kpi.getDashboard", () => {
  it("returns dashboard data structure", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.kpi.getDashboard({ days: 30 });
    expect(result).toHaveProperty("kpis");
    expect(result.kpis).toHaveProperty("totalSpend");
    expect(result.kpis).toHaveProperty("roas");
    expect(result.kpis).toHaveProperty("cpa");
    expect(result).toHaveProperty("activeCampaigns");
    expect(result).toHaveProperty("activeGoals");
    expect(result).toHaveProperty("unreadAlerts");
  });
});
