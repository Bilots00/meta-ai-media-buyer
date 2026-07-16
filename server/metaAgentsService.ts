/**
 * Mission Control + AI Manager — orchestrazione del team di agenti AI
 * del reparto Paid Advertising (replica AdLevel AI: Athena + Mission Control).
 *
 * - AI Manager: chat con Polaris (orchestrator). Le azioni (lancio campagna,
 *   pausa, riattivazione) sono SEMPRE proposte e mai eseguite senza conferma
 *   esplicita di Andrea (draft-first: le campagne su Meta nascono PAUSED).
 * - Ciclo agenti (schedulato): Vega verifica che le ads siano live, Sirius
 *   scrive update di performance in linguaggio business, Nova produce
 *   raccomandazioni operative (mai budget change automatici).
 */

import { invokeLLM } from "./_core/llm";
import {
  getMcAgents, upsertMcAgent, updateMcAgentStatus, setAllMcAgentsIdle,
  insertMcActivity, getMcActivity, countMcActivityToday,
  getMcCampaignStates, upsertMcCampaignState,
  insertMetaChatMessage, getMetaChatMessages, getMetaChatMessageById, updateMetaChatMessage,
  getCampaignsByUserId, getCampaignById, createCampaign, updateCampaign,
  getMetaAccountsByUserId, getMetaAccountById,
  getAdSetsByCampaignId, getAdsByAdSetId,
  getAlertsByUserId, insertAgentLog, getKpiSnapshotsByUserId,
} from "./db";
import {
  createMetaCampaign, updateMetaCampaignStatus, getCampaignInsights,
  getMetaAdSets, getMetaAds, parseInsightKpis,
} from "./metaApi";
import { triggerAlert } from "./aiAgent";
import {
  MC_AGENT_DEFS, MC_AGENT_BY_CODE, MC_STATUSES, type McStatus,
  mapCampaignToMcStatus, buildOrchestratorSystemPrompt, ORCHESTRATOR_RESPONSE_SCHEMA,
  buildSiriusPrompt, SIRIUS_RESPONSE_SCHEMA,
  CAMPAIGN_OBJECTIVES, type ChatAction,
} from "./metaAgents";

// ─── Seed idempotente del team ──────────────────────────────────────────────
export async function ensureMcAgentsSeeded(userId: number): Promise<void> {
  const existing = await getMcAgents(userId);
  const have = new Set(existing.map((a) => a.code));
  for (const def of MC_AGENT_DEFS) {
    if (!have.has(def.code)) {
      await upsertMcAgent({ userId, ...def });
    }
  }
}

async function logActivity(userId: number, agentCode: string, message: string, opts: { campaignId?: number; details?: Record<string, unknown> } = {}) {
  await insertMcActivity({ userId, agentCode, campaignId: opts.campaignId, message, details: opts.details });
  await updateMcAgentStatus(userId, agentCode, "working").catch(() => {});
}

