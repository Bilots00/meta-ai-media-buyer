# AGENTS.md — Read this first

> Authoritative project facts for any AI / coding agent working on this repo.
> If anything elsewhere (README, `template.json`, code comments) contradicts this file about **hosting**, this file wins.

## 🚂 Hosting & Deployment — Railway (NOT Manus)

- **This app is deployed on [Railway](https://railway.app).** Pushing to the **`main`** branch triggers a Railway build & deploy.
- **Build:** `pnpm build` → `vite build` + esbuild bundle of `server/_core/index.ts` into `dist/`. **Start:** `pnpm start` → `node dist/index.js`.
- **Environment variables live in the Railway project dashboard** (Variables tab), NOT in a committed file. `.env` is git-ignored and used only for local dev.
- ⚠️ **Do NOT assume Manus is the host.** The codebase was originally scaffolded from a Manus "Web App" template — that is why you'll see `template.json`, `vite-plugin-manus-runtime`, `/manus-storage/`, and many "Manus" mentions in `README.md`. The project has since been **migrated to Railway**. Manus is, at most, a provider of some backend services (OAuth, storage, LLM/maps proxy) reached via env vars — **the site itself runs on Railway.**

## Stack

- **Frontend:** React 19 + Vite 7 + Tailwind 4 + shadcn/ui. Routing via **wouter** (NOT react-router).
- **Backend:** Express 4 + tRPC 11 + Drizzle ORM (MySQL / TiDB).
- **Package manager:** **pnpm** (available via `corepack pnpm …`).
- **Toasts:** **sonner** (`import { toast } from "sonner"` → `toast.success(...)` / `toast.error(...)`). There is **no** `@/hooks/use-toast`.
- **Path aliases:** `@/*` → `client/src/*`, `@shared/*` → `shared/*`.

## Where things live

- **Sidebar / navigation:** `client/src/components/DashboardLayout.tsx`. Nav groups: *META Ads*, *Print on Demand*, *Social Organico*, *Customer Care*, *Library*. Each item is `{ icon, label, path, description }`.
- **Routes:** `client/src/App.tsx` — wouter, pattern `<Route path="…">{withLayout(Page)}</Route>`.
- **Pages:** `client/src/pages/`. **Feature components:** `client/src/components/`.

## POD Partners (suppliers)

- **UI:** page `client/src/pages/PodPartners.tsx` → component `client/src/components/PodPartners.tsx`.
- **Route:** `/gelato/pod-partners`, listed under the **"Print on Demand"** sidebar group.
- **What it does:** toggle "Certificato di Autenticità". ON → EU non-Gelato orders route to **Prodigi** (dynamic per-order certificate); OFF → **Printumo** (no certificate).
- **Backend:** Cloudflare Worker **"smistamento-ordini"** — `GET /config` → `{ certEnabled }`, `POST /config` with header `X-CONFIG-KEY`.
- **Env (set in Railway):** `VITE_SMISTAMENTO_URL`, `VITE_SMISTAMENTO_CONFIG_KEY`.
- ⚠️ Note: `VITE_*` vars are embedded in the client bundle, so `VITE_SMISTAMENTO_CONFIG_KEY` is visible in the browser. For real protection, proxy `POST /config` through the server (tRPC) keeping the key server-side.

## Local dev

```bash
corepack pnpm install
corepack pnpm dev        # tsx watch server/_core/index.ts
corepack pnpm check      # tsc --noEmit (typecheck)
```
