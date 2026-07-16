import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, string> = {
  NEW_PRODUCT: "Nuovo", PRICE_CHANGE: "Prezzo", STOCK_OUT: "Esaurito",
  RESTOCK: "Restock", REMOVED_PRODUCT: "Rimosso", COLLECTION_CHANGE: "Collezione",
};

export default function ProductMarketFit() {
  const utils = trpc.useUtils();
  const stores = trpc.marketIntel.listStores.useQuery();
  const changes = trpc.marketIntel.listChanges.useQuery({ hours: 168, limit: 200 });
  const brief = trpc.marketIntel.brief.useQuery({ hours: 168 });
  const addStore = trpc.marketIntel.addStore.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const runNow = trpc.marketIntel.runNow.useMutation({
    onSuccess: () => { utils.marketIntel.listChanges.invalidate(); utils.marketIntel.listStores.invalidate(); utils.marketIntel.brief.invalidate(); },
  });
  const removeStore = trpc.marketIntel.removeStore.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const etsyKw = trpc.marketIntel.etsyKeyword.useMutation();
  const etsyAnalyze = trpc.marketIntel.etsyAnalyze.useMutation();
  const etsyWatch = trpc.marketIntel.etsyWatchList.useQuery();
  const etsyWatchAdd = trpc.marketIntel.etsyWatchAdd.useMutation({ onSuccess: () => etsyWatch.refetch() });
  const etsyWatchRemove = trpc.marketIntel.etsyWatchRemove.useMutation({ onSuccess: () => etsyWatch.refetch() });
  const etsyWatchRefresh = trpc.marketIntel.etsyWatchRefresh.useMutation({ onSuccess: () => etsyWatch.refetch() });
  const [label, setLabel] = useState("");
  const [domain, setDomain] = useState("");
  const [etsyQ, setEtsyQ] = useState("");
  const [etsyShopInput, setEtsyShopInput] = useState("");
  const [listFilter, setListFilter] = useState("");

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Brief opportunità */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.14 0.02 300)", border: "1px solid oklch(0.24 0.03 300)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.15 310)" }}>Brief opportunità (7gg)</h2>
          <Button size="sm" disabled={runNow.isPending} onClick={() => runNow.mutate({})}>
            {runNow.isPending ? "Scansione…" : "Aggiorna ora"}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{brief.data?.brief ?? "…"}</pre>
      </div>

      {/* ══ ETSY SHOP ANALYZER (metodo Alura calibrato) ══ */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.14 0.02 40)", border: "1px solid oklch(0.24 0.04 40)" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "oklch(0.8 0.15 45)" }}>Etsy Shop Analyzer — vendite per prodotto</h2>
        <p className="text-[11px] text-muted-foreground mb-3">Vendite prodotto = recensioni prodotto ÷ review-rate shop (recensioni tot ÷ vendite tot, dati pubblici). Validato vs Alura entro 1 unità.</p>
        <div className="flex gap-2 mb-3">
          <input value={etsyShopInput} onChange={(e) => setEtsyShopInput(e.target.value)} placeholder="URL o nome shop (es. BabylonPrints)"
            onKeyDown={(e) => { if (e.key === "Enter" && etsyShopInput.trim().length >= 3) etsyAnalyze.mutate({ shop: etsyShopInput.trim() }); }}
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 40)", border: "1px solid oklch(0.24 0.03 40)" }} />
          <Button disabled={etsyAnalyze.isPending || etsyShopInput.trim().length < 3} onClick={() => etsyAnalyze.mutate({ shop: etsyShopInput.trim() })}>
            {etsyAnalyze.isPending ? "Analisi…" : "Analizza"}
          </Button>
          <Button disabled={etsyWatchAdd.isPending || etsyShopInput.trim().length < 2} onClick={() => etsyWatchAdd.mutate({ shop: etsyShopInput.trim() })}>+ Watchlist</Button>
        </div>
        {etsyAnalyze.isError && <div className="text-xs text-red-400 mb-2">{String(etsyAnalyze.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server (Railway → Variables)." : etsyAnalyze.error?.message}</div>}
        {etsyAnalyze.data && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                ["Vendite tot", etsyAnalyze.data.shop.totalSales?.toLocaleString() ?? "?"],
                ["Recensioni", etsyAnalyze.data.shop.reviewCount?.toLocaleString() ?? "?"],
                ["Review rate", etsyAnalyze.data.shop.reviewRate != null ? (etsyAnalyze.data.shop.reviewRate * 100).toFixed(1) + "%" : "?"],
                ["Vendite/mese", etsyAnalyze.data.shop.avgMonthlySales?.toLocaleString() ?? "?"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg p-2 text-center" style={{ background: "oklch(0.16 0.02 40)" }}>
                  <div className="text-sm font-semibold">{v}</div>
                  <div className="text-[10px] text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>
            <input value={listFilter} onChange={(e) => setListFilter(e.target.value)} placeholder="Filtra prodotti…"
              className="px-3 py-2 rounded-lg text-sm w-full mb-2" style={{ background: "oklch(0.16 0.02 40)", border: "1px solid oklch(0.24 0.03 40)" }} />
            <div className="space-y-1">
              {etsyAnalyze.data.listings.filter((l) => l.title.toLowerCase().includes(listFilter.toLowerCase())).map((l) => (
                <a key={l.listingId} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" style={{ background: "oklch(0.15 0.015 40)" }}>
                  {l.isBestseller && <Badge style={{ background: "oklch(0.65 0.2 145)" }}>BS</Badge>}
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "oklch(0.82 0.16 145)" }}>{l.estSales?.toLocaleString() ?? "?"} vendite</span>
                  <span className="text-muted-foreground text-[11px] whitespace-nowrap">{l.reviewCount} rec · {l.currency} {l.price ?? "?"} · ♥{l.favorites ?? "?"}</span>
                </a>
              ))}
              {etsyAnalyze.data.listings.length === 0 && <div className="text-xs text-muted-foreground">Nessun prodotto estratto.</div>}
            </div>
          </>
        )}
      </div>

      {/* ══ ETSY WATCHLIST (monitor automatico dell'AI agent) ══ */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.015 40)", border: "1px solid oklch(0.2 0.02 40)" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Etsy Watchlist — shop che l'AI agent scansiona ogni giorno</h2>
          <Button size="sm" disabled={etsyWatchRefresh.isPending} onClick={() => etsyWatchRefresh.mutate({})}>{etsyWatchRefresh.isPending ? "Scan…" : "Aggiorna tutti"}</Button>
        </div>
        <div className="space-y-1">
          {(etsyWatch.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.015 40)" }}>
              <span>{s.shopName} {s.lastTotalSales != null && <span className="text-muted-foreground">· {s.lastTotalSales.toLocaleString()} vendite · rate {s.reviewRate != null ? (Number(s.reviewRate) * 100).toFixed(1) + "%" : "?"}</span>}</span>
              <span className="flex items-center gap-2">
                <Badge>{s.status}</Badge>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => etsyWatchRefresh.mutate({ id: s.id })}>run</button>
                <button className="text-xs text-red-400 hover:text-red-300" onClick={() => etsyWatchRemove.mutate({ id: s.id })}>×</button>
              </span>
            </div>
          ))}
          {etsyWatch.data?.length === 0 && <div className="text-xs text-muted-foreground">Aggiungi uno shop con "+ Watchlist" qui sopra: l'agent lo scansiona ogni giorno e ti prepara i prodotti vincenti da pubblicare.</div>}
        </div>
      </div>

      {/* ══ ETSY KEYWORD RESEARCH (cross-shop) ══ */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.13 0.015 40)", border: "1px solid oklch(0.2 0.02 40)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.8 0.15 45)" }}>Etsy Keyword Research — bestseller di nicchia</h2>
        <div className="flex gap-2 mb-3">
          <input value={etsyQ} onChange={(e) => setEtsyQ(e.target.value)} placeholder="keyword nicchia (es. peter pan shirt)"
            onKeyDown={(e) => { if (e.key === "Enter" && etsyQ.trim().length >= 2) etsyKw.mutate({ query: etsyQ.trim() }); }}
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 40)", border: "1px solid oklch(0.24 0.03 40)" }} />
          <Button disabled={etsyKw.isPending || etsyQ.trim().length < 2} onClick={() => etsyKw.mutate({ query: etsyQ.trim() })}>{etsyKw.isPending ? "Ricerca…" : "Cerca"}</Button>
        </div>
        {etsyKw.isError && <div className="text-xs text-red-400 mb-2">{String(etsyKw.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : etsyKw.error?.message}</div>}
        <div className="space-y-1">
          {(etsyKw.data?.listings ?? []).map((l) => (
            <a key={l.listingId} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" style={{ background: "oklch(0.15 0.015 40)" }}>
              {l.isBestseller && <Badge style={{ background: "oklch(0.65 0.2 145)" }}>BS</Badge>}
              <span className="flex-1 truncate">{l.title}</span>
              <span className="text-muted-foreground text-xs whitespace-nowrap">{l.reviewCount.toLocaleString()} rec · {l.currency} {l.price ?? "?"}</span>
            </a>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Usa i vincitori come <b>validazione + ispirazione</b>: redesign e copy tuoi, mai copia.</p>
      </div>

      {/* Store competitor */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <h2 className="text-sm font-semibold mb-3">Store competitor</h2>
        <div className="flex gap-2 mb-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etichetta"
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 260)", border: "1px solid oklch(0.24 0.02 260)" }} />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="dominio-store.com"
            className="px-3 py-2 rounded-lg text-sm flex-1" style={{ background: "oklch(0.16 0.02 260)", border: "1px solid oklch(0.24 0.02 260)" }} />
          <Button disabled={addStore.isPending || !domain} onClick={() => { addStore.mutate({ label: label || domain, domain }); setLabel(""); setDomain(""); }}>Aggiungi</Button>
        </div>
        <div className="space-y-1">
          {(stores.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.015 260)" }}>
              <span>{s.label} <span className="text-muted-foreground">· {s.domain}</span> {!s.isShopify && <Badge className="ml-2">non-Shopify</Badge>}</span>
              <span className="flex items-center gap-2">
                <Badge>{s.status}</Badge>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => runNow.mutate({ id: s.id })}>run</button>
                <button className="text-xs text-red-400 hover:text-red-300" onClick={() => removeStore.mutate({ id: s.id })}>×</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cambiamenti */}
      <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <h2 className="text-sm font-semibold mb-3">Cambiamenti rilevati</h2>
        <div className="space-y-1">
          {(changes.data ?? []).map((c) => (
            <a key={c.id} href={c.url ?? "#"} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" style={{ background: "oklch(0.15 0.015 260)" }}>
              <Badge>{TYPE_LABEL[c.changeType] ?? c.changeType}</Badge>
              {c.score != null && <Badge style={{ background: "oklch(0.6 0.2 300)" }}>{c.score}</Badge>}
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-muted-foreground text-xs">{c.oldValue}{c.newValue ? " → " + c.newValue : ""}</span>
            </a>
          ))}
          {changes.data?.length === 0 && <div className="text-xs text-muted-foreground">Nessun cambiamento. Aggiungi uno store e premi "Aggiorna ora".</div>}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Monitor basato solo su dati pubblici Shopify (products.json, collezioni, ordinamento best-seller) con polling
        conservativo. Le stime di vendita sono etichettate con metodo e confidenza; dove non misurabili pubblicamente
        (es. store POD) il tool lo dichiara invece di inventare numeri. L'utente è responsabile della conformità ai
        Termini di Servizio di ciascuno store monitorato.
      </p>
    </div>
  );
}