// ─── Snapshot per la pagina Mission Control ─────────────────────────────────
export async function getMissionControlOverview(userId: number) {
  await ensureMcAgentsSeeded(userId);
  const [agents, allCampaigns, states, unresolvedAlerts, doneToday, recentActivity] = await Promise.all([
    getMcAgents(userId),
    getCampaignsByUserId(userId),
    getMcCampaignStates(userId),
    getAlertsByUserId(userId).then((rows) => rows.filter((a) => !a.isResolved && (a.severity === "high" || a.severity === "critical"))),
    countMcActivityToday(userId),
    getMcActivity(userId, { limit: 30 }),
  ]);

  const stateByCampaign = new Map(states.map((s) => [s.campaignId, s]));
  const alertCampaignIds = new Set(unresolvedAlerts.map((a) => a.campaignId).filter(Boolean));
  const lastActivityByCampaign = new Map<number, (typeof recentActivity)[number]>();
  for (const act of recentActivity) {
    if (act.campaignId != null && !lastActivityByCampaign.has(act.campaignId)) {
      lastActivityByCampaign.set(act.campaignId, act);
    }
  }

  // Solo campagne gestite dagli agenti (managed); default: tutte le non-archiviate
  const visible = allCampaigns.filter((c) => c.status !== "DELETED" && c.status !== "ARCHIVED");
  const campaignsOut = visible.map((c) => {
    const st = stateByCampaign.get(c.id);
    const managed = st ? st.managed : false;
    const mcStatus = mapCampaignToMcStatus(c.status, alertCampaignIds.has(c.id), st?.mcStatus === "generating" || st?.mcStatus === "publishing" ? st.mcStatus : null);
    const lastAct = lastActivityByCampaign.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      mcStatus,
      managed,
      dailyBudget: c.dailyBudget ? parseFloat(c.dailyBudget.toString()) : null,
      assignedAgentCode: st?.assignedAgentCode ?? "polaris",
      lastActivityAt: lastAct?.createdAt ?? c.updatedAt,
      lastActivityAgent: lastAct?.agentCode ?? null,
    };
  });

  const managedCampaigns = campaignsOut.filter((c) => c.managed);
  const distribution: Record<McStatus, number> = { generating: 0, publishing: 0, active: 0, needs_attention: 0, review: 0, paused: 0, done: 0 };
  for (const c of managedCampaigns) distribution[c.mcStatus as McStatus] += 1;

  const workingAgents = agents.filter((a) => a.status === "working");
  return {
    stats: {
      activeCampaigns: managedCampaigns.filter((c) => c.mcStatus === "active").length,
      doneToday,
      agentsOnline: workingAgents.length,
      agentsTotal: agents.length,
      agentsOnlineNames: workingAgents.map((a) => a.name),
      urgent: unresolvedAlerts.length,
    },
    distribution,
    statusOrder: MC_STATUSES,
    campaigns: managedCampaigns,
    unmanagedCampaigns: campaignsOut.filter((c) => !c.managed),
    agents: agents.map((a) => ({
      code: a.code, name: a.name, role: a.role, department: a.department,
      isLiaison: a.isLiaison, colorHue: a.colorHue, status: a.status, lastActiveAt: a.lastActiveAt,
    })),
  };
}

// ─── Drawer campagna (replica screenshot AdLevel) ────────────────────────────
export async function getCampaignDrawer(userId: number, campaignId: number) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.userId !== userId) throw new Error("Campagna non trovata");

  const [states, activity, adSetsLocal] = await Promise.all([
    getMcCampaignStates(userId),
    getMcActivity(userId, { campaignId, limit: 40 }),
    getAdSetsByCampaignId(campaignId),
  ]);
  const st = states.find((s) => s.campaignId === campaignId);

  // Creatives attive (dal DB locale)
  let adsTotal = 0; let adsActive = 0;
  for (const as of adSetsLocal) {
    const rows = await getAdsByAdSetId(as.id);
    adsTotal += rows.length;
    adsActive += rows.filter((a) => a.status === "ACTIVE").length;
  }

  // KPI di oggi: best-effort live da Meta, fallback silenzioso a null
  let today: { spend: number; purchases: number; leads: number; cpa: number | null; cpl: number | null } | null = null;
  const account = await getMetaAccountById(campaign.metaAccountId);
  if (account?.accessToken && campaign.metaCampaignId) {
    const insights = await getCampaignInsights(campaign.metaCampaignId, account.accessToken, "today");
    if (insights.length > 0) {
      const k = parseInsightKpis(insights[0]);
      today = {
        spend: k.spend,
        purchases: Math.round(k.conversions),
        leads: Math.round(k.leads),
        cpa: k.conversions > 0 ? k.cpa : null,
        cpl: k.leads > 0 ? k.cpl : null,
      };
    }
  }

  const lastAct = activity[0];
  const lastAgent = lastAct ? MC_AGENT_BY_CODE.get(lastAct.agentCode) : undefined;
  return {
    campaign: {
      id: campaign.id, name: campaign.name, status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.dailyBudget ? parseFloat(campaign.dailyBudget.toString()) : null,
      managed: st?.managed ?? false,
    },
    currentStatus: lastAct ? {
      agentCode: lastAct.agentCode,
      agentName: lastAgent?.name ?? lastAct.agentCode,
      agentRole: lastAgent?.role ?? "",
      message: lastAct.message,
      at: lastAct.createdAt,
    } : null,
    kpis: { today, creativesActive: adsActive, creativesTotal: adsTotal },
    activity: activity.map((a) => ({
      id: a.id, agentCode: a.agentCode,
      agentName: MC_AGENT_BY_CODE.get(a.agentCode)?.name ?? a.agentCode,
      message: a.message, at: a.createdAt,
    })),
  };
}

