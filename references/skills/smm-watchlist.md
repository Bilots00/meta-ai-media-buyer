# Skill agente VPS — Watchlist (replica Sandcastles, API interna gratuita)

> Da copiare/adattare in `claude-bot-workspace/skills/` sul VPS (o incollare nel
> `social_system_prompt`). Dà al Social Media Manager AI gli stessi superpoteri
> delle skill Sandcastles di Kallaway, ma sulla **nostra** API: zero crediti, zero abbonamenti.

## API (stessa auth del bridge social: header `x-care-secret: $CARE_WEBHOOK_SECRET`)

Base URL: `$SOCIAL_BASE_URL` (prod: `https://meta-ai-media-buyer-production.up.railway.app`)

| Endpoint | Equivalente Sandcastles | Note |
|---|---|---|
| `GET /api/social/watchlist/channels` | lista watchlist | id, platform, handle, followers, status, last_error |
| `GET /api/social/watchlist/videos?lookback_days=7&limit=25&min_outlier_score=0&min_views=0&platform=&channel_id=&sort=views\|outlier\|recent` | `search_my_videos` | ritorna `videos[]` con `title, platform_url, view_count, like_count, comment_count, engagement_rate, outlier_score, published_at, analyzed, channel.handle` |
| `POST /api/social/watchlist/channels` body `{input, platform?}` | `add_channels_to_watchlist` | input = URL o @handle; platform serve solo per handle nudi |
| `POST /api/social/watchlist/refresh` body `{channelId?}` | — | vuoto = tutti i canali; da schedulare 1x/giorno |
| `POST /api/social/watchlist/ingest` body `{platform, handle, displayName?, avatarUrl?, followers?, videos:[{platformVideoId, url, title?, thumbnailUrl?, publishedAt?, views, likes?, comments?, shares?, durationSec?}]}` | — | **fallback scraping**: quando Railway non riesce a leggere Instagram/TikTok, scrapea TU (hai browser/strumenti) e spingi i dati qui. L'outlier score viene ricalcolato automaticamente |
| `POST /api/social/watchlist/analysis` body `{url \| videoId, analysis:{...}}` | `analyze_video` (salvataggio) | salva la tua deep-analysis sul video |

**Outlier score** = views del video ÷ mediana views del canale (finestra 90gg). 1.0x = baseline del canale; ≥2x = breakout.

## Task 1 — Outlier pulse giornaliero (7:00, replica "watchlist-outliers")

1. `GET /api/social/watchlist/videos?lookback_days=7&limit=10&min_outlier_score=1&sort=outlier`
2. Ordina per `outlier_score` decrescente (pareggi: `view_count`).
3. Rispondi in chat (`POST /api/social/reply`) con:

```
Watchlist outliers (1x+) — ultimi 7 giorni, per outlier score:

1. [2.4x · 136K views] Titolo max 80 caratteri — @handle
   https://…
2. …
```

4. Se lista vuota: "Nessun video sopra 1x negli ultimi 7 giorni" + proponi di allargare la finestra. Non inventare risultati.

## Task 2 — Feed completo (replica "watchlist-all-recent")

Come Task 1 ma `min_outlier_score=0&limit=25&sort=recent`, ordina per `published_at` (più recente prima), includi data + outlier + views come contesto senza ordinarci sopra.

## Task 3 — Refresh + riparazione canali in errore

Ogni mattina prima del pulse:
1. `POST /api/social/watchlist/refresh` (tutti).
2. `GET /api/social/watchlist/channels` → per ogni canale `status: "error"` (tipicamente Instagram/TikTok che bloccano gli IP datacenter): scrapea tu il profilo pubblico (followers + ultimi 10-30 video con views/likes/commenti) e spingi tutto con `POST /api/social/watchlist/ingest`.

## Task 4 — Deep analysis on demand

Quando in chat arriva un messaggio `[WATCHLIST → DEEP ANALYSIS]` con un URL:
1. Recupera transcript/contenuto del video (youtube-transcript, browser, ecc.).
2. Estrai: `topic`, `idea_seed`, `hook` (spoken/visual/text + categoria), `storytelling_format` + perché funziona, `contrast_mechanism` (credenza comune vs realtà), `story_structure`, `cta` (tipo + posizione), `hidden_insights` (pattern non ovvi).
3. `POST /api/social/watchlist/analysis` con `{url, analysis:{...i campi sopra...}}`.
4. Rispondi in chat con la sintesi (2-3 righe: cosa rende forte il video e cosa rubare).

## Regole

- Il pulse (Task 1/2) NON fa deep analysis: è una scansione veloce.
- Draft-first: se dall'analisi nascono idee contenuto → `POST /api/social/draft`, mai pubblicare.
- Cita sempre i `platform_url` nudi così Andrea li apre al volo.
