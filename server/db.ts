import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, metaAccounts, campaigns, adSets, ads, kpiSnapshots, goals, agentLogs, abTests, alerts, copyGenerations, trackingConfigs, userSettings } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Meta Accounts ────────────────────────────────────────────────────────────
export async function getMetaAccountsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaAccounts).where(eq(metaAccounts.userId, userId)).orderBy(desc(metaAccounts.createdAt));
}

export async function getMetaAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(metaAccounts).where(eq(metaAccounts.id, id)).limit(1);
  return result[0];
}

export async function upsertMetaAccount(data: typeof metaAccounts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(metaAccounts).values(data).onDuplicateKeyUpdate({ set: { accountName: data.accountName, accessToken: data.accessToken, status: data.status, updatedAt: new Date() } });
}

export async function updateMetaAccountStatus(id: number, status: "active" | "disconnected" | "error") {
  const db = await getDb();
  if (!db) return;
  await db.update(metaAccounts).set({ status, updatedAt: new Date() }).where(eq(metaAccounts.id, id));
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function getCampaignsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0];
}

export async function createCampaign(data: typeof campaigns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(campaigns).values(data);
  return result[0];
}

export async function updateCampaign(id: number, data: Partial<typeof campaigns.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(campaigns).set({ ...data, updatedAt: new Date() }).where(eq(campaigns.id, id));
}

// ─── Ad Sets ──────────────────────────────────────────────────────────────────
export async function getAdSetsByCampaignId(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adSets).where(eq(adSets.campaignId, campaignId)).orderBy(desc(adSets.createdAt));
}

export async function createAdSet(data: typeof adSets.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(adSets).values(data);
}

export async function updateAdSet(id: number, data: Partial<typeof adSets.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(adSets).set({ ...data, updatedAt: new Date() }).where(eq(adSets.id, id));
}

// ─── Ads ──────────────────────────────────────────────────────────────────────
export async function getAdsByAdSetId(adSetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ads).where(eq(ads.adSetId, adSetId)).orderBy(desc(ads.createdAt));
}

export async function getAdById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
  return result[0];
}

export async function createAd(data: typeof ads.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ads).values(data);
  return result[0];
}

export async function updateAdStatus(id: number, status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED") {
  const db = await getDb();
  if (!db) return;
  await db.update(ads).set({ status, updatedAt: new Date() }).where(eq(ads.id, id));
}

// ─── KPI Snapshots ────────────────────────────────────────────────────────────
export async function getKpiSnapshotsByUserId(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(kpiSnapshots).where(and(eq(kpiSnapshots.userId, userId), gte(kpiSnapshots.snapshotDate, since))).orderBy(desc(kpiSnapshots.snapshotDate)).limit(500);
}

export async function getKpiSnapshotsByCampaign(campaignId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(kpiSnapshots).where(and(eq(kpiSnapshots.campaignId, campaignId), gte(kpiSnapshots.snapshotDate, since))).orderBy(desc(kpiSnapshots.snapshotDate)).limit(200);
}

export async function insertKpiSnapshot(data: typeof kpiSnapshots.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(kpiSnapshots).values(data);
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export async function getGoalsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt));
}

export async function getGoalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  return result[0];
}

export async function createGoal(data: typeof goals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(goals).values(data);
  return result[0];
}

export async function updateGoal(id: number, data: Partial<typeof goals.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(goals).set({ ...data, updatedAt: new Date() }).where(eq(goals.id, id));
}

// ─── Agent Logs ───────────────────────────────────────────────────────────────
export async function getAgentLogsByUserId(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentLogs).where(eq(agentLogs.userId, userId)).orderBy(desc(agentLogs.createdAt)).limit(limit);
}

export async function insertAgentLog(data: typeof agentLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(agentLogs).values(data);
}

// ─── AB Tests ─────────────────────────────────────────────────────────────────
export async function getAbTestsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(abTests).where(eq(abTests.userId, userId)).orderBy(desc(abTests.createdAt));
}

export async function getAbTestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(abTests).where(eq(abTests.id, id)).limit(1);
  return result[0];
}

export async function createAbTest(data: typeof abTests.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(abTests).values(data);
}

export async function updateAbTest(id: number, data: Partial<typeof abTests.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(abTests).set({ ...data, updatedAt: new Date() }).where(eq(abTests.id, id));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export async function getAlertsByUserId(userId: number, onlyUnread = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = onlyUnread
    ? and(eq(alerts.userId, userId), eq(alerts.isRead, false))
    : eq(alerts.userId, userId);
  return db.select().from(alerts).where(conditions).orderBy(desc(alerts.createdAt)).limit(100);
}

export async function insertAlert(data: typeof alerts.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alerts).values(data);
}

export async function markAlertRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
}

export async function resolveAlert(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ isResolved: true, resolvedAt: new Date() }).where(eq(alerts.id, id));
}

// ─── Copy Generations ─────────────────────────────────────────────────────────
export async function getCopyGenerationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(copyGenerations).where(eq(copyGenerations.userId, userId)).orderBy(desc(copyGenerations.createdAt)).limit(50);
}

export async function insertCopyGeneration(data: typeof copyGenerations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(copyGenerations).values(data);
  return result[0];
}

export async function updateCopyGenerationSelection(id: number, headline: string, primaryText: string, description: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(copyGenerations).set({ selectedHeadline: headline, selectedPrimaryText: primaryText, selectedDescription: description }).where(eq(copyGenerations.id, id));
}

// ─── Tracking Configs ─────────────────────────────────────────────────────────
export async function getTrackingConfigByAccount(metaAccountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(trackingConfigs).where(eq(trackingConfigs.metaAccountId, metaAccountId)).limit(1);
  return result[0];
}

export async function upsertTrackingConfig(data: typeof trackingConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(trackingConfigs).values(data).onDuplicateKeyUpdate({ set: { pixelId: data.pixelId, pixelName: data.pixelName, pixelInstalled: data.pixelInstalled, capiEnabled: data.capiEnabled, websiteUrl: data.websiteUrl, trackedEvents: data.trackedEvents, updatedAt: new Date() } });
}


// ─── User Settings ──────────────────────────────────────────────────────────
export async function getAllUserSettings(userId: number): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  const out: Record<string, string> = {};
  for (const r of rows) { if (r.settingValue != null) out[r.settingKey] = r.settingValue; }
  return out;
}

export async function upsertUserSetting(userId: number, key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userSettings).values({ userId, settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}