export async function getAgentDrawer(userId: number, code: string) {
  const agents = await getMcAgents(userId);
  const agent = agents.find((a) => a.code === code);
  if (!agent) throw new Error("Agente non trovato");
  const activity = await getMcActivity(userId, { agentCode: code, limit: 40 });
  const campaigns = await getCampaignsByUserId(userId);
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
  return {
    agent: {
      code: agent.code, name: agent.name, role: agent.role, department: agent.department,
      isLiaison: agent.isLiaison, colorHue: agent.colorHue, status: agent.status, lastActiveAt: agent.lastActiveAt,
    },
    activity: activity.map((a) => ({
      id: a.id, agentCode: a.agentCode, agentName: agent.name,
      campaignName: a.campaignId != null ? nameById.get(a.campaignId) ?? null : null,
      message: a.message, at: a.createdAt,
    })),
  };
}

// ─── Azioni Mission Control (con propagazione reale su Meta) ─────────────────
export async function pauseOrResumeCampaign(userId: number, campaignId: number, action: "pause" | "resume") {
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.userId !== userId) throw new Error("Campagna non trovata");
  const newStatus = action === "pause" ? "PAUSED" : "ACTIVE";

  if (campaign.metaCampaignId) {
    const account = await getMetaAccountById(campaign.metaAccountId);
    if (account?.accessToken) {
      await updateMetaCampaignStatus(campaign.metaCampaignId, account.accessToken, newStatus);
    }
  }
  await updateCampaign(campaignId, { status: newStatus });
  await logActivity(userId, "polaris", action === "pause"
    ? `Campagna "${campaign.name}" messa in pausa su richiesta di Andrea (propagato su Meta).`
    : `Campagna "${campaign.name}" riattivata su richiesta di Andrea (propagato su Meta).`,
    { campaignId, details: { action, propagatedToMeta: Boolean(campaign.metaCampaignId) } });
  await insertAgentLog({
    userId, campaignId,
    actionType: action === "pause" ? "ad_pause" : "ad_activate",
    title: `${action === "pause" ? "Pausa" : "Riattivazione"} campagna: ${campaign.name}`,
    reasoning: "Azione manuale da Mission Control, propagata su Meta.",
    impact: "neutral", severity: "info",
  });
  return { success: true, status: newStatus } as const;
}

export async function setCampaignManaged(userId: number, campaignId: number, managed: boolean) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.userId !== userId) throw new Error("Campagna non trovata");
  await upsertMcCampaignState({ userId, campaignId, managed });
  await logActivity(userId, "polaris", managed
    ? `Campagna "${campaign.name}" affidata al team di agenti AI.`
    : `Campagna "${campaign.name}" rimossa dalla gestione degli agenti AI.`,
    { campaignId });
  return { success: true } as const;
}

// ─── AI Manager: chat con Polaris ────────────────────────────────────────────
async function buildLiveContext(userId: number): Promise<string> {
  const [accounts, campaigns, states, snapshots, alertRows] = await Promise.all([
    getMetaAccountsByUserId(userId),
    getCampaignsByUserId(userId),
    getMcCampaignStates(userId),
    getKpiSnapshotsByUserId(userId, 7),
    getAlertsByUserId(userId, true),
  ]);
  const managedIds = new Set(states.filter((s) => s.managed).map((s) => s.campaignId));
  const totals = snapshots.reduce((acc, s) => ({
    spend: acc.spend + parseFloat(s.spend?.toString() ?? "0"),
    revenue: acc.revenue + parseFloat(s.revenue?.toString() ?? "0"),
    conversions: acc.conversions + (s.conversions ?? 0),
    leads: acc.leads + (s.leads ?? 0),
  }), { spend: 0, revenue: 0, conversions: 0, leads: 0 });
  return JSON.stringify({
    accounts: accounts.map((a) => ({ metaAccountId: a.id, accountId: a.accountId, name: a.accountName, currency: a.currency, status: a.status })),
    campaigns: campaigns.filter((c) => c.status !== "DELETED").slice(0, 30).map((c) => ({
      campaignId: c.id, name: c.name, status: c.status, objective: c.objective,
      dailyBudget: c.dailyBudget, publishedOnMeta: Boolean(c.metaCampaignId), managedByAgents: managedIds.has(c.id),
    })),
    kpiLast7d: { ...totals, roas: totals.spend > 0 ? +(totals.revenue / totals.spend).toFixed(2) : 0 },
    unreadAlerts: alertRows.length,
  }, null, 1);
}

