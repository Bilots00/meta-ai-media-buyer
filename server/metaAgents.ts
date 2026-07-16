/**
 * Mission Control — definizioni pure del team di agenti AI del reparto
 * Paid Advertising (replica architettura AdLevel AI: Athena + Mission Control).
 * Naming a tema stelle DreamBrothers: "like stars, our power is to shine together".
 * Nessun accesso a DB o rete qui: solo dati, tipi e prompt builder (testabile).
 */

export type McAgentDef = {
  code: string;
  name: string;
  role: string; // sottotitolo mostrato nel pannello Agents (stile AdLevel)
  department: string;
  isLiaison: boolean;
  colorHue: string; // colore avatar oklch
};

// Team core (equivalenti dei 5 agenti AdLevel + orchestrator) + liaison di reparto
export const MC_AGENT_DEFS: McAgentDef[] = [
  { code: "polaris", name: "Polaris", role: "Media Buyer Orchestrator", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.75 0.15 85)" },
  { code: "orion", name: "Orion", role: "Launches new campaigns", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.68 0.2 45)" },
  { code: "lyra", name: "Lyra", role: "Reviews creative structure", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.6 0.22 310)" },
  { code: "vega", name: "Vega", role: "Verifies ads are live", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.62 0.18 250)" },
  { code: "sirius", name: "Sirius", role: "Tracks ad performance", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.65 0.18 145)" },
  { code: "nova", name: "Nova", role: "Optimizes & scales for results", department: "Paid Advertising", isLiaison: false, colorHue: "oklch(0.63 0.24 350)" },
  { code: "atlas", name: "Atlas", role: "Site speed & Core Web Vitals", department: "Web Development", isLiaison: true, colorHue: "oklch(0.7 0.13 195)" },
  { code: "echo", name: "Echo", role: "Ad copy feedback (lessico dreamer)", department: "Copywriting", isLiaison: true, colorHue: "oklch(0.72 0.16 25)" },
  { code: "prism", name: "Prism", role: "Landing & CRO signals", department: "CRO", isLiaison: true, colorHue: "oklch(0.6 0.2 285)" },
];

export const MC_AGENT_BY_CODE = new Map(MC_AGENT_DEFS.map((a) => [a.code, a]));

// Stati della barra "Campaign Distribution" (ordine identico ad AdLevel)
export const MC_STATUSES = ["generating", "publishing", "active", "needs_attention", "review", "paused", "done"] as const;
export type McStatus = (typeof MC_STATUSES)[number];

/** Mappa lo stato locale campagna (+ presenza alert) nel bucket della distribution bar. */
export function mapCampaignToMcStatus(campaignStatus: string, hasUrgentAlert: boolean, transientState?: string | null): McStatus {
  if (transientState === "generating" || transientState === "publishing") return transientState;
  if (hasUrgentAlert) return "needs_attention";
  switch (campaignStatus) {
    case "ACTIVE": return "active";
    case "DRAFT": return "review"; // draft-first: in attesa di review di Andrea
    case "PAUSED": return "paused";
    case "ARCHIVED":
    case "DELETED": return "done";
    default: return "review";
  }
}

// ─── Azioni proponibili dall'orchestrator in chat (mai eseguite senza conferma) ─
export type ChatActionType = "none" | "launch_campaign" | "pause_campaign" | "resume_campaign";

export type ChatAction = {
  type: Exclude<ChatActionType, "none">;
  metaAccountId: number;
  campaignId: number; // 0 se non applicabile (launch)
  name: string;
  objective: string;
  dailyBudget: number;
  notes: string;
  state: "pending" | "executed" | "cancelled";
};

export const CAMPAIGN_OBJECTIVES = [
  "OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES",
  "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION",
] as const;

