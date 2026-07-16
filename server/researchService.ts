/**
 * Orchestrazione SEO & Research: refresh delle fonti, dedup, arricchimento LLM,
 * handoff contenuti all'agente (bridge chat esistente, draft-first).
 * Usato dal router tRPC (web app) e dalle route REST (agente VPS).
 */
import {
  insertResearchItemIfNew, getUnenrichedResearchItems, updateResearchItem,
  getAllUserSettings, upsertUserSetting, getResearchItemById,
  ensureResearchTable, insertSocialDraft, getResearchItems,
} from "./db";
import {
  fetchAllResearchSources, enrichResearchItems, researchUrlHash, sanitizeText,
  viralityFromEngagement, fetchRedditComments, extractJson, runResearchLLM,
  DEFAULT_SOURCES, DEFAULT_BRAND_CONTEXT,
  type ResearchSourcesConfig, type FetchedResearchItem, type ResearchSource,
} from "./research";

const ENRICH_BATCH = 12; // item arricchiti dall'LLM per refresh (i più virali)
const COMMENTS_PER_BATCH = 4; // post reddit di cui leggere i commenti a ogni enrich
// Autopilot: genera contenuti da solo se il pezzo è virale, in target e in linea col founder
const AUTOPILOT_MIN_VIRALITY = 8;
const AUTOPILOT_MIN_TARGET = 7;
const AUTOPILOT_MIN_INTEREST = 7;
const AUTOPILOT_MAX_PER_REFRESH = 2;

export async function getResearchConfig(userId: number): Promise<{ sources: ResearchSourcesConfig; brandContext: string; autopilot: boolean }> {
  const s = await getAllUserSettings(userId);
  let sources = DEFAULT_SOURCES;
  if (s.seo_research_sources) {
    try {
      const parsed = JSON.parse(s.seo_research_sources) as Partial<ResearchSourcesConfig>;
      sources = {
        subreddits: Array.isArray(parsed.subreddits) ? parsed.subreddits : DEFAULT_SOURCES.subreddits,
        newsQueries: Array.isArray(parsed.newsQueries) ? parsed.newsQueries : DEFAULT_SOURCES.newsQueries,
        substacks: Array.isArray(parsed.substacks) ? parsed.substacks : DEFAULT_SOURCES.substacks,
        trendsGeo: typeof parsed.trendsGeo === "string" && parsed.trendsGeo ? parsed.trendsGeo : DEFAULT_SOURCES.trendsGeo,
        pinterestInterestIds: Array.isArray(parsed.pinterestInterestIds) ? parsed.pinterestInterestIds : DEFAULT_SOURCES.pinterestInterestIds,
      };
    } catch {
      // JSON corrotto: si riparte dai default
    }
  }
  return { sources, brandContext: s.seo_brand_context || DEFAULT_BRAND_CONTEXT, autopilot: s.seo_autopilot === "true" };
}

export async function saveResearchConfig(userId: number, cfg: { sources?: ResearchSourcesConfig; brandContext?: string; autopilot?: boolean }): Promise<void> {
  if (cfg.sources) await upsertUserSetting(userId, "seo_research_sources", JSON.stringify(cfg.sources));
  if (cfg.brandContext != null) await upsertUserSetting(userId, "seo_brand_context", cfg.brandContext);
  if (cfg.autopilot != null) await upsertUserSetting(userId, "seo_autopilot", String(cfg.autopilot));
}