export async function aiManagerChatList(userId: number, limit = 100) {
  const rows = await getMetaChatMessages(userId, limit);
  return rows.reverse().map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    action: (m.actionJson ?? null) as ChatAction | null,
    createdAt: m.createdAt,
  }));
}

export async function aiManagerSend(userId: number, text: string) {
  await ensureMcAgentsSeeded(userId);
  await insertMetaChatMessage({ userId, role: "user", text, status: "handled", handledAt: new Date() });

  // Storia recente (dopo l'insert: include il messaggio appena mandato)
  const history = (await getMetaChatMessages(userId, 20)).reverse();
  const context = await buildLiveContext(userId);

  await updateMcAgentStatus(userId, "polaris", "working").catch(() => {});
  let reply = "Non sono riuscito a elaborare la richiesta. Riprova.";
  let action: ChatAction | null = null;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: buildOrchestratorSystemPrompt(context) },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.text })),
      ],
      response_format: { type: "json_schema", json_schema: ORCHESTRATOR_RESPONSE_SCHEMA as never },
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as {
      reply: string;
      actionType: string;
      actionParams: { metaAccountId: number; campaignId: number; name: string; objective: string; dailyBudget: number; notes: string };
    };
    reply = parsed.reply || reply;
    if (parsed.actionType && parsed.actionType !== "none") {
      const p = parsed.actionParams;
      const objective = (CAMPAIGN_OBJECTIVES as readonly string[]).includes(p.objective) ? p.objective : "OUTCOME_SALES";
      if (parsed.actionType === "launch_campaign" && p.name && p.dailyBudget > 0 && p.metaAccountId > 0) {
        action = { type: "launch_campaign", metaAccountId: p.metaAccountId, campaignId: 0, name: p.name, objective, dailyBudget: p.dailyBudget, notes: p.notes ?? "", state: "pending" };
      } else if ((parsed.actionType === "pause_campaign" || parsed.actionType === "resume_campaign") && p.campaignId > 0) {
        action = { type: parsed.actionType, metaAccountId: p.metaAccountId, campaignId: p.campaignId, name: p.name ?? "", objective, dailyBudget: p.dailyBudget ?? 0, notes: p.notes ?? "", state: "pending" };
      }
    }
  } catch (err) {
    console.warn("[AI Manager] LLM error:", err);
    reply = "⚠️ Il motore AI non è raggiungibile in questo momento. Riprova tra poco.";
  }

  const assistantId = await insertMetaChatMessage({
    userId, role: "assistant", text: reply, status: "handled", handledAt: new Date(), actionJson: action ?? undefined,
  });
  await updateMcAgentStatus(userId, "polaris", "idle").catch(() => {});
  if (action) {
    await logActivity(userId, "polaris", `Proposta in attesa di approvazione: ${action.type === "launch_campaign" ? `lancio campagna "${action.name}" (€${action.dailyBudget}/day)` : `${action.type === "pause_campaign" ? "pausa" : "riattivazione"} campagna #${action.campaignId}`}.`);
  }
  return { success: true, assistantId, hasAction: Boolean(action) } as const;
}

