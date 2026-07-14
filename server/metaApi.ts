/**
 * Meta Marketing API Service
 * Handles all interactions with Facebook/Instagram Ads API v19.0
 */

const META_API_VERSION = "v19.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiResponse<T = unknown> {
  data?: T;
  error?: { message: string; type: string; code: number };
  paging?: { cursors: { before: string; after: string }; next?: string };
}

async function metaFetch<T>(endpoint: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${META_API_BASE}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = (await res.json()) as MetaApiResponse<T>;
  if (json.error) throw new Error(`Meta API Error ${json.error.code}: ${json.error.message}`);
  return (json.data ?? json) as T;
}

async function metaPost<T>(endpoint: string, accessToken: string, body: Record<string, unknown>): Promise<T> {
  const url = `${META_API_BASE}${endpoint}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as MetaApiResponse<T>;
  if ((json as Record<string, unknown>).error) {
    const err = (json as Record<string, unknown>).error as { message: string; code: number };
    throw new Error(`Meta API Error ${err.code}: ${err.message}`);
  }
  return json as T;
}

// ─── Account Info ─────────────────────────────────────────────────────────────
export async function getAdAccountInfo(accountId: string, accessToken: string) {
  return metaFetch<{
    id: string;
    name: string;
    currency: string;
    timezone_name: string;
    account_status: number;
    spend_cap: string;
    amount_spent: string;
  }>(`/act_${accountId}`, accessToken, {
    fields: "id,name,currency,timezone_name,account_status,spend_cap,amount_spent",
  });
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function getMetaCampaigns(accountId: string, accessToken: string) {
  return metaFetch<Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>>(`/act_${accountId}/campaigns`, accessToken, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "100",
  });
}

export async function createMetaCampaign(accountId: string, accessToken: string, data: {
  name: string;
  objective: string;
  status: string;
  special_ad_categories: string[];
  daily_budget?: number;
  lifetime_budget?: number;
}) {
  return metaPost<{ id: string }>(`/act_${accountId}/campaigns`, accessToken, data);
}

export async function updateMetaCampaignStatus(campaignId: string, accessToken: string, status: string) {
  return metaPost<{ success: boolean }>(`/${campaignId}`, accessToken, { status });
}

// ─── Ad Sets ──────────────────────────────────────────────────────────────────
export async function getMetaAdSets(campaignId: string, accessToken: string) {
  return metaFetch<Array<{
    id: string;
    name: string;
    status: string;
    daily_budget?: string;
    bid_strategy?: string;
    optimization_goal?: string;
    targeting?: Record<string, unknown>;
  }>>(`/${campaignId}/adsets`, accessToken, {
    fields: "id,name,status,daily_budget,bid_strategy,optimization_goal,targeting",
  });
}

export async function createMetaAdSet(accountId: string, accessToken: string, data: {
  campaign_id: string;
  name: string;
  status: string;
  daily_budget: number;
  bid_strategy: string;
  billing_event: string;
  optimization_goal: string;
  targeting: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}) {
  return metaPost<{ id: string }>(`/act_${accountId}/adsets`, accessToken, data);
}

export async function updateMetaAdSetBudget(adSetId: string, accessToken: string, dailyBudget: number) {
  return metaPost<{ success: boolean }>(`/${adSetId}`, accessToken, { daily_budget: dailyBudget });
}

// ─── Ads ──────────────────────────────────────────────────────────────────────
export async function getMetaAds(adSetId: string, accessToken: string) {
  return metaFetch<Array<{
    id: string;
    name: string;
    status: string;
    creative?: { id: string };
  }>>(`/${adSetId}/ads`, accessToken, {
    fields: "id,name,status,creative",
  });
}

export async function updateMetaAdStatus(adId: string, accessToken: string, status: string) {
  return metaPost<{ success: boolean }>(`/${adId}`, accessToken, { status });
}

// ─── Insights / KPI ───────────────────────────────────────────────────────────
export interface MetaInsight {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  frequency: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export async function getCampaignInsights(campaignId: string, accessToken: string, datePreset = "last_30d"): Promise<MetaInsight[]> {
  try {
    const result = await metaFetch<MetaInsight[]>(`/${campaignId}/insights`, accessToken, {
      fields: "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values",
      date_preset: datePreset,
      level: "campaign",
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function getAdInsights(adId: string, accessToken: string, datePreset = "last_7d"): Promise<MetaInsight[]> {
  try {
    const result = await metaFetch<MetaInsight[]>(`/${adId}/insights`, accessToken, {
      fields: "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values",
      date_preset: datePreset,
      level: "ad",
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function getAccountInsights(accountId: string, accessToken: string, datePreset = "last_30d"): Promise<MetaInsight[]> {
  try {
    const result = await metaFetch<MetaInsight[]>(`/act_${accountId}/insights`, accessToken, {
      fields: "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values",
      date_preset: datePreset,
      time_increment: "1",
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// ─── Pixel ────────────────────────────────────────────────────────────────────
export async function getPixels(accountId: string, accessToken: string) {
  return metaFetch<Array<{ id: string; name: string; creation_time: string; last_fired_time?: string }>>(`/act_${accountId}/adspixels`, accessToken, {
    fields: "id,name,creation_time,last_fired_time",
  });
}

export async function createPixel(accountId: string, accessToken: string, name: string) {
  return metaPost<{ id: string }>(`/act_${accountId}/adspixels`, accessToken, { name });
}

// ─── Helper: Parse Insights ───────────────────────────────────────────────────
export function parseInsightKpis(insight: MetaInsight) {
  const conversions = insight.actions?.find(a => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? "0";
  const leads = insight.actions?.find(a => a.action_type === "lead")?.value ?? "0";
  const revenue = insight.action_values?.find(a => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? "0";
  const spend = parseFloat(insight.spend || "0");
  const conv = parseFloat(conversions);
  const clicks = parseFloat(insight.clicks || "0");
  const cpa = conv > 0 ? spend / conv : 0;
  const cpl = parseFloat(leads) > 0 ? spend / parseFloat(leads) : 0;
  const roas = spend > 0 ? parseFloat(revenue) / spend : 0;
  const conversionRate = clicks > 0 ? (conv / clicks) * 100 : 0;
  return {
    impressions: parseInt(insight.impressions || "0"),
    clicks: parseInt(insight.clicks || "0"),
    spend,
    reach: parseInt(insight.reach || "0"),
    frequency: parseFloat(insight.frequency || "0"),
    ctr: parseFloat(insight.ctr || "0"),
    cpc: parseFloat(insight.cpc || "0"),
    cpm: parseFloat(insight.cpm || "0"),
    conversions: conv,
    leads: parseFloat(leads),
    revenue: parseFloat(revenue),
    cpa,
    cpl,
    roas,
    conversionRate,
  };
}

// ─── Instagram Business Discovery (per la Watchlist) ──────────────────────────
// API ufficiale gratuita: dati pubblici di account IG business/creator terzi,
// usando il token Meta già collegato — nessuna nuova app richiesta.

export async function getInstagramBusinessId(accessToken: string): Promise<string | null> {
  const pages = await metaFetch<{ id: string; instagram_business_account?: { id: string } }[]>(
    "/me/accounts", accessToken, { fields: "instagram_business_account", limit: "50" }
  );
  const withIg = (Array.isArray(pages) ? pages : []).find((p) => p.instagram_business_account?.id);
  return withIg?.instagram_business_account?.id ?? null;
}

export interface BusinessDiscoveryMedia {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
  media_product_type?: string;
}

export async function instagramBusinessDiscovery(accessToken: string, igUserId: string, handle: string) {
  if (!/^[\w.]+$/.test(handle)) throw new Error(`Handle Instagram non valido: ${handle}`);
  const fields = `business_discovery.username(${handle}){followers_count,media_count,name,profile_picture_url,media.limit(30){id,caption,like_count,comments_count,media_url,thumbnail_url,permalink,timestamp,media_type,media_product_type}}`;
  const res = await metaFetch<{
    business_discovery?: {
      id: string;
      name?: string;
      followers_count?: number;
      media_count?: number;
      profile_picture_url?: string;
      media?: { data?: BusinessDiscoveryMedia[] };
    };
  }>(`/${igUserId}`, accessToken, { fields });
  return res.business_discovery ?? null;
}
