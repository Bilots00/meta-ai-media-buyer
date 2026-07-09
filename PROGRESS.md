# PROGRESS.md — Audit log · build "SMM Agent + Shopify Embed"

> Log cronologico di OGNI modifica ai file e OGNI chiamata API rilevante per il progetto di automazione Marketing/SEO di DreamBrothers.
> **Repo web app:** `Bilots00/meta-ai-media-buyer` — deploy **Railway** a ogni push su `main`.
> **Company Brain** (conoscenza brand): `E:\IDriveLocal\ALL FILES -Cloud-Drive_andrea.bilotta00@gmail.com\E-commerce\DreamBrothers Brain`
> Costituzione: `CLAUDE.md` (Brain) · Mappa: `HOME.md` · AI OS: `self/ai-os.md` · Lavagna task: `areas/comando/task-audit.md`

## Convenzioni (always-do)
- **Draft first** — niente pubblicato (post, prodotti, sconti, invii) senza review di Andrea. Contenuti generati → tabella `social_drafts`.
- **Branch di lavoro** — tutto su `feat/smm-agent`; merge su `main` (= deploy Railway) solo ai checkpoint approvati.
- **Segreti in env** — token/chiavi solo in variabili d'ambiente (Railway Variables · `.env` locale git-ignored · env del VPS). MAI nel repo.
- **Vendite vere** — numeri solo da gateway reali (Shopify Payments/PayPal); esclusi ordini test/draft/manual.
- **Brand voice** — prima di ogni copy passa dal reparto Copywriting del Brain (regole anti-AI, lessico dreamer, un avatar).

## Roadmap (5 fasi) — dettaglio in `AGENTS.md` → sez. "DreamBrothers SMM Agent + Shopify Embed"
`Fase 0` Fondamenta · `Fase 1` Chat unificata web+Telegram · `Fase 2` Knowledge base · `Fase 3` Embed Shopify · `Fase 4` Skill video (Higgsfield)

---

## Log

### 2026-07-09 — Fase 0 (Fondamenta)
**Decisioni approvate (Andrea):** ordine consigliato; chat unificata web+Telegram (Claude Cowork = link/scorciatoia, non specchio live).

**Ricerca (agenti):**
- La social chat della web app usa già un **bridge DB**, non un modello server-side: la UI scrive in `social_chat_messages` (`role:user, status:new`), un agente Claude esterno fa polling di `GET /api/social/pending` e risponde su `POST /api/social/reply` (auth: header `CARE_WEBHOOK_SECRET`; utente unico `OWNER_USER_ID=1`). Telegram **assente** → punto d'innesto pronto.
- Shopify: l'embed in admin richiede una **vera app** (Dev Dashboard) con App Bridge + header CSP `frame-ancestors https://<shop>.myshopify.com https://admin.shopify.com` — NON la "custom app" da *Develop apps* (che dà solo token API).
- Video YouTube (RwAlED_68Ao, R. Belli Contarini): MCP **Higgsfield (Xfield)** + 4 skill (`setup-xfield-project`, `product-to-ad`, `url-to-ad`, `ig-carousel`) — **già installate/collegate** in sessione (`higgsfield-cowork-pack` + MCP Higgsfield).

**Modifiche:**
- Creato branch `feat/smm-agent`.
- Creato `PROGRESS.md` (questo file).
- Esteso `AGENTS.md` (sezione "DreamBrothers SMM Agent + Shopify Embed").
- Aggiornato `CLAUDE.md` (puntatori a PROGRESS/AGENTS).
- Brain: creato `scripts/brain-autosync.ps1` + task `DreamBrothers_Brain_AutoSync` (commit+push ogni 15 min se ci sono modifiche; log in `%LOCALAPPDATA%\DreamBrothers`). ✅ collaudato (push OK).

### 2026-07-09 — Fase 1 (Chat unificata web+Telegram) — modifiche web app [su branch, non ancora deployate]
**Scoperta VPS:** il poller esiste già (`claude-bot-workspace/social-agent/social_agent.py` + `~/.social-agent.env`: `CARE_WEBHOOK_SECRET`, `SOCIAL_BASE_URL`, poll, modello) ma è **spento** (non installato come servizio; nel log un vecchio crash `Connection reset`). Il bot Telegram generale `claude-bot.service` gira. Web app **ONLINE** (HTTP 200), secret OK, systemPrompt SMM già configurato (organic-first, @gernucci, HyperDopamine).
**Modifiche web app (`feat/smm-agent`, +59/-7, typecheck pulito sui file toccati):**
- `drizzle/schema.ts` + `server/_core/index.ts`: colonna `source` (`web`|`telegram`) su `social_chat_messages` + migrazione additiva **idempotente** al boot (guardia su information_schema).
- `server/db.ts`: `getPendingSocialChat` restituisce `source`; `recordSocialChatReply` accetta `replyToId`/`source` → marca il singolo messaggio (niente race web/telegram).
- `server/_core/socialRoutes.ts`: nuovo `POST /api/social/ingest` (secret) per iniettare i messaggi Telegram nello **stesso** thread; `/reply` accetta `replyToId`/`source`.
- `server/routers.ts`: `chatList` espone `source` alla UI.
**Nota deploy VPS:** `claude-bot-workspace` è **pull-only** (deploy key read-only; cron sync ogni 5 min + keepalive social-agent ogni 1 min). Le modifiche a `social_agent.py` si pushano da PC → `git pull` sul VPS.
**In attesa di GO go-live:** (1) merge `feat/smm-agent`→`main` = deploy Railway; (2) aggiornare `social_agent.py` (listener Telegram `db_smm_bot` + gestione `source`); (3) token bot in `~/.social-agent.env`; (4) accendere il social-agent.