export async function aiManagerConfirmAction(userId: number, messageId: number, approve: boolean) {
  const msg = await getMetaChatMessageById(messageId);
  if (!msg || msg.userId !== userId) throw new Error("Messaggio non trovato");
  const action = (msg.actionJson ?? null) as ChatAction | null;
  if (!action || action.state !== "pending") throw new Error("Nessuna azione in attesa su questo messaggio");

  if (!approve) {
    await updateMetaChatMessage(messageId, { actionJson: { ...action, state: "cancelled" } });
    await insertMetaChatMessage({ userId, role: "assistant", text: "Ok, azione annullata. Nessuna modifica è stata fatta su Meta.", status: "handled", handledAt: new Date() });
    await logActivity(userId, "polaris", "Proposta annullata da Andrea: nessuna azione eseguita.");
    return { success: true, executed: false } as const;
  }

  let resultText = "";
  if (action.type === "launch_campaign") {
    const account = await getMetaAccountById(action.metaAccountId);
    if (!account || account.userId !== userId || !account.accessToken) throw new Error("Account Meta non configurato");
    await updateMcAgentStatus(userId, "orion", "working").catch(() => {});
    let metaCampaignId: string | undefined;
    try {
      const created = await createMetaCampaign(account.accountId, account.accessToken, {
        name: action.name,
        objective: action.objective,
        status: "PAUSED", // draft-first: mai live senza review finale di Andrea
        special_ad_categories: [],
        daily_budget: Math.round(action.dailyBudget * 100),
      });
      metaCampaignId = created.id;
    } finally {
      await updateMcAgentStatus(userId, "orion", "idle").catch(() => {});
    }
    const inserted = await createCampaign({
      userId, metaAccountId: action.metaAccountId, metaCampaignId,
      name: action.name,
      objective: action.objective as never,
      status: "DRAFT",
      dailyBudget: action.dailyBudget.toString(),
      notes: action.notes || undefined,
    });
    const localId = Number((inserted as unknown as { insertId?: number })?.insertId ?? 0) || undefined;
    if (localId) await upsertMcCampaignState({ userId, campaignId: localId, managed: true, assignedAgentCode: "orion", mcStatus: "review" });
    await logActivity(userId, "orion", `Campagna "${action.name}" creata su Meta in PAUSED (€${action.dailyBudget}/day, ${action.objective}). In attesa della review finale di Andrea prima dell'attivazione.`, { campaignId: localId, details: { metaCampaignId } });
    await insertAgentLog({
      userId, campaignId: localId,
      actionType: "campaign_create",
      title: `Campagna creata da AI Manager: ${action.name}`,
      reasoning: `Lancio approvato da Andrea in chat. Creata su Meta in PAUSED (draft-first) con budget €${action.dailyBudget}/day.`,
      actionDetails: { metaCampaignId, objective: action.objective, notes: action.notes },
      impact: "positive", severity: "info",
    });
    resultText = `🚀 Fatto. Orion ha creato la campagna "${action.name}" su Meta in stato PAUSED (€${action.dailyBudget}/day, ${action.objective}). La trovi in Mission Control: quando hai fatto la review finale, attivala da lì o dimmelo.`;
  } else {
    await pauseOrResumeCampaign(userId, action.campaignId, action.type === "pause_campaign" ? "pause" : "resume");
    resultText = action.type === "pause_campaign"
      ? "⏸️ Campagna messa in pausa e propagata su Meta."
      : "▶️ Campagna riattivata e propagata su Meta.";
  }

  await updateMetaChatMessage(messageId, { actionJson: { ...action, state: "executed" } });
  await insertMetaChatMessage({ userId, role: "assistant", text: resultText, status: "handled", handledAt: new Date() });
  return { success: true, executed: true } as const;
}