/** Scrive gli item (dedup su urlHash); resiliente per-item, raccoglie gli errori DB. */
export async function storeResearchItems(userId: number, items: FetchedResearchItem[]): Promise<{ stored: number; errors: string[] }> {
  let stored = 0;
  const errors: string[] = [];
  for (const it of items) {
    const title = sanitizeText(it.title, 500);
    if (!title) continue;
    // TIMESTAMP MySQL accetta solo date valide nel range 1970-2038
    const t = it.publishedAt instanceof Date ? it.publishedAt.getTime() : NaN;
    const publishedAt = Number.isFinite(t) && t > 0 && t < 2_140_000_000_000 ? it.publishedAt! : null;
    try {
      // TUTTE le colonne esplicite (niente keyword DEFAULT nell'INSERT: TiDB in
      // produzione può rifiutarla dove MySQL la accetta — unica differenza
      // strutturale rispetto agli insert watchlist che funzionano)
      const isNew = await insertResearchItemIfNew({
        userId,
        source: it.source,
        sourceDetail: sanitizeText(it.sourceDetail, 191) ?? null,
        title,
        url: it.url ? sanitizeText(it.url, 2000) : null,
        urlHash: researchUrlHash(it.url, it.title),
        excerpt: sanitizeText(it.excerpt, 1500) ?? null,
        bodyText: sanitizeText(it.fullText, 60_000) ?? null,
        brief: null,
        angle: null,
        commentAnalysis: null,
        viralityScore: Number.isFinite(it.viralityScore) ? it.viralityScore : 5,
        targetScore: null,
        interestScore: null,
        engagement: Number.isFinite(it.engagement) ? it.engagement : 0,
        status: "da_leggere",
        country: (it.country && /^[A-Za-z]{2,8}$/.test(it.country) ? it.country.toUpperCase() : "GLOBAL"),
        publishedAt,
        enrichedAt: null,
        fetchedAt: new Date(),
        createdAt: new Date(),
      });
      if (isNew) stored++;
    } catch (err) {
      // un item malformato non deve far fallire l'intero refresh.
      // Drizzle incapsula l'errore MySQL reale in err.cause: è QUELLO il messaggio utile
      const cause = (err as { cause?: { message?: string; code?: string; sqlMessage?: string } })?.cause;
      const m = cause?.sqlMessage || cause?.message
        || (err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : String(err));
      if (!errors.some((e) => e === m)) errors.push(m);
    }
  }
  if (errors.length) console.warn(`[research] errori insert (${errors.length} distinti):`, errors.slice(0, 3));
  return { stored, errors };
}

/** Arricchisce con l'LLM gli item più virali non ancora valutati (+ commenti Reddit). */
export async function enrichPendingResearch(userId: number, limit = ENRICH_BATCH): Promise<{ enriched: number; items: Array<{ id: number; targetScore: number; interestScore: number }> }> {
  const { brandContext } = await getResearchConfig(userId);
  const pending = await getUnenrichedResearchItems(userId, limit);
  if (pending.length === 0) return { enriched: 0, items: [] };

  // commenti in evidenza per i primi post Reddit del batch (best effort, con pausa anti-429)
  const commentsById = new Map<number, string[]>();
  const redditItems = pending.filter((p) => p.source === "reddit" && p.url).slice(0, COMMENTS_PER_BATCH);
  for (let i = 0; i < redditItems.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      commentsById.set(redditItems[i].id, await fetchRedditComments(redditItems[i].url!));
    } catch {
      // niente commenti: non è bloccante
    }
  }

  const results = await enrichResearchItems(
    pending.map((p) => ({ id: p.id, title: p.title, excerpt: p.excerpt, source: p.source, comments: commentsById.get(p.id) })),
    brandContext
  );
  await applyEnrichmentResults(results);
  return { enriched: results.length, items: results.map((r) => ({ id: r.id, targetScore: r.targetScore, interestScore: r.interestScore })) };
}

/** Scrive i risultati di un arricchimento (dal server o dall'agente VPS Claude). */
export async function applyEnrichmentResults(
  results: Array<{ id: number; targetScore: number; interestScore: number; brief?: string; angle?: string; commentAnalysis?: string; engagement?: number }>
): Promise<number> {
  let applied = 0;
  for (const r of results) {
    if (typeof r.id !== "number") continue;
    const engagement = Number(r.engagement);
    await updateResearchItem(r.id, {
      targetScore: Math.max(0, Math.min(10, Math.round(Number(r.targetScore ?? 0)))),
      interestScore: Math.max(0, Math.min(10, Math.round(Number(r.interestScore ?? 0)))),
      brief: sanitizeText(r.brief, 2000) ?? null,
      angle: sanitizeText(r.angle, 2000) ?? null,
      ...(r.commentAnalysis ? { commentAnalysis: sanitizeText(r.commentAnalysis, 2000) ?? null } : {}),
      // l'agente può leggere l'engagement reale (upvote+commenti): aggiorna anche la viralità
      ...(Number.isFinite(engagement) && engagement > 0
        ? { engagement: Math.round(engagement), viralityScore: viralityFromEngagement(Math.round(engagement)) }
        : {}),
      enrichedAt: new Date(),
    });
    applied++;
  }
  return applied;
}

