import type { Express, Request, Response } from "express";
import {
  createClaudeSession,
  getClaudeSessionById,
  findClaudeSessionByExternalId,
  getClaudeSessions,
  getClaudeSessionMessages,
  insertClaudeMessage,
  getPendingClaudeMessages,
  getClaudeAttachmentsForMessages,
  recordClaudeReply,
  updateClaudeSession,
  getClaudeAttachmentById,
  insertClaudeAttachment,
  attachClaudeAttachmentsToMessage,
  updateClaudeMessageText,
  updateClaudeAttachmentTranscript,
  getClaudeMessageById,
  getAllUserSettings,
  upsertUserSetting,
} from "../db";

// Claude Sessions endpoints — gemello di socialRoutes.ts, stesso modello
// "agente-primario": la web app scrive i messaggi dell'owner (via tRPC), l'agente
// Claude (VPS o locale) fa polling su /api/claude/pending e risponde via
// /api/claude/reply. In più, Claude Code importa/esporta interi transcript via
// /api/claude/session usando externalId come chiave stabile per l'upsert.
// Server-to-server protetto dallo stesso CARE_WEBHOOK_SECRET: un solo segreto.
const CLAUDE_AGENT_ONLINE_MS = 120_000;
const OWNER_USER_ID = 1;

function checkSecret(req: Request, res: Response): boolean {
  const expected = process.env.CARE_WEBHOOK_SECRET;
  if (!expected) {
    res.status(503).json({ error: "CARE_WEBHOOK_SECRET not configured on the server" });
    return false;
  }
  if (req.headers["x-care-secret"] !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// Il titolo di default nasce dal primo messaggio: stessa regola lato tRPC e REST,
// così una sessione creata da mobile e una creata da Claude Code si somigliano.
function titleFromText(text: string): string {
  const flat = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "Nuova sessione";
  return flat.length > 60 ? flat.slice(0, 59) + "…" : flat;
}

export function registerClaudeRoutes(app: Express) {
  // Agente Claude -> messaggi dell'owner ancora da gestire (tutte le sessioni)
  app.get("/api/claude/pending", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
      const pending = await getPendingClaudeMessages(limit);
      // Gli allegati viaggiano col messaggio: l'agente deve poter vedere che c'e'
      // un vocale da trascrivere (e con che id) senza una seconda chiamata.
      const atts = await getClaudeAttachmentsForMessages(pending.map((m) => m.messageId));
      const byMsg = new Map<number, typeof atts>();
      for (const a of atts) {
        if (a.messageId == null) continue;
        const list = byMsg.get(a.messageId) ?? [];
        list.push(a);
        byMsg.set(a.messageId, list);
      }
      const messages = pending.map((m) => ({
        ...m,
        attachments: (byMsg.get(m.messageId) ?? []).map((a) => ({
          id: a.id, filename: a.filename, mimeType: a.mimeType,
          kind: a.kind, transcript: a.transcript,
          url: `/api/claude/attachment/${a.id}`,
        })),
      }));
      res.json({ success: true, count: messages.length, messages });
    } catch (err) {
      console.warn("[claude/pending] error:", err);
      res.status(500).json({ error: "pending failed" });
    }
  });

  // Claude Code (session-import) -> i turni di una sessione, per riprendere il filo.
  // ?since=<ISO> filtra i turni successivi all'ultimo export locale.
  app.get("/api/claude/session/:id/messages", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid session id" });
        return;
      }
      const session = await getClaudeSessionById(id);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      const limit = Math.min(parseInt(String(req.query.limit ?? "500"), 10) || 500, 1000);
      let messages = await getClaudeSessionMessages(id, limit);
      const since = req.query.since ? new Date(String(req.query.since)) : null;
      if (since && !Number.isNaN(since.getTime())) {
        messages = messages.filter((m) => new Date(m.createdAt).getTime() > since.getTime());
      }
      res.json({
        success: true,
        session: { id: session.id, title: session.title, externalId: session.externalId, status: session.status },
        count: messages.length,
        messages,
      });
    } catch (err) {
      console.warn("[claude/session/messages] error:", err);
      res.status(500).json({ error: "messages failed" });
    }
  });

  // Agente / Claude Code -> elenco sessioni, con ricerca ?q=
  app.get("/api/claude/sessions", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const includeArchived = String(req.query.includeArchived ?? "") === "true";
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 200);
      const sessions = await getClaudeSessions(OWNER_USER_ID, { q, includeArchived, limit });
      res.json({ success: true, count: sessions.length, sessions });
    } catch (err) {
      console.warn("[claude/sessions] error:", err);
      res.status(500).json({ error: "sessions failed" });
    }
  });

  // Agente Claude -> pubblica la risposta nella sessione
  app.post("/api/claude/reply", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { sessionId, text, replyToId, source } = req.body ?? {};
      if (!sessionId || !text) {
        res.status(400).json({ error: "sessionId and text are required" });
        return;
      }
      const session = await getClaudeSessionById(Number(sessionId));
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      const messageId = await recordClaudeReply({
        sessionId: Number(sessionId),
        userId: OWNER_USER_ID,
        text: String(text),
        replyToId: replyToId != null ? Number(replyToId) : undefined,
        source: source ? String(source) : undefined,
      });
      // Risposta vocale: l'agente ha gia' caricato l'audio e passa qui il suo id.
      const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds.map(Number) : [];
      if (attachmentIds.length) await attachClaudeAttachmentsToMessage(attachmentIds, messageId, OWNER_USER_ID);
      res.json({ success: true, messageId, sessionId: Number(sessionId) });
    } catch (err) {
      console.warn("[claude/reply] error:", err);
      res.status(500).json({ error: "reply failed" });
    }
  });

  // Superficie esterna (bot Telegram) -> inietta un messaggio owner in una sessione.
  // Risolve per sessionId o externalId; se manca tutto, apre una sessione nuova.
  // Ritorna SEMPRE sessionId così il chiamante può continuare il thread.
  app.post("/api/claude/ingest", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { text, sessionId, externalId, title, source } = req.body ?? {};
      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const src = source ? String(source) : "telegram";
      let resolvedId: number | null = null;

      if (sessionId != null) {
        const existing = await getClaudeSessionById(Number(sessionId));
        if (!existing) {
          res.status(404).json({ error: "session not found" });
          return;
        }
        resolvedId = existing.id;
      } else if (externalId) {
        const existing = await findClaudeSessionByExternalId(OWNER_USER_ID, String(externalId));
        resolvedId = existing
          ? existing.id
          : await createClaudeSession({
              userId: OWNER_USER_ID,
              title: title ? String(title) : titleFromText(String(text)),
              source: src,
              externalId: String(externalId),
            });
      } else {
        resolvedId = await createClaudeSession({
          userId: OWNER_USER_ID,
          title: title ? String(title) : titleFromText(String(text)),
          source: src,
        });
      }

      const messageId = await insertClaudeMessage({
        sessionId: resolvedId,
        userId: OWNER_USER_ID,
        role: "user",
        text: String(text),
        source: src,
        status: "new",
      });
      res.json({ success: true, messageId, sessionId: resolvedId });
    } catch (err) {
      console.warn("[claude/ingest] error:", err);
      res.status(500).json({ error: "ingest failed" });
    }
  });

  // Claude Code (session-export) -> upsert della sessione per externalId + import
  // bulk del transcript. I messaggi arrivano già "handled": sono storia, non lavoro
  // da fare, quindi l'agente non deve rispondere.
  app.post("/api/claude/session", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { externalId, title, source, messages } = req.body ?? {};
      if (!externalId && !title) {
        res.status(400).json({ error: "externalId or title is required" });
        return;
      }
      const src = source ? String(source) : "code";
      const existing = externalId
        ? await findClaudeSessionByExternalId(OWNER_USER_ID, String(externalId))
        : undefined;

      let sessionId: number;
      if (existing) {
        sessionId = existing.id;
        if (title && title !== existing.title) {
          await updateClaudeSession(sessionId, { title: String(title) });
        }
      } else {
        sessionId = await createClaudeSession({
          userId: OWNER_USER_ID,
          title: title ? String(title) : String(externalId),
          source: src,
          externalId: externalId ? String(externalId) : null,
        });
      }

      let inserted = 0;
      if (Array.isArray(messages)) {
        for (const m of messages) {
          if (!m?.text) continue;
          const role = m.role === "assistant" || m.role === "system" ? m.role : "user";
          const createdAt = m.createdAt ? new Date(m.createdAt) : undefined;
          await insertClaudeMessage({
            sessionId,
            userId: OWNER_USER_ID,
            role,
            text: String(m.text),
            source: m.source ? String(m.source) : src,
            status: "handled",
            ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}),
          });
          inserted++;
        }
      }
      res.json({ success: true, sessionId, inserted, created: !existing });
    } catch (err) {
      console.warn("[claude/session] error:", err);
      res.status(500).json({ error: "session upsert failed" });
    }
  });

  // Download di un allegato. L'app e' single-user senza login (vedi context.ts:
  // ogni richiesta e' gia' admin), quindi qui non c'e' un livello di auth in piu'
  // da applicare: stessa postura del resto dell'app. Serve al browser per mostrare
  // immagini/audio e all'agente per scaricare i file che Andrea allega.
  app.get("/api/claude/attachment/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid attachment id" });
        return;
      }
      const att = await getClaudeAttachmentById(id);
      if (!att) {
        res.status(404).json({ error: "attachment not found" });
        return;
      }
      res.setHeader("Content-Type", att.mimeType);
      res.setHeader("Content-Length", String(att.size));
      // inline: immagini e audio devono potersi aprire dentro la pagina
      const disp = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disp}; filename="${att.filename.replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.send(att.data);
    } catch (err) {
      console.warn("[claude/attachment] error:", err);
      res.status(500).json({ error: "attachment failed" });
    }
  });

  // Agente -> carica un allegato (tipicamente il vocale di risposta generato con
  // edge-tts sul VPS). Stesso giro del bot Telegram: se Andrea scrive col vocale,
  // l'agente risponde col vocale.
  app.post("/api/claude/attachment", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { sessionId, messageId, filename, mimeType, kind, transcript, dataBase64 } = req.body ?? {};
      if (!sessionId || !filename || !dataBase64) {
        res.status(400).json({ error: "sessionId, filename and dataBase64 are required" });
        return;
      }
      const data = Buffer.from(String(dataBase64), "base64");
      if (data.length > 15 * 1024 * 1024) {
        res.status(413).json({ error: "attachment too large (max 15MB)" });
        return;
      }
      const id = await insertClaudeAttachment({
        userId: OWNER_USER_ID,
        sessionId: Number(sessionId),
        messageId: messageId != null ? Number(messageId) : null,
        filename: String(filename),
        mimeType: String(mimeType || "application/octet-stream"),
        kind: (kind === "voice" || kind === "image" ? kind : "file") as "voice" | "image" | "file",
        transcript: transcript ? String(transcript) : null,
        data,
      });
      res.json({ success: true, id, url: `/api/claude/attachment/${id}` });
    } catch (err) {
      console.warn("[claude/attachment upload] error:", err);
      res.status(500).json({ error: "upload failed" });
    }
  });

  // Agente -> rimanda la trascrizione di un vocale (Whisper gira sul VPS, dove
  // c'e' OPENAI_API_KEY). Sostituisce il placeholder nel messaggio, cosi' nella
  // chat si legge cosa e' stato detto invece di "[senza trascrizione]".
  app.post("/api/claude/transcription", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { messageId, attachmentId, transcript } = req.body ?? {};
      if (!transcript) {
        res.status(400).json({ error: "transcript is required" });
        return;
      }
      const text = String(transcript).trim();
      if (attachmentId != null) await updateClaudeAttachmentTranscript(Number(attachmentId), text);
      if (messageId != null) {
        const msg = await getClaudeMessageById(Number(messageId));
        if (msg) {
          // Tiene la coda "[allegati] …" e sostituisce solo la parte parlata.
          const rest = msg.text.includes("[allegati]") ? msg.text.slice(msg.text.indexOf("[allegati]")) : "";
          await updateClaudeMessageText(Number(messageId), rest ? `${text}\n\n${rest}` : text);
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.warn("[claude/transcription] error:", err);
      res.status(500).json({ error: "transcription failed" });
    }
  });

  // Agente Claude -> heartbeat, così la web app mostra il pallino "online"
  app.post("/api/claude/heartbeat", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      await upsertUserSetting(OWNER_USER_ID, "claude_agent_last_seen", String(Date.now()));
      res.json({ success: true });
    } catch (err) {
      console.warn("[claude/heartbeat] error:", err);
      res.status(500).json({ error: "heartbeat failed" });
    }
  });

  // Agente -> config runtime + stato agente
  app.get("/api/claude/config", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const s = await getAllUserSettings(OWNER_USER_ID);
      const lastSeen = Number(s.claude_agent_last_seen ?? 0);
      res.json({
        success: true,
        ownerUserId: OWNER_USER_ID,
        systemPrompt: s.claude_system_prompt || "",
        agentOnline: lastSeen > 0 && Date.now() - lastSeen < CLAUDE_AGENT_ONLINE_MS,
        agentLastSeen: lastSeen || null,
      });
    } catch (err) {
      console.warn("[claude/config] error:", err);
      res.status(500).json({ error: "config failed" });
    }
  });
}
