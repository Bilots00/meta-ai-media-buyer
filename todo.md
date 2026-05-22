# META AI Media Buyer — TODO

## Schema & Database
- [x] Tabella meta_accounts (account META collegati)
- [x] Tabella campaigns (campagne con obiettivi, budget, stato)
- [x] Tabella ad_sets (gruppi di inserzioni)
- [x] Tabella ads (inserzioni con copy, creative, performance)
- [x] Tabella kpi_snapshots (snapshot KPI giornalieri per grafici)
- [x] Tabella agent_logs (log azioni autonome agente AI)
- [x] Tabella goals (obiettivi goal-based con budget massimo)
- [x] Tabella ab_tests (test A/B con varianti e risultati)
- [x] Tabella alerts (alert e notifiche anomalie)
- [x] Tabella copy_generations (copy generati dall'AI)
- [x] Tabella tracking_configs (Pixel META e CAPI)

## Backend — tRPC Routers
- [x] Router meta: connessione account META, OAuth, verifica token
- [x] Router campaigns: CRUD campagne, ad set, ads via Meta API
- [x] Router audit: analisi storico account con LLM
- [x] Router copyGen: generazione copy AI per inserzioni
- [x] Router goals: sistema goal-based, lancio agente autonomo
- [x] Router optimization: ottimizzazione real-time, accendi/spegni ads
- [x] Router abTest: gestione A/B test, valutazione statistica AI
- [x] Router tracking: setup Pixel META e CAPI, verifica installazione
- [x] Router agentLogs: storico azioni agente con motivazioni
- [x] Router alerts: sistema alert e disaster recovery
- [x] Router kpi: snapshot KPI, ROAS, CPA, CPL, CVR, budget

## Backend — Servizi AI
- [x] Meta Marketing API wrapper (metaApi.ts)
- [x] AI Agent Engine autonomo (aiAgent.ts)
- [x] Audit AI con LLM — analisi account completa
- [x] Copy Generator AI con LLM — 5 varianti per elemento
- [x] Ottimizzazione autonoma con ciclo decisionale AI
- [x] Sistema Alert con notifiche owner (notifyOwner)
- [x] Valutazione A/B test con AI e significatività statistica

## Frontend — Pagine
- [x] Home (landing page con CTA login e feature overview)
- [x] DashboardLayout con sidebar navigazione completa + badge alert
- [x] Dashboard principale con KPI real-time (ROAS, CPA, CPL, CVR, budget)
- [x] Pagina Audit AI con report LLM e analisi storico
- [x] Pagina Generatore Copy AI con form obiettivo e output varianti
- [x] Pagina Gestione Campagne (lista, creazione, sincronizzazione META)
- [x] Pagina Goal System (imposta obiettivo + budget, lancia agente)
- [x] Pagina A/B Testing (crea varianti, monitora risultati, valutazione AI)
- [x] Pagina Tracking Setup (Pixel + CAPI guidato, verifica installazione)
- [x] Pagina Log Agente (storico azioni AI con timeline e filtri)
- [x] Pagina Alert & Recovery (notifiche anomalie, risoluzione, disaster recovery)
- [x] Pagina Connessione Account META (inserimento token, gestione account)

## Stile Visivo
- [x] Design system dark/elegante con palette premium OKLCH
- [x] Tipografia raffinata (Inter via Google Fonts)
- [x] Animazioni micro-interazioni fluide
- [x] Sidebar navigazione con icone e badge stato
- [x] Grafici KPI con Recharts stilizzati
- [x] Cards con stile premium e shadow
- [x] Badge stato campagne (attiva, in pausa, ottimizzazione)
- [x] Indicatori real-time con pulse animation
- [x] Gradiente primario blu/viola per elementi chiave

## Integrazione Meta Marketing API
- [x] Autenticazione con token storage
- [x] Fetch campagne, ad set, ads reali dall'account
- [x] Creazione campagne via API
- [x] Aggiornamento budget e stato ads via API
- [x] Lettura metriche performance (insights) via API
- [x] Gestione Pixel e CAPI via API

## Sistema Agente AI Autonomo
- [x] Loop di ottimizzazione con invokeLLM
- [x] Decisioni autonome accendi/spegni ads
- [x] Riallocazione budget verso ads vincenti
- [x] Generazione report motivazioni per ogni azione
- [x] Sistema di supervisione con limiti di sicurezza
- [x] Disaster recovery: blocco automatico su anomalie critiche

## Test
- [x] Test auth.logout (1 test)
- [x] Test agent.test.ts (11 test: auth, campaigns, goals, alerts, copy, logs, kpi)
- [x] 12/12 test passano
- [x] Zero errori TypeScript
