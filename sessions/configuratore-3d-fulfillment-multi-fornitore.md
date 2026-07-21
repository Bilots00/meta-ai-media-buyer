# Configuratore 3D Fulfillment Multi-Fornitore
<!-- externalId: configuratore-3d-fulfillment-multi-fornitore -->

> [contesto compattato più volte durante la sessione — questo è il riassunto integrale dell'arco di lavoro. File di riferimento sempre aggiornato: `C:\Users\utente\Downloads\RESUME-configuratore-3d.md`. Brain: `projects/custom-product-editor.md`.]

## Obiettivo della sessione
Far sì che le personalizzazioni fatte dal cliente sul configuratore live "db-configurator" (tema Shopify, tela/poster wall-art) vengano (a) mostrate come thumbnail nel carrello e (b) mandate in PRODUZIONE al fornitore col design modificato — replicando gratis ciò che fa Gelato Personalization Studio (30€/mese). Poi esteso a: prezzi/varianti corretti, piazzamento design, certificato di autenticità, multi-fornitore (Gelato + Printumo/LumaPrints/Prodigi) per ciò che Gelato non produce, spessore tela.

## Architettura consolidata
- **Tema Shopify** (`db-configurator.js/.css/.liquid` + `db-cart-preview.js/.liquid`) sul tema LIVE #177080303941 (store `aa3csa-zv.myshopify.com`, vanity `dream-brothers.com`). Push via `shopify theme push --allow-live`. Il connettore MCP Shopify BLOCCA le scritture sul tema MAIN → si usa la CLI.
- **Worker Cloudflare `gelato-backend`** = CERVELLO: all'`orders/create` decide chi produce. Risolve il productUid Gelato (template-first → grammatica → validazione catalogo). Crea ordine Gelato DRAFT col print file personalizzato + certificato. Ciò che Gelato non fa lo passa a `/route`.
- **Worker `smistamento-ordini`** = BRACCIO verso gli altri fornitori (Printumo EU, LumaPrints US, Prodigi EU-con-certificato, Pictorem CA TODO). Le API key restano lì.
- **R2** (`pub-d8357e12c3b948ed9e78f43618f1f3ae.r2.dev`): print file personalizzati sotto `customizations/<id>/`.
- **cert-service** (Railway) genera il PNG del certificato.

## user — richiesta iniziale
Riprendere il configuratore 3D. Replicare Gelato Personalization Studio: le modifiche (layer testo) devono essere salvate, mandate in produzione E aggiornare la thumbnail nel carrello. Analizzare il prodotto di test creato con Personalization Studio (`_customizationId`, `_productPreviewUrl`, `_variantId`). Aggiungere al configuratore le stesse settings di Gelato.

## assistant — v27 (personalization fulfillment)
[Letto RESUME + brain + transcript YouTube di Personalization Studio. Costruito worker v27: endpoint `/customization-create`, `PUT/GET /customization/<id>/(preview|print)` su R2, `/webhooks/orders-create` che crea l'ordine Gelato draft col print file, `/register-order-webhook`. Tema: layer di testo multipli, settings identiche a Gelato (Type in-page/editor, Add/Remove layers, Background, Layouts, Allow personalization + Sample element), properties Gelato-identiche, `db-cart-preview.js` per la thumbnail. Merge fatto leggendo la versione LIVE via CDN e riapplicando sopra le modifiche di animazione flip/pose di Andrea.]

## user — "ho testato: appare _customizationId ma su Gelato manca il prodotto"
L'ordine Gelato include solo il prodotto Personalization Studio, mancano i prodotti creati sul mio Shopify. Manca anche il certificato (prima via n8n).

## assistant — diagnosi definitiva
[Causa radice a 3 strati, verificata sui dati: (1) i prodotti Gelato sono `not_connected` con productUid null dopo la riconnessione account; (2) due sistemi in conflitto creavano ordini — integrazione nativa Gelato + workflow n8n zombie ancora attivo; (3) il mio worker non era registrato. Il certificato "mancante" era su un ordine n8n sbagliato. Estratti i 17 productUid REALI dai prodotti connessi per costruire la grammatica UID. Worker v28 = cervello unico.]

## user — vari giri di test (#1250-#1258), ognuno con un bug
[Sequenza di bug trovati e risolti, ognuno con causa radice provata sui dati, non a indovinare:]
- **n8n zombie**: creava ordini con poster generici + file R2 404 + certificato. DISATTIVATO via MCP.
- **404 sui file**: era n8n che indovinava l'URL R2 dal titolo. I file del worker (200 OK) funzionano.
- **v28.1**: `uidExistsInCatalog` validava i candidati sul catalogo Gelato (cache D1).
- **Prezzo/variante non si aggiornava** → CAUSA RADICE: le app di traduzione taglie traducono anche il NOME dell'opzione (`Size`→`Dimensione`) e i valori (cm↔pollici). `optionIndex("Size")` tornava -1 → matchVariant senza criteri → sempre variants[0]. Fix: `detectOptionIndex` riconosce l'opzione dalla FORMA dei valori; `sizeCmKey`/`INCH_TO_CM` unit-aware.
- **Design tagliato sulle TELE**: la tela si avvolge sul telaio, l'area stampa copre fronte+avvolgimento. `canvasBleedFraction()` aggiunge margine di rifilo specchiato solo al print file.
- **v29 template-first + fitMethod meet**: productUid dai template Gelato di Andrea (canvas `a920faa1`, framed_canvas `89a4bb87`, poster `35cf6ea7`, framed_poster `673761e5`); `fitMethod:"meet"` = design mai tagliato (segreto dal workflow n8n).
- **Materiale sbagliato (Poster→Canvas)**: la property Material del cliente ora vince sul titolo.
- **Certificato gating**: Gelato inserisce le branded card solo verso 9 paesi + solo poster-family; verso l'Italia si salta + tag `db-cert-digital`. Poster incorniciato SÌ (poster-family).
- **#1258 taglia+cornice+finitura sbagliate** → UNA causa: le etichette dei template Gelato hanno ENTRAMBE le unità (`30x40 cm / 12x16"`); `labelIsInches` guardava tutta la stringa → convertiva 30x40 cm come pollici → 75x100 in cache. + lookup solo su misura non su colore cornice + finish mai mappato. v31: `normSizeKey` unit-aware, lookup su misura+cornice (tabella `gelato_template_uids_v2`), `applyFinishToUid`.
- **FATTO DI BUSINESS**: Gelato NON produce poster/tele incorniciate in 75x100 (404 dal catalogo). I template incorniciati coprono solo A4/30x40/50x70.

## user — "Gelato non fa il 75x100 incorniciato: usa i miei altri fornitori (Printumo/LumaPrints)"
[Analizzato worker `smistamento-ordini` v2: 3 problemi (trigger solo su 100x140; file indovinato dal titolo=404; PRODIGI_SKU vuoto). Riscritto `smistamento-ordini-v3.js`: endpoint `/route` che riceve gli item già decisi col print file REALE. `gelato-backend-v32`: quando Gelato non risolve un item, lo instrada a `/route` col file personalizzato. Trigger = fallimento risoluzione productUid, non taglia hardcoded.]

## assistant — review avversariale (workflow multi-agente, 51 agenti)
[23 grezzi → 11 confermati (5 reviewer + 2 scettici per finding). Trovati PRIMA del deploy, worker v33:]
- **[CRITICO]** colore cornice sconosciuto ripiegava sul NERO → "Weisser Rahmen" spediva nera a chi ha pagato bianca. Ora → manuale + vocabolario colori multilingua.
- **[MAJOR]** cornice non letta dalla variante sui mercati tradotti (`FRAME_WORD_RE` multilingua).
- **[MAJOR]** `_ver` scritto a mano nei framed poster/A4 → landscape prodotto verticale.
- **[MAJOR]** idempotenza inefficace → ordini doppi (claim atomico su `processed_orders`).
- **[MAJOR]** "Glossy" produceva SILK (ordine token errato). Ora glossy prima, satinato = sostituzione dichiarata.
- **Tema**: colore apparel spariva su mercati tradotti; material iniziale dal CSV (canvas senza rifilo); race sul cambio materiale; click morto riaprendo overlay.

## user — SKU Prodigi + spessore tela
[Dati SKU Prodigi (canvas/framed-canvas 75x100 e 100x140, thickness 19mm slim/38mm gallery). Due SKU troncati nel copia-incolla (`-30X4`/`-40X5`) → completati a `-30X40`/`-40X55` (confermato da Andrea). Aggiunto passo "spessore" nel configuratore (solo tele), property `Thickness`, portata al fornitore. Worker v34: se 38mm non spedisce l'uid slim di Gelato. Test 13/13.]

## user — "ROUTING_SECRET serve davvero? + default tela = spessa + esporta sessione"
## assistant — v35 (stato finale)
[**ROUTING_SECRET reso opzionale**: `/route` lo verifica solo se impostato, altrimenti aperto; il gelato-backend invia l'header solo se c'è. Funziona senza configurare nulla. **Default spessore = SPESSA (38mm)**: su product page standard senza selettore, assenza di spessore → 38mm; slim solo se richiesta. `canvasIsSlim()` default false → tela senza spessore prova i profili spessi sul catalogo, altrimenti Prodigi `GLOBAL-CAN-*`, altrimenti manuale; mai spedire slim al posto di spessa. Test 7/7. Worker rinominato `gelato-backend-v35.js` (`v35-thick-default-optional-secret`).]

## STATO FINALE / TODO alla ripresa
1. **Deploy dei due worker** (Andrea, il connettore Cloudflare è read-only): `gelato-backend-v35.js` + `smistamento-ordini-v3.js`. Tema già LIVE.
2. **ROUTING_SECRET**: non necessario (opzionale).
3. **SKU GELATO dimenticati**: Andrea doveva incollarli, non erano nel messaggio → da fornire per mappare i productUid diretti e il thick canvas.
4. **Tele piccole (30x40/50x70) + default spessa**: Gelato forse non le fa spesse + Prodigi non ha SKU per quelle taglie → finirebbero manuali. Decidere se il default-spessa vale solo dai 75x100 in su.
5. **Prezzo spessore**: oggi è una property, non cambia prezzo (38mm costa più ma il cliente paga uguale). Valutare opzione di variante Shopify.
6. **`framing_id` Printumo** fisso a 2: verificare la corrispondenza col colore cornice prima del primo ordine.
7. **Passo spessore nel configuratore spento di default** (`enable_thickness`=false): accendere consapevolmente.
8. **Test end-to-end**: 50x70 nera glossy (Gelato), 75x100 incorniciato (Prodigi), 75x100 tela 38mm (Prodigi GLOBAL-CAN), 75x100 tela slim (Gelato).

## Lezioni chiave
- I NOMI delle opzioni prodotto Shopify sono tradotti dal mercato: mai identificarle per nome, sempre per forma dei valori. Le unità (cm/pollici) vanno confrontate su una chiave cm canonica.
- Il prodotto fisico si deriva SEMPRE dalla variante PAGATA, mai dalle properties del configuratore (rischio: stampare un prodotto costoso al prezzo di uno economico).
- Le etichette dei template Gelato portano entrambe le unità: l'unità va letta ATTACCATA alla coppia di numeri.
- La review avversariale multi-agente su codice che muove soldi ripaga: 5 degli 11 bug avrebbero prodotto stampe sbagliate o ordini doppi, non coperti dai test manuali.
- L'osservabilità (log su D1, non su webhook.site scaduto) va ripristinata PRIMA di debuggare, non dopo.
