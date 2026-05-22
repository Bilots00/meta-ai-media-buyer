/**
 * AI Agent Engine — Autonomous META Ads Optimizer
 * Replicates the autonomous agent described by Marco Montemango:
 * - Analyzes historical data
 * - Makes autonomous decisions (activate/pause ads, reallocate budget)
 * - Logs every action with reasoning
 * - Triggers alerts on anomalies
 * - Operates within safety limits set by the supervisor
 */

import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  getGoalById, updateGoal, insertAgentLog, insertAlert,
  getCampaignsByUserId, getAdSetsByCampaignId, getAdsByAdSetId,
  updateAdStatus, updateAdSet, insertKpiSnapshot, getKpiSnapshotsByUserId,
  getMetaAccountById,
} from "./db";
import {
  getCampaignInsights, getAdInsights, updateMetaAdStatus,
  updateMetaAdSetBudget, parseInsightKpis,
} from "./metaApi";

// ─── Audit ────────────────────────────────────────────────────────────────────
export async function runAccountAudit(userId: number, metaAccountId: number, accessToken: string, accountId: string): Promise<string> {
  const snapshots = await getKpiSnapshotsByUserId(userId, 90);
  const campaigns = await getCampaignsByUserId(userId);
  const accountCampaigns = campaigns.filter(c => c.metaAccountId === metaAccountId);

  const contextData = {
    totalCampaigns: accountCampaigns.length,
    activeCampaigns: accountCampaigns.filter(c => c.status === "ACTIVE").length,
    kpiHistory: snapshots.slice(0, 30).map(s => ({
      date: s.snapshotDate,
      spend: s.spend,
      roas: s.roas,
      cpa: s.cpa,
      cpl: s.cpl,
      conversions: s.conversions,
      ctr: s.ctr,
    })),
  };

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Sei un esperto Media Buyer META con 10 anni di esperienza in e-commerce. 
Analizza i dati dell'account pubblicitario e fornisci un audit dettagliato in italiano.
Il tuo report deve includere:
1. **Panoramica Performance** — analisi dei KPI principali (ROAS, CPA, CPL, CTR)
2. **Punti di Forza** — cosa sta funzionando bene
3. **Criticità Identificate** — problemi e inefficienze rilevate
4. **Opportunità di Ottimizzazione** — azioni concrete da intraprendere
5. **Raccomandazioni Budget** — come riallocare il budget per massimizzare il ROAS
6. **Piano d'Azione Prioritario** — i 3 interventi più urgenti

Usa un tono professionale e diretto. Fornisci stime numeriche quando possibile.`,
      },
      {
        role: "user",
        content: `Analizza questo account META Ads:\n\n${JSON.stringify(contextData, null, 2)}`,
      },
    ],
  });

  const rawAudit = response.choices[0]?.message?.content ?? "Audit non disponibile.";
  const auditText = typeof rawAudit === "string" ? rawAudit : JSON.stringify(rawAudit);

  await insertAgentLog({
    userId,
    actionType: "audit",
    title: "Audit automatico account META completato",
    reasoning: "Analisi completa dello storico dell'account per identificare pattern di performance e opportunità di ottimizzazione.",
    actionDetails: { campaignsAnalyzed: accountCampaigns.length, snapshotsAnalyzed: snapshots.length },
    impact: "neutral",
    severity: "info",
  });

  return auditText;
}

// ─── Copy Generation ──────────────────────────────────────────────────────────
export async function generateAdCopy(params: {
  userId: number;
  objective: string;
  productDescription: string;
  targetAudience: string;
  tone: string;
  campaignContext?: string;
}): Promise<{ headlines: string[]; primaryTexts: string[]; descriptions: string[] }> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Sei un copywriter esperto di performance marketing per e-commerce, specializzato in inserzioni META (Facebook e Instagram).
Genera copy pubblicitari ad alta conversione in italiano.
Rispondi SOLO con JSON valido nel formato specificato.`,
      },
      {
        role: "user",
        content: `Genera copy per questa campagna META:
- Obiettivo: ${params.objective}
- Prodotto/Servizio: ${params.productDescription}
- Target: ${params.targetAudience}
- Tono: ${params.tone}
${params.campaignContext ? `- Contesto: ${params.campaignContext}` : ""}

Genera 5 varianti per ogni elemento. Formato JSON:
{
  "headlines": ["titolo1", "titolo2", "titolo3", "titolo4", "titolo5"],
  "primaryTexts": ["testo1", "testo2", "testo3", "testo4", "testo5"],
  "descriptions": ["desc1", "desc2", "desc3", "desc4", "desc5"]
}

I titoli devono essere max 40 caratteri. I testi primari max 125 caratteri. Le descrizioni max 30 caratteri.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ad_copy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headlines: { type: "array", items: { type: "string" } },
            primaryTexts: { type: "array", items: { type: "string" } },
            descriptions: { type: "array", items: { type: "string" } },
          },
          required: ["headlines", "primaryTexts", "descriptions"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content ?? "{}";
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  try {
    return JSON.parse(content);
  } catch {
    return {
      headlines: ["Scopri il nostro prodotto", "Offerta esclusiva per te", "Trasforma la tua esperienza"],
      primaryTexts: ["Qualità premium al miglior prezzo. Ordina ora e ricevi in 24h.", "Migliaia di clienti soddisfatti. Unisciti a loro oggi.", "Spedizione gratuita su tutti gli ordini. Acquista subito."],
      descriptions: ["Spedizione gratuita", "Garanzia 30 giorni", "Qualità certificata"],
    };
  }
}

// ─── Autonomous Optimization Loop ─────────────────────────────────────────────
export async function runOptimizationCycle(userId: number, goalId: number): Promise<void> {
  const goal = await getGoalById(goalId);
  if (!goal || !goal.agentRunning) return;

  const account = await getMetaAccountById(goal.metaAccountId);
  if (!account?.accessToken) {
    await insertAgentLog({ userId, goalId, actionType: "goal_failed", title: "Account META non configurato", reasoning: "Token di accesso mancante.", impact: "negative", severity: "error" });
    await updateGoal(goalId, { status: "failed", agentRunning: false });
    return;
  }

  const budgetSpent = parseFloat(goal.budgetSpent?.toString() ?? "0");
  const budgetMax = parseFloat(goal.budgetMax.toString());
  const currentValue = parseFloat(goal.currentValue?.toString() ?? "0");
  const targetValue = parseFloat(goal.targetValue.toString());

  // Safety check: budget limit
  if (budgetSpent >= budgetMax * 0.95) {
    await triggerAlert(userId, goalId, "spend_limit_reached", "critical",
      "Limite budget quasi raggiunto",
      `L'agente ha speso €${budgetSpent.toFixed(2)} su €${budgetMax.toFixed(2)} di budget massimo (${((budgetSpent / budgetMax) * 100).toFixed(1)}%). L'agente si ferma per sicurezza.`
    );
    await updateGoal(goalId, { status: "paused", agentRunning: false, agentStoppedAt: new Date() });
    return;
  }

  // Goal completion check
  if (currentValue >= targetValue) {
    await insertAgentLog({ userId, goalId, actionType: "goal_completed", title: `Obiettivo raggiunto: ${goal.title}`, reasoning: `Target di ${targetValue} ${goal.targetUnit} raggiunto con ${currentValue} ${goal.targetUnit}.`, impact: "positive", severity: "info" });
    await updateGoal(goalId, { status: "completed", agentRunning: false, completedAt: new Date() });
    await notifyOwner({ title: "🎯 Obiettivo META Raggiunto!", content: `L'agente AI ha completato l'obiettivo "${goal.title}": ${currentValue}/${targetValue} ${goal.targetUnit} con budget speso €${budgetSpent.toFixed(2)}.` });
    return;
  }

  // Get campaigns and their performance
  const campaigns = await getCampaignsByUserId(userId);
  const goalCampaigns = campaigns.filter(c => c.metaAccountId === goal.metaAccountId && c.status === "ACTIVE");

  if (goalCampaigns.length === 0) {
    await insertAgentLog({ userId, goalId, actionType: "optimization", title: "Nessuna campagna attiva trovata", reasoning: "L'agente non ha trovato campagne attive da ottimizzare.", impact: "neutral", severity: "warning" });
    return;
  }

  // Analyze performance and make decisions
  const performanceData: Array<{ campaignId: number; name: string; kpis: ReturnType<typeof parseInsightKpis> }> = [];

  for (const campaign of goalCampaigns) {
    if (!campaign.metaCampaignId) continue;
    const insights = await getCampaignInsights(campaign.metaCampaignId, account.accessToken, "last_7d");
    if (insights.length > 0) {
      const kpis = parseInsightKpis(insights[0]);
      performanceData.push({ campaignId: campaign.id, name: campaign.name, kpis });
    }
  }

  if (performanceData.length === 0) {
    await insertAgentLog({ userId, goalId, actionType: "optimization", title: "Dati performance non disponibili", reasoning: "Nessun dato insights disponibile per le campagne attive.", impact: "neutral", severity: "info" });
    return;
  }

  // AI decision making
  const aiDecision = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Sei un agente AI Media Buyer autonomo specializzato in META Ads per e-commerce.
Il tuo compito è analizzare le performance delle campagne e prendere decisioni di ottimizzazione.
Rispondi SOLO con JSON valido.`,
      },
      {
        role: "user",
        content: `Analizza queste campagne e decidi le azioni di ottimizzazione:

OBIETTIVO: ${goal.goalType} - Target: ${targetValue} ${goal.targetUnit}
PROGRESSO: ${currentValue}/${targetValue} (${((currentValue / targetValue) * 100).toFixed(1)}%)
BUDGET: €${budgetSpent.toFixed(2)} speso / €${budgetMax.toFixed(2)} massimo

PERFORMANCE CAMPAGNE (ultimi 7 giorni):
${JSON.stringify(performanceData, null, 2)}

Decidi le azioni. Formato JSON:
{
  "actions": [
    {
      "campaignId": number,
      "action": "increase_budget" | "decrease_budget" | "pause" | "keep",
      "budgetChange": number (percentuale, es. 20 per +20%),
      "reasoning": "motivazione breve"
    }
  ],
  "overallAssessment": "valutazione generale",
  "urgentAlerts": ["alert1", "alert2"] 
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "optimization_decision",
        strict: true,
        schema: {
          type: "object",
          properties: {
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  campaignId: { type: "number" },
                  action: { type: "string" },
                  budgetChange: { type: "number" },
                  reasoning: { type: "string" },
                },
                required: ["campaignId", "action", "budgetChange", "reasoning"],
                additionalProperties: false,
              },
            },
            overallAssessment: { type: "string" },
            urgentAlerts: { type: "array", items: { type: "string" } },
          },
          required: ["actions", "overallAssessment", "urgentAlerts"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawDecision = aiDecision.choices[0]?.message?.content ?? "{}";
  const decisionContent = typeof rawDecision === "string" ? rawDecision : JSON.stringify(rawDecision);
  let decision: { actions: Array<{ campaignId: number; action: string; budgetChange: number; reasoning: string }>; overallAssessment: string; urgentAlerts: string[] };

  try {
    decision = JSON.parse(decisionContent);
  } catch {
    return;
  }

  // Execute decisions
  for (const action of decision.actions) {
    const campaign = goalCampaigns.find(c => c.id === action.campaignId);
    if (!campaign) continue;

    if (action.action === "pause" && campaign.metaCampaignId) {
      try {
        await updateMetaAdStatus(campaign.metaCampaignId, account.accessToken, "PAUSED");
        await insertAgentLog({
          userId, goalId, campaignId: campaign.id,
          actionType: "ad_pause",
          title: `Campagna messa in pausa: ${campaign.name}`,
          reasoning: action.reasoning,
          impact: "neutral", severity: "info",
        });
      } catch (e) {
        console.error("Failed to pause campaign:", e);
      }
    } else if (action.action === "increase_budget" || action.action === "decrease_budget") {
      const adSets = await getAdSetsByCampaignId(campaign.id);
      for (const adSet of adSets) {
        if (!adSet.metaAdSetId || !adSet.dailyBudget) continue;
        const currentBudget = parseFloat(adSet.dailyBudget.toString());
        const multiplier = 1 + (action.budgetChange / 100);
        const newBudget = Math.round(currentBudget * multiplier * 100);
        try {
          await updateMetaAdSetBudget(adSet.metaAdSetId, account.accessToken, newBudget);
          await updateAdSet(adSet.id, { dailyBudget: (newBudget / 100).toString() });
          await insertAgentLog({
            userId, goalId, campaignId: campaign.id,
            actionType: action.action === "increase_budget" ? "budget_increase" : "budget_decrease",
            title: `Budget ${action.action === "increase_budget" ? "aumentato" : "ridotto"}: ${campaign.name}`,
            reasoning: action.reasoning,
            actionDetails: { oldBudget: currentBudget, newBudget: newBudget / 100, changePercent: action.budgetChange },
            impact: action.action === "increase_budget" ? "positive" : "neutral",
            severity: "info",
          });
        } catch (e) {
          console.error("Failed to update budget:", e);
        }
      }
    }
  }

  // Handle urgent alerts
  for (const alertMsg of decision.urgentAlerts) {
    await triggerAlert(userId, goalId, "performance_drop", "high", "Alert Performance Agente AI", alertMsg);
  }

  // Log overall optimization cycle
  await insertAgentLog({
    userId, goalId,
    actionType: "optimization",
    title: "Ciclo di ottimizzazione completato",
    reasoning: decision.overallAssessment,
    actionDetails: { actionsExecuted: decision.actions.length, progress: `${currentValue}/${targetValue}` },
    impact: "positive", severity: "info",
  });
}

// ─── Alert System ─────────────────────────────────────────────────────────────
export async function triggerAlert(
  userId: number,
  goalId: number | null,
  alertType: "budget_anomaly" | "performance_drop" | "api_error" | "spend_limit_reached" | "cpa_spike" | "roas_drop" | "ad_rejected" | "account_disabled" | "goal_at_risk",
  severity: "low" | "medium" | "high" | "critical",
  title: string,
  message: string,
  details?: Record<string, unknown>
) {
  await insertAlert({ userId, goalId: goalId ?? undefined, alertType, severity, title, message, details });
  await insertAgentLog({ userId, goalId: goalId ?? undefined, actionType: "alert_triggered", title, reasoning: message, impact: severity === "critical" ? "critical" : "negative", severity: severity === "low" ? "warning" : severity === "medium" ? "warning" : "error" });

  if (severity === "critical" || severity === "high") {
    await notifyOwner({ title: `🚨 Alert ${severity.toUpperCase()}: ${title}`, content: message });
  }
}

// ─── AB Test Evaluation ───────────────────────────────────────────────────────
export async function evaluateAbTest(userId: number, testId: number, variantAAdId: number, variantBAdId: number, accessToken: string): Promise<{ winner: string; confidence: number; reasoning: string }> {
  const adA = await getAdsByAdSetId(variantAAdId);
  const adB = await getAdsByAdSetId(variantBAdId);

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Sei un esperto di A/B testing per META Ads. Analizza i dati e determina il vincitore con significatività statistica. Rispondi in JSON.",
      },
      {
        role: "user",
        content: `Valuta questo A/B test:
Variante A: ${JSON.stringify(adA.slice(0, 3))}
Variante B: ${JSON.stringify(adB.slice(0, 3))}

Rispondi: {"winner": "A" | "B" | "inconclusive", "confidence": 0-100, "reasoning": "spiegazione"}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ab_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            winner: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["winner", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawAbContent = response.choices[0]?.message?.content ?? '{"winner":"inconclusive","confidence":0,"reasoning":"Dati insufficienti"}';
  const abContent = typeof rawAbContent === "string" ? rawAbContent : JSON.stringify(rawAbContent);
  try {
    return JSON.parse(abContent);
  } catch {
    return { winner: "inconclusive", confidence: 0, reasoning: "Errore nell'analisi" };
  }
}