/** Refresh completo: fetch fonti → store → arricchimento LLM del top. */
export async function refreshResearch(userId: number): Promise<{ fetched: number; stored: number; enriched: number; autoGenerated: number; errors: string[]; dbError?: string }> {
  // Assicura la tabella PRIMA di tutto: se manca (o il CREATE fallisce) è QUESTA la causa
  const table = await ensureResearchTable();
  if (!table.ok) {
    return { fetched: 0, stored: 0, enriched: 0, autoGenerated: 0, errors: [`DB: ${table.error}`], dbError: `Creazione tabella fallita: ${table.error}` };
  }
  const { sources, autopilot } = await getResearchConfig(userId);
  const { items, errors } = await fetchAllResearchSources(sources);
  const { stored, errors: insertErrors } = await storeResearchItems(userId, items);
  // se il fetch ha portato item ma NON se ne salva nessuno, l'errore DB è la causa vera
  const dbError = stored === 0 && items.length > 0 && insertErrors.length > 0 ? insertErrors[0] : undefined;
  for (const e of insertErrors) errors.push(`DB: ${e}`);
  let enriched = 0;
  let autoGenerated = 0;
  try {
    const enrichResult = await enrichPendingResearch(userId);
    enriched = enrichResult.enriched;
    if (autopilot && enrichResult.items.length > 0) {
      autoGenerated = await runAutopilot(userId, enrichResult.items);
    }
  } catch (err) {
    errors.push(`AI: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { fetched: items.length, stored, enriched, autoGenerated, errors, dbError };
}

/** Ingest dall'agente VPS (Gmail/newsletter/fonti custom). */
export async function ingestResearchItems(
  userId: number,
  items: Array<{
    source?: string; sourceDetail?: string; country?: string; title?: string; url?: string;
    excerpt?: string; fullText?: string; engagement?: number; publishedAt?: string | Date;
  }>
): Promise<number> {
  const valid: FetchedResearchItem[] = items
    .filter((i) => i.title)
    .map((i) => {
      const engagement = Number(i.engagement ?? 0);
      const source = (["reddit", "news", "trends", "substack", "pinterest", "gmail", "manual"] as ResearchSource[])
        .includes(i.source as ResearchSource) ? (i.source as ResearchSource) : "manual";
      return {
        source,
        sourceDetail: i.sourceDetail,
        country: i.country,
        title: String(i.title).slice(0, 500),
        url: i.url,
        excerpt: i.excerpt?.slice(0, 1500),
        fullText: i.fullText?.slice(0, 60_000),
        viralityScore: viralityFromEngagement(engagement),
        engagement,
        publishedAt: i.publishedAt ? new Date(i.publishedAt) : undefined,
      };
    });
  const { stored } = await storeResearchItems(userId, valid);
  return stored;
}

/**
 * Generazione contenuti SERVER-SIDE (niente dipendenza dall'agente VPS): crea
 * subito le bozze in social_drafts, verificabili nella pagina Bozze.
 * Guardrail anti-traffico-freddo: si parte SEMPRE dall'angle del brand.
 */
export async function generateContentFromResearch(
  userId: number,
  itemId: number,
  formats: Array<"blog" | "x" | "facebook">
): Promise<{ ok: boolean; draftIds?: number[]; error?: string }> {
  const item = await getResearchItemById(itemId);
  if (!item || item.userId !== userId) return { ok: false, error: "Item non trovato" };
  const { brandContext } = await getResearchConfig(userId);
  const wanted = formats.length ? formats : ["blog", "x", "facebook"];

  const systemPrompt = `Sei il SEO & Content Specialist di questo brand:
${brandContext}

REGOLA VINCOLANTE (anti-traffico-freddo): NON commentare la notizia da divulgatore. Usa la notizia solo come aggancio: il contenuto deve partire dalla CHIAVE DI LETTURA del brand, parlare alla buyer persona con il tone of voice del brand e nutrire il posizionamento. Scrivi in italiano.

Genera SOLO i formati richiesti. Rispondi SOLO con JSON valido:
{
 "blog": {"title": string (titolo SEO con keyword principale), "metaDescription": string (max 155 char), "keywords": string (keyword separate da virgola), "html": string (articolo 800-1200 parole in HTML: <h2>, <h3>, <p>, <ul>; NO <html>/<head>/<body>)},
 "x": {"text": string (max 270 caratteri, hook forte nella prima riga, 1-2 hashtag)},
 "facebook": {"text": string (taglio conversazionale, storytelling breve, domanda di engagement finale, 2-3 hashtag)}
}
Ometti i formati non richiesti.`;
  const userPrompt = `Formati richiesti: ${wanted.join(", ")}

NOTIZIA/TREND DI PARTENZA
Fonte: ${item.source}${item.sourceDetail ? ` · ${item.sourceDetail}` : ""}
Titolo: ${item.title}
${item.brief ? `Brief: ${item.brief}` : ""}
${item.angle ? `CHIAVE DI LETTURA BRAND (da cui partire): ${item.angle}` : ""}
${item.commentAnalysis ? `Linguaggio della conversazione: ${item.commentAnalysis}` : ""}
${item.excerpt ? `Estratto: ${item.excerpt.slice(0, 600)}` : ""}`;

  const content = await runResearchLLM(systemPrompt, userPrompt);
  const parsed = extractJson<{
    blog?: { title?: string; metaDescription?: string; keywords?: string; html?: string };
    x?: { text?: string };
    facebook?: { text?: string };
  }>(content);
  if (!parsed) return { ok: false, error: `Risposta AI non interpretabile (${content.slice(0, 100)})` };

  const draftIds: number[] = [];
  const sourceUrl = item.url ?? null;
  if (wanted.includes("blog") && parsed.blog?.html) {
    draftIds.push(await insertSocialDraft({
      userId, platform: "shopify_blog", format: "blog",
      title: sanitizeText(parsed.blog.title, 255) ?? item.title.slice(0, 255),
      caption: sanitizeText(`${parsed.blog.html}\n\n<!-- META DESCRIPTION: ${parsed.blog.metaDescription ?? ""} -->`, 60_000) ?? "",
      hashtags: sanitizeText(parsed.blog.keywords, 1000) ?? null,
      sourceUrl, createdBy: "ai", status: "draft", notes: `Da Research Hub #${item.id} — ${item.sourceDetail ?? item.source}`,
    }));
  }
  if (wanted.includes("x") && parsed.x?.text) {
    draftIds.push(await insertSocialDraft({
      userId, platform: "x", format: "post",
      title: sanitizeText(`X: ${item.title}`, 255) ?? null,
      caption: sanitizeText(parsed.x.text, 2000) ?? "",
      sourceUrl, createdBy: "ai", status: "draft", notes: `Da Research Hub #${item.id}`,
    }));
  }
  if (wanted.includes("facebook") && parsed.facebook?.text) {
    draftIds.push(await insertSocialDraft({
      userId, platform: "facebook", format: "post",
      title: sanitizeText(`FB: ${item.title}`, 255) ?? null,
      caption: sanitizeText(parsed.facebook.text, 5000) ?? "",
      sourceUrl, createdBy: "ai", status: "draft", notes: `Da Research Hub #${item.id}`,
    }));
  }
  if (draftIds.length === 0) return { ok: false, error: "L'AI non ha prodotto nessuno dei formati richiesti" };
  await updateResearchItem(itemId, { status: "usato" });
  return { ok: true, draftIds };
}

/** Autopilot: genera contenuti dai pezzi appena arricchiti che superano le soglie. */
async function runAutopilot(userId: number, enrichedItems: Array<{ id: number; targetScore: number; interestScore: number }>): Promise<number> {
  let generated = 0;
  for (const e of enrichedItems) {
    if (generated >= AUTOPILOT_MAX_PER_REFRESH) break;
    if (e.targetScore < AUTOPILOT_MIN_TARGET || e.interestScore < AUTOPILOT_MIN_INTEREST) continue;
    const item = await getResearchItemById(e.id);
    if (!item || item.viralityScore < AUTOPILOT_MIN_VIRALITY || item.status !== "da_leggere") continue;
    try {
      const r = await generateContentFromResearch(userId, e.id, ["blog", "x", "facebook"]);
      if (r.ok) generated++;
    } catch (err) {
      console.warn("[research] autopilot generate fallito:", err);
    }
  }
  return generated;
}