// ─── Ciclo agenti (schedulato): il loop autonomo che oggi manca ──────────────
export async function runAgentsCycle(userId: number): Promise<{ campaignsChecked: number; updates: number; alertsRaised: number }> {
  await ensureMcAgentsSeeded(userId);
  const [campaigns, states] = await Promise.all([getCampaignsByUserId(userId), getMcCampaignStates(userId)]);
  const managedIds = new Set(states.filter((s) => s.managed).map((s) => s.campaignId));
  const targets = campaigns.filter((c) => managedIds.has(c.id) && c.status === "ACTIVE" && c.metaCampaignId);
  if (targets.length === 0) return { campaignsChecked: 0, updates: 0, alertsRaised: 0 };

  let updates = 0; let alertsRaised = 0;
  for (const campaign of targets) {
    const account = await getMetaAccountById(campaign.metaAccountId);
    if (!account?.accessToken) continue;

    // VEGA — verifica che le ads siano effettivamente live
    await updateMcAgentStatus(userId, "vega", "working").catch(() => {});
    try {
      const adSets = await getMetaAdSets(campaign.metaCampaignId!, account.accessToken);
      let liveAds = 0; let totalAds = 0;
      for (const as of adSets.slice(0, 10)) {
        const adsRows = await getMetaAds(as.id, account.accessToken);
        totalAds += adsRows.length;
        liveAds += adsRows.filter((a) => a.status === "ACTIVE").length;
      }
      if (totalAds > 0 && liveAds === 0) {
        await logActivity(userId, "vega", `Attenzione: nessuna ad risulta live nella campagna "${campaign.name}" (${totalAds} ads totali). Possibile rifiuto o pausa non prevista.`, { campaignId: campaign.id });
        await triggerAlert(userId, null, "ad_rejected", "high", `Nessuna ad live: ${campaign.name}`, "Vega ha rilevato che nessuna inserzione della campagna è in stato ACTIVE su Meta.");
        alertsRaised++;
      } else if (totalAds > 0) {
        await logActivity(userId, "vega", `Verifica completata: ${liveAds}/${totalAds} ads live nella campagna "${campaign.name}".`, { campaignId: campaign.id });
      }
      updates++;
    } catch (err) {
      console.warn("[AgentsCycle] Vega check fallito:", err);
    } finally {
      await updateMcAgentStatus(userId, "vega", "idle").catch(() => {});
    }

    // SIRIUS — update performance in linguaggio business (stile Zenith di AdLevel)
    await updateMcAgentStatus(userId, "sirius", "working").catch(() => {});
    try {
      const [todayIns, weekIns] = await Promise.all([
        getCampaignInsights(campaign.metaCampaignId!, account.accessToken, "today"),
        getCampaignInsights(campaign.metaCampaignId!, account.accessToken, "last_7d"),
      ]);
      const t = todayIns.length ? parseInsightKpis(todayIns[0]) : null;
      const w = weekIns.length ? parseInsightKpis(weekIns[0]) : null;
      if (w) {
        const response = await invokeLLM({
          messages: [{ role: "user", content: buildSiriusPrompt(campaign.name, {
            spendToday: t?.spend ?? 0, spend7d: w.spend, ctr7d: w.ctr, clicks7d: w.clicks,
            purchases7d: Math.round(w.conversions), leads7d: Math.round(w.leads),
            revenue7d: w.revenue, roas7d: w.roas, currency: account.currency ?? "EUR",
          }) }],
          response_format: { type: "json_schema", json_schema: SIRIUS_RESPONSE_SCHEMA as never },
        });
        const raw = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as { update: string; urgency: string; recommendation: string };
        if (parsed.update) {
          await logActivity(userId, "sirius", parsed.update, { campaignId: campaign.id, details: { spend7d: w.spend, ctr7d: w.ctr, roas7d: w.roas } });
          updates++;
        }
        if (parsed.urgency === "high") {
          await triggerAlert(userId, null, "performance_drop", "high", `Performance da verificare: ${campaign.name}`, parsed.update);
          alertsRaised++;
        }
        // NOVA — raccomandazione operativa (mai esecuzione automatica di budget)
        if (parsed.recommendation && parsed.recommendation.trim().length > 3) {
          await updateMcAgentStatus(userId, "nova", "working").catch(() => {});
          await logActivity(userId, "nova", `Raccomandazione: ${parsed.recommendation} (serve l'approvazione di Andrea per qualsiasi modifica di budget).`, { campaignId: campaign.id });
          await updateMcAgentStatus(userId, "nova", "idle").catch(() => {});
          updates++;
        }
      }
    } catch (err) {
      console.warn("[AgentsCycle] Sirius update fallito:", err);
    } finally {
      await updateMcAgentStatus(userId, "sirius", "idle").catch(() => {});
    }
  }

  await setAllMcAgentsIdle(userId).catch(() => {});
  return { campaignsChecked: targets.length, updates, alertsRaised };
}
