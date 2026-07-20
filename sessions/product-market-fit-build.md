# Product Market FIT Build
<!-- externalId: product-market-fit-build -->

> Sessione Claude Code (desktop) del 15-20/07/2026. Costruzione completa della sezione
> **Product Market FIT** della web app + del runtime dell'agente **Market Intelligence &
> Product Research**. Questo transcript serve a riprendere il filo senza rispiegare nulla.
> [turni lunghi e output di tool riassunti tra parentesi quadre]

---

## user — 2026-07-15T14:30:00Z

Domanda di partenza: Everbee, Alura, SimilarWeb, Helium 10, Kalodata, SemRush, Minea, PP Spy, Winning Hunter — **da dove prendono i dati** e come fanno a essere attendibili? Glieli forniscono Etsy/Amazon direttamente?

Obiettivo: creare un **AI Claude agent** che rispecchi il ruolo descritto in `market-intelligence-product-research-mansioni.md` e che sappia reperire quei dati **senza pagare abbonamenti**. Voglio un tool completo come ecomspyai.com.

Progetto concreto: **clone moderno di GLITCH** (software di Thomas Macorig, acquistato ai tempi) che monitora store Shopify competitor: nuovi prodotti, cambi prezzo, stock, collezioni; report periodici e alert. Solo dati pubblici, niente vulnerabilità. Deve girare su VPS. Il report deve arrivare in una nuova sotto-sezione **"Product Market FIT"** dentro **Print on Demand**, prima di Bulk Creator.

## assistant — 2026-07-15T14:45:00Z

Risposta sulla provenienza dati: **nessuno di quei tool riceve dati da Etsy/Amazon**. Scrapano dati pubblici e li modellano. Il "backdoor Shopify" di GLITCH è marketing.

[Esplorato il repo `meta-ai-media-buyer`, letti pattern esistenti: tRPC, Drizzle, scheduler, researchService. Scritti spec + piano in `docs/superpowers/specs/` e `docs/superpowers/plans/` (2026-07-15-product-market-fit-shopify-monitor*).]

**Verifica empirica sui 3 store seed** (dotcomcanvas.de, ikonick.com, gernucci.com): tutti Shopify, `/products.json` OK ma **NON espone `inventory_quantity`**. Cart-probe `POST /cart/add.js` qty=99999 → cap **uniformi e tondi** (ikonick=10, gernucci=50, dotcomcanvas=1000/illimitato) = **placeholder falsi, non stock reale**. Sono tutti POD → il metodo "guardo lo stock scendere = vendite" darebbe **numeri fasulli**.

Invece `sort_by=best-selling` **funziona** su tutti e 3 → è un ranking di vendita reale pubblico.