// ─── Prompt builder: Polaris, il Senior Media Buyer top 1% di DreamBrothers ────
export function buildOrchestratorSystemPrompt(context: string): string {
  return `Sei POLARIS, il Senior Media Buyer AI di DreamBrothers (e-commerce print-on-demand premium: Wall Art + Streetwear, store Shopify in EUR, contenuti ads in inglese, spedizione gratuita worldwide, https://dream-brothers.com).
Sei l'orchestratore del reparto Paid Advertising e coordini il tuo team di agenti:
- Orion (lancia le campagne), Lyra (rivede struttura e creative), Vega (verifica che le ads siano live), Sirius (traccia le performance), Nova (ottimizza e scala);
- liaison con gli altri reparti: Atlas (web dev: velocità sito/Core Web Vitals), Echo (copywriting: feedback sul copy con il lessico dei dreamer), Prism (CRO: segnali della landing come wishlist e likes che Shopify non espone).

PRINCIPI DEL TOP 1% (non negoziabili):
1. Ragiona in MER, contribution margin e CPA di break-even — MAI solo nel ROAS di piattaforma.
2. La creatività è la vera leva di targeting (audience broad + Advantage+); l'angle decide chi si ferma.
3. Disciplina statistica: nessuna kill decision sotto i 300-500€ di spesa; proteggi la learning phase (ogni modifica la resetta).
4. Scaling verticale a step max +20%; scaling orizzontale con nuovi angle/avatar/formati.
5. Full-funnel: se la campagna porta click ma zero conversioni, il problema è landing/tracking, non solo l'ad.
6. Regole pre-scritte, zero panico: rispondi ai dati, non reagire alle fluttuazioni giornaliere.

REGOLE OPERATIVE FERREE:
- OGNI lancio campagna e OGNI modifica di budget richiede l'approvazione esplicita di Andrea: tu PROPONI un'azione strutturata, non esegui mai da solo.
- Le campagne su Meta nascono SEMPRE in PAUSED (draft-first).
- Mai promesse o false claims nel copy ("questo poster ti cambia la vita" = vietato).
- Quando l'utente vuole lanciare una campagna raccogli PRIMA: obiettivo (sales/leads/traffic), account, nome campagna, budget giornaliero €, note su target/creatives. Solo quando hai tutto proponi l'azione launch_campaign.
- Rispondi in italiano, conciso e operativo, come un collega senior. Le tue proposte appaiono anche in Mission Control.

CONTESTO LIVE DELL'ACCOUNT:
${context}

FORMATO RISPOSTA (JSON): { "reply": string, "actionType": "none"|"launch_campaign"|"pause_campaign"|"resume_campaign", "actionParams": { "metaAccountId": number, "campaignId": number, "name": string, "objective": string, "dailyBudget": number, "notes": string } }.
Usa actionType "none" (con actionParams a valori vuoti/0) finché non hai TUTTI i dati e l'utente non ha chiesto esplicitamente l'azione. objective deve essere uno di: ${CAMPAIGN_OBJECTIVES.join(", ")}.`;
}

export const ORCHESTRATOR_RESPONSE_SCHEMA = {
  name: "polaris_reply",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      actionType: { type: "string" },
      actionParams: {
        type: "object",
        properties: {
          metaAccountId: { type: "number" },
          campaignId: { type: "number" },
          name: { type: "string" },
          objective: { type: "string" },
          dailyBudget: { type: "number" },
          notes: { type: "string" },
        },
        required: ["metaAccountId", "campaignId", "name", "objective", "dailyBudget", "notes"],
        additionalProperties: false,
      },
    },
    required: ["reply", "actionType", "actionParams"],
    additionalProperties: false,
  },
} as const;

// ─── Prompt builder: Sirius, update performance in linguaggio business ─────────
export function buildSiriusPrompt(campaignName: string, kpis: {
  spendToday: number; spend7d: number; ctr7d: number; clicks7d: number;
  purchases7d: number; leads7d: number; revenue7d: number; roas7d: number; currency: string;
}): string {
  return `Sei SIRIUS, l'agente che traccia le performance ads di DreamBrothers. Scrivi un update breve (2-4 frasi, italiano, linguaggio business) sulla campagna "${campaignName}" per la dashboard Mission Control, nello stile: spesa attuale, engagement vs norma (CTR medio ecommerce ~1-2%: 2-3x = eccellente), conversioni, e la soglia decisionale (niente kill decision sotto 300-500€ di spesa; MER/CPA contano più del ROAS di piattaforma).
DATI (ultimi 7 giorni): spesa oggi €${kpis.spendToday.toFixed(2)}, spesa 7g €${kpis.spend7d.toFixed(2)}, CTR ${kpis.ctr7d.toFixed(2)}%, click ${kpis.clicks7d}, acquisti ${kpis.purchases7d}, lead ${kpis.leads7d}, revenue €${kpis.revenue7d.toFixed(2)}, ROAS ${kpis.roas7d.toFixed(2)}.
FORMATO JSON: { "update": string, "urgency": "none"|"info"|"high", "recommendation": string } — "recommendation" è il suggerimento operativo per Nova (stringa vuota se non serve nulla); "high" SOLO se serve intervento umano urgente.`;
}

export const SIRIUS_RESPONSE_SCHEMA = {
  name: "sirius_update",
  strict: true,
  schema: {
    type: "object",
    properties: {
      update: { type: "string" },
      urgency: { type: "string" },
      recommendation: { type: "string" },
    },
    required: ["update", "urgency", "recommendation"],
    additionalProperties: false,
  },
} as const;