→ Progettato un **motore di stima vendite a livelli, onesto per design**:
- **Tier A** inventory-decrement (solo se lo stock è reale/variabile) → unità ~esatte
- **Tier B** review-velocity (se c'è review app)
- **Tier C** best-seller rank (domanda relativa, sempre disponibile)
- **none** → dichiara che non è misurabile. **Mai numeri inventati.** `looksFakeStockCap()` scarta i cap uniformi.

## user — 2026-07-15T16:10:00Z

Sì parti subito, ma prima volevo poter riprendere la sessione dal telefono (`/remote-control`). Notifiche solo in-app. Stima vendite la più precisa possibile, non supposizioni. Sì al subagent. Store da seedare: i 3 sopra.

## assistant — 2026-07-15T16:50:00Z

[Implementata **Fase 1 — monitor Shopify**, TDD. File: `server/marketIntel.ts` (parse/diff/stima puri), `server/marketIntelService.ts` (ciclo), db helpers in `server/db.ts`, 4 tabelle in `drizzle/schema.ts` + boot DDL + seed 3 store in `server/_core/index.ts`, REST `server/_core/marketRoutes.ts`, router tRPC `marketIntel`, scheduler 09:15, pagina `client/src/pages/ProductMarketFit.tsx` + route `/gelato/market-fit` + voce sidebar, skill `references/skills/market-intelligence.md` + subagent `.claude/agents/market-intelligence.md`. 52 test verdi, tsc pulito, build ok.]

Onesto sul `/remote-control`: questa sessione-terminale locale non si teletrasporta; il ponte reale è il **repo GitHub** + Claude Code web.

## user — 2026-07-15T17:30:00Z

Fai il push (avresti dovuto farlo subito, era urgente per riprendere da remoto). Poi: trova un modo **più intelligente e attendibile** per tracciare le vendite di uno store e capire **quali prodotti specifici** vendono di più. Ho trovato online questo snippet `fbq('track','purchase',{...})`. Intanto **focalizzati su Etsy**: dai all'agente la capacità di analizzare/scrapare Etsy come Alura ed Everbee, così porto i bestseller Etsy sul mio Shopify (con redesign/rebranding mio, niente copyright).

## assistant — 2026-07-15T18:10:00Z

Riconosciuto l'errore: il deploy andava fatto per primo. [Push su `main` → Railway deploy.]

**Correzione onesta**: quello snippet `fbq('track','Purchase')` **non rivela le vendite dei competitor** — fa credere a Meta che *tu* abbia comprato (trucco di ad-spy/targeting), zero dato di vendita.

**Scoperta chiave su Etsy**: il fetch diretto server-side dà **403** (anti-bot). *È il motivo per cui Everbee e Alura sono estensioni Chrome*: girano nel browser reale dell'utente. Soluzione: **Firecrawl** come trasporto (browser reale + IP residenziale) — verificato funzionante (shop ModParty: 2,1M vendite; ricerca con reviewCount + badge Bestseller per listing).

[Creato `server/etsyIntel.ts` + test, endpoint REST `/api/market/etsy`, tRPC `etsyKeyword`/`etsyShop`, card UI. Deploy. Richiede `FIRECRAWL_API_KEY` su Railway.]

## user — 2026-07-16T00:50:00Z

Firecrawl HTTP 400 con long-tail. Volevo una **watchlist di store Etsy** come per Shopify. E il tuo metodo mi sembra **approssimativo e diverso** da Alura/Everbee: fai un test MVP sullo store Etsy più forte e mostrami le vendite dei prodotti **specifici**. [Screenshot Alura: listing "Vintage Peter Pan Disney Shirt" → Sales 23, Mo. Sales 3, Revenue $840.65; shop BoundlessInkPrints → Sales 7.041, Review rate 9.59%, 675 recensioni.]

## assistant — 2026-07-16T01:10:00Z

**Metodo di Alura reverse-engineered e VALIDATO dal vivo.** Dai tuoi stessi screenshot: 675 recensioni ÷ 7.041 vendite = **9,59%** = esattamente il "Review rate" che Alura mostra. Quindi:

```
review_rate(shop) = review_totali_shop / vendite_totali_shop   (entrambi PUBBLICI)
est_sales(listing) = review_prodotto / review_rate(shop)
```

**Test sul tuo Peter Pan (live):** BabylonPrints = 28.040 vendite / 5.015 recensioni → rate **17,88%**. Il listing ha **4 recensioni** → 4 ÷ 0,1788 = **22**. **Alura dice 23.** Match entro 1 unità. ✅

Anche Alura **stima** (Etsy non espone vendite per-prodotto a nessuno): la differenza era che io usavo un rate fisso al 10% invece di **calibrarlo per shop**. Corretto. Test golden Peter Pan bloccato in `server/etsyIntel.test.ts`.

**Fix HTTP 400**: la v2 di Firecrawl vuole `formats:[{type:"json",prompt,schema}]` (non `["json"]`+`jsonOptions`) e `proxy` ∈ `basic|enhanced|auto` (non `"stealth"`).

[Costruiti: Shop Analyzer stile Alura, **Etsy Watchlist** (tabelle `etsy_shops`/`etsy_shop_snapshots`/`etsy_listings`, `server/etsyService.ts`, scheduler), velocità vendite **esatta** dal Δ contatore pubblico. Deploy.]

## user — 2026-07-19T21:00:00Z

La UI fa schifo, è diversa dalla UI chiara/pulita di Alura. Dopo aver aggiunto un negozio alla watchlist **non riesco più a riaprire quei dati**, devo rimuovere e ritracciare (stesso problema su Shopify). Voglio **ogni blocco in un pannello collassabile brandizzato** (Etsy arancione, Shopify verde, Google bianco per Trends, Meta/TikTok in alto). Per Shopify usa il **metodo GLITCH** — ho trovato la landing: learn.infobiz.com/glitch.

## assistant — 2026-07-19T21:40:00Z

[Analizzato GLITCH: **Scanner** = cerca la Meta Ad Library per paese+keyword+min ads attive, tiene solo gli advertiser che linkano store Shopify; **Tracker** = da quel momento traccia le vendite. Il "backdoor" è marketing: il metodo reale è inventory-delta nel tempo.]

Ridisegnata la pagina **chiara stile Alura** con 4 pannelli collassabili brandizzati (`client/src/components/CollapsiblePanel.tsx`), **fix riapertura** (`storeDetail` + `etsyShopDetail` → click sulla riga espande i dati salvati), `server/adLibrary.ts` (`scanMetaAdLibrary`, `scanTikTokTopAds`), tRPC `metaAdsScan`/`tiktokScan`/`glitchScan`/`storeDetail`, pannello **Google Trends** collegato al feed dell'AI SEO Specialist (`research.list source=trends`). Deploy.

## user — 2026-07-19T22:20:00Z

Mancano le **thumbnail**. Testo **troppo piccolo** per desktop. Nessuna **paginazione** quando espando un negozio (Alura ha "pagina 1 di 3"). Meta Ads dà `Firecrawl HTTP 500 ERR_ABORTED`. E soprattutto: lo Scanner dice "4 ad estratte, 0 advertiser (≥5 ad)" **senza mostrare nessun dato/link** — GLITCH, Pippit e Kalodata mostrano sempre i risultati con tutti i dettagli. Perché?

Inoltre potenzia Shopify incrociando `collections/all?sort_by=best-selling` **+ i dati dell'app recensioni** (1 recensione = 1 vendita confermata). E a destra della pagina voglio una tab **"Prodotti in evidenza"**: 6 prodotti da Meta/TikTok + 2 Etsy + 2 Shopify, thumbnail grande, link, **checkbox** da spuntare ogni giorno, scelti dal mio agente incrociando anche Google Trends.

[Condivise le metodologie di 6 guru: **Nathan Miller**, **@GIOThatsIt** (minimum criterias), **Jordan Welch** (prompt nicchie), **Sebastiano Jay** (Protocollo Jay: 3 vettori, legge del dolore, 7 pilastri), **Marco Cappelli** (reverse-engineering store via Apify+Claude), **Samuele Ferrari** (filtri Winning Hunter: 20+ ads attive, 7-30gg, scaling rising, Shopify, no integratori, shop one-product).]
Voglio che **fondi tutti questi metodi** creando il più grande esperto di ricerca prodotto, adattando al brand via MCP `dreambrothers-brain`.

## assistant — 2026-07-19T23:10:00Z

**Causa del bug "0 advertiser"**: il filtro `adCount >= minAds` **cancellava** tutti gli advertiser (ognuno raggruppato con 1 ad < soglia). Ora `minAds` è una **soglia di evidenza** (`passesThreshold`), **non un filtro distruttivo**: si vedono sempre tutti gli advertiser con thumbnail, dominio, badge Shopify e **link diretto alla Ad Library**. TikTok `ERR_ABORTED` → messaggio chiaro di retry invece del 500 grezzo.

[Implementato: thumbnail ovunque (`Thumb`), testo desktop ingrandito, **paginazione** "Pagina X di N" nei dettagli, colonna destra **Prodotti in evidenza** (6 Meta/TikTok + 2 Etsy + 2 Shopify, thumbnail 64px, checkbox, reason + score), tabelle `ad_finds` + `daily_picks`, `server/dailyPicksService.ts` con **`FUSED_METHOD`** (fusione dei 6 guru + le 8 competenze del ruolo + adattamento brand), scheduler **10:15**, Shopify potenziato con **review count per-prodotto** (`extractReviewCountFromHtml` → Judge.me/Loox/Yotpo/JSON-LD) su `market_products.reviewCount`. 76 test verdi. Deploy su `main`.]

Limite onesto: lo scraping delle ad library resta **best-effort** (pagine JS/anti-bot). Consigliato `FIRECRAWL_PROXY=enhanced`.

## user — 2026-07-20T18:07:00Z

In un'altra sessione della web app Claude dice che il ruolo Market Intelligence & Product Research è solo 🟡 *Definito* con "agente runtime — (da creare)", perché non sa del lavoro fatto qui. Esporta la sessione così posso importarla lì. **Voglio parlare con il mio agente di ricerca prodotto** assicurandomi che non si limiti al file mansioni, ma sfrutti **anche i metodi dei guru** condivisi qui.

---

## STATO ATTUALE — handoff per l'agente

**Il runtime dell'agente ESISTE già** (non è più "da creare"). Dove vive:

| Cosa | Dove |
|---|---|
| Metodo Etsy validato (Alura) | `server/etsyIntel.ts` (+ test golden Peter Pan) |
| Watchlist Etsy + velocità esatta | `server/etsyService.ts`, tabelle `etsy_*` |
| Monitor/Tracker Shopify (GLITCH) | `server/marketIntel.ts`, `server/marketIntelService.ts` |
| Scanner Meta/TikTok Ad Library | `server/adLibrary.ts` |
| **Agente fuso (6 guru + 8 competenze)** | `server/dailyPicksService.ts` → `FUSED_METHOD` |
| Skill agente VPS | `references/skills/market-intelligence.md` |
| Subagent Claude Code | `.claude/agents/market-intelligence.md` |
| UI | `client/src/pages/ProductMarketFit.tsx` (+ `CollapsiblePanel.tsx`) |
| REST per l'agente | `/api/market/*` (header `x-care-secret`) |

**Formule chiave (non reinventarle):**
- Etsy: `est_sales = review_prodotto / (review_shop / vendite_shop)` — validato vs Alura (22 vs 23).
- Shopify: best-seller rank + review count per-prodotto (1 recensione = ≥1 vendita) + inventory-delta solo se lo stock è reale.
- **Mai numeri inventati**: se non misurabile, dichiararlo.

**Job schedulati:** 09:15 monitor Shopify · 09:45 watchlist Etsy · 10:15 daily picks.

**Aperti:** `FIRECRAWL_PROXY=enhanced` per ad-library più affidabile; collegamento *live* al connettore MCP `dreambrothers-brain` nel generatore di picks (oggi il brand context è iniettato staticamente); aggiornare la roster nel Brain da 🟡 *Definito* a 🟢 *Attivo*.
