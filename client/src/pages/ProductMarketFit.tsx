import { useState, type ReactNode, type CSSProperties } from "react";
import { trpc } from "@/lib/trpc";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";

// ─── Light (Alura-style) UI primitives ───────────────────────────────────────
const C = { text: "#111827", muted: "#6b7280", border: "#e5e7eb", blue: "#2563eb", soft: "#f9fafb", green: "#16a34a", orange: "#ea580c" };
const inputStyle: CSSProperties = { padding: "9px 13px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, color: C.text, background: "#fff", outline: "none", flex: 1, minWidth: 0 };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "9px 8px", borderRadius: 8, fontSize: 14, color: C.text };

function Btn({ children, onClick, disabled, kind = "primary" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost" | "green" }) {
  const bg = disabled ? "#cbd5e1" : kind === "green" ? C.green : kind === "ghost" ? "#fff" : C.blue;
  const col = kind === "ghost" ? "#374151" : "#fff";
  return <button onClick={onClick} disabled={disabled} style={{ padding: "9px 15px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer", background: bg, color: col, border: kind === "ghost" ? "1px solid #d1d5db" : 0, whiteSpace: "nowrap" }}>{children}</button>;
}
function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div style={{ background: C.soft, border: "1px solid #f3f4f6", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || C.text }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Thumb({ src, size = 42 }: { src?: string | null; size?: number }) {
  return src
    ? <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#f3f4f6" }} loading="lazy" />
    : <div style={{ width: size, height: size, borderRadius: 8, background: "#eef2f7", flexShrink: 0 }} />;
}
function num(n: number | null | undefined) { return n != null ? Number(n).toLocaleString() : "?"; }
const truncate: CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 };
const hint: CSSProperties = { fontSize: 12.5, color: C.muted, marginBottom: 8 };

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, fontSize: 13, color: C.muted }}>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ background: "transparent", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 9px", cursor: page <= 1 ? "default" : "pointer", color: page <= 1 ? "#cbd5e1" : C.text }}>‹</button>
      <span>Pagina {page} di {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} style={{ background: "transparent", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 9px", cursor: page >= pages ? "default" : "pointer", color: page >= pages ? "#cbd5e1" : C.text }}>›</button>
    </div>
  );
}
const PAGE = 10;

// ─── META / TIKTOK Ad Library ─────────────────────────────────────────────────
function MetaTikTokPanel() {
  const meta = trpc.marketIntel.metaAdsScan.useMutation();
  const tiktok = trpc.marketIntel.tiktokScan.useMutation();
  const [kw, setKw] = useState(""); const [country, setCountry] = useState("IT"); const [minAds, setMinAds] = useState(3); const [ttKw, setTtKw] = useState("");
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={sectionTitle}>Meta Ad Library — brand con più ads attive</div>
        <div style={hint}>Più ads attive = più budget = maggiore probabilità di Winning Product. Ogni riga ha il link diretto alla Ad Library.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="keyword (es. teeth whitening)" style={inputStyle} />
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...inputStyle, flex: "0 0 92px" }}>{["IT", "US", "GB", "DE", "FR", "ES", "ALL"].map((c) => <option key={c}>{c}</option>)}</select>
          <select value={minAds} onChange={(e) => setMinAds(Number(e.target.value))} style={{ ...inputStyle, flex: "0 0 112px" }}>{[1, 3, 5, 10, 20].map((n) => <option key={n} value={n}>≥ {n} ads</option>)}</select>
          <Btn disabled={meta.isPending || kw.trim().length < 2} onClick={() => meta.mutate({ keyword: kw.trim(), country, minAds })}>{meta.isPending ? "Scan…" : "Scansiona Meta"}</Btn>
        </div>
        {meta.isError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 6 }}>{String(meta.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : meta.error?.message}</div>}
        {meta.data && (
          <>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{meta.data.note}</div>
            {meta.data.advertisers.map((a, i) => (
              <div key={a.advertiser + i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <Thumb src={a.imageUrl} />
                <span style={{ background: a.passesThreshold ? "#dcfce7" : "#eff6ff", color: a.passesThreshold ? C.green : C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{a.adCount} ads</span>
                <span style={truncate}>{a.advertiser}</span>
                {a.isShopify && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>Shopify</span>}
                {a.domain && <a href={`https://${a.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.muted }}>{a.domain}</a>}
                <a href={a.adLibraryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue, whiteSpace: "nowrap" }}>Ad Library ↗</a>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={sectionTitle}>TikTok Creative Center — top ads/prodotti</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={ttKw} onChange={(e) => setTtKw(e.target.value)} placeholder="keyword prodotto (opzionale)" style={inputStyle} />
          <Btn disabled={tiktok.isPending} onClick={() => tiktok.mutate({ keyword: ttKw.trim() || undefined, region: country })}>{tiktok.isPending ? "Scan…" : "Scansiona TikTok"}</Btn>
        </div>
        {tiktok.isError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 6 }}>{tiktok.error?.message}</div>}
        {tiktok.data && (
          <>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{tiktok.data.note}</div>
            {tiktok.data.items.map((t, i) => (
              <div key={i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <Thumb src={t.imageUrl} />
                <span style={truncate}>{t.title}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{t.views != null ? num(t.views) + " views" : ""}{t.likes != null ? " · " + num(t.likes) + " like" : ""}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SHOPIFY (GLITCH: Scanner + Tracker) ──────────────────────────────────────
function StoreDetail({ id }: { id: number }) {
  const detail = trpc.marketIntel.storeDetail.useQuery({ id });
  const [page, setPage] = useState(1);
  if (detail.isLoading) return <div style={{ fontSize: 13, color: C.muted, padding: "6px 10px" }}>Carico prodotti…</div>;
  const all = detail.data?.products ?? [];
  if (all.length === 0) return <div style={{ fontSize: 13, color: C.muted, padding: "6px 10px" }}>Nessun prodotto ancora tracciato. Premi "run" per la prima scansione.</div>;
  const pages = Math.ceil(all.length / PAGE);
  const slice = all.slice((page - 1) * PAGE, page * PAGE);
  return (
    <div style={{ background: C.soft, borderRadius: 8, padding: 6, margin: "4px 0 8px" }}>
      {slice.map((p) => (
        <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, padding: "7px 10px" }}>
          <Thumb src={p.imageUrl} />
          <span style={truncate}>{p.title}</span>
          {p.reviewCount != null && <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{p.reviewCount} vendite+</span>}
          {p.bestSellerRank != null && <span style={{ fontSize: 12, color: C.blue }}>#{p.bestSellerRank}</span>}
          <span style={{ fontSize: 12, color: C.muted }}>{p.minPrice != null ? "€" + p.minPrice : ""}{p.available ? "" : " · esaurito"}</span>
        </a>
      ))}
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}

function ShopifyPanel() {
  const utils = trpc.useUtils();
  const stores = trpc.marketIntel.listStores.useQuery();
  const glitch = trpc.marketIntel.glitchScan.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const addStore = trpc.marketIntel.addStore.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const runNow = trpc.marketIntel.runNow.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const removeStore = trpc.marketIntel.removeStore.useMutation({ onSuccess: () => utils.marketIntel.listStores.invalidate() });
  const [gKw, setGKw] = useState(""); const [gCountry, setGCountry] = useState("IT"); const [gMinAds, setGMinAds] = useState(5); const [gAdd, setGAdd] = useState(true);
  const [label, setLabel] = useState(""); const [domain, setDomain] = useState(""); const [openStore, setOpenStore] = useState<number | null>(null);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={sectionTitle}>Scanner GLITCH — store Shopify vincenti dalle Meta Ads</div>
        <div style={hint}>Cerca nella Meta Ad Library per keyword+paese, tiene chi punta a uno store Shopify (≥ N ads = evidenziato) e li mette in tracking.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={gKw} onChange={(e) => setGKw(e.target.value)} placeholder="keyword (es. dog bed, free shipping)" style={inputStyle} />
          <select value={gCountry} onChange={(e) => setGCountry(e.target.value)} style={{ ...inputStyle, flex: "0 0 92px" }}>{["IT", "US", "GB", "DE", "FR", "ES", "ALL"].map((c) => <option key={c}>{c}</option>)}</select>
          <select value={gMinAds} onChange={(e) => setGMinAds(Number(e.target.value))} style={{ ...inputStyle, flex: "0 0 112px" }}>{[3, 5, 10, 20, 30].map((n) => <option key={n} value={n}>≥ {n} ads</option>)}</select>
          <label style={{ fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={gAdd} onChange={(e) => setGAdd(e.target.checked)} /> in watchlist</label>
          <Btn kind="green" disabled={glitch.isPending || gKw.trim().length < 2} onClick={() => glitch.mutate({ keyword: gKw.trim(), country: gCountry, minAds: gMinAds, addToWatchlist: gAdd })}>{glitch.isPending ? "Scanner…" : "Avvia Scanner"}</Btn>
        </div>
        {glitch.isError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 6 }}>{String(glitch.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : glitch.error?.message}</div>}
        {glitch.data && (
          <div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{glitch.data.note} {glitch.data.added > 0 && <b style={{ color: C.green }}>· {glitch.data.added} store aggiunti</b>}</div>
            {glitch.data.advertisers.map((a, i) => (
              <div key={i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <Thumb src={a.imageUrl} />
                <span style={{ background: "#dcfce7", color: C.green, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{a.adCount} ads</span>
                <span style={truncate}>{a.advertiser}</span>
                {a.domain && <a href={`https://${a.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue }}>{a.domain}</a>}
                <a href={a.adLibraryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue, whiteSpace: "nowrap" }}>Ads ↗</a>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Tracker — store monitorati (clicca per riaprire i dati)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etichetta" style={inputStyle} />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="dominio-store.com" style={inputStyle} />
          <Btn kind="green" disabled={addStore.isPending || !domain} onClick={() => { addStore.mutate({ label: label || domain, domain }); setLabel(""); setDomain(""); }}>Traccia</Btn>
        </div>
        {(stores.data ?? []).map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <div style={rowStyle}>
              <button onClick={() => setOpenStore(openStore === s.id ? null : s.id)} style={{ ...truncate, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: 14 }}>
                {openStore === s.id ? "▾ " : "▸ "}{s.label} <span style={{ color: C.muted }}>· {s.domain}{s.productCount ? " · " + s.productCount + " prod" : ""}</span>
              </button>
              {!s.isShopify && <span style={{ fontSize: 11, color: C.orange }}>non-Shopify</span>}
              <span style={{ fontSize: 12, color: s.status === "active" ? C.green : C.muted }}>{s.status}</span>
              <button onClick={() => runNow.mutate({ id: s.id })} style={{ fontSize: 12, color: C.blue, background: "transparent", border: 0, cursor: "pointer" }}>run</button>
              <button onClick={() => removeStore.mutate({ id: s.id })} style={{ fontSize: 14, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
            </div>
            {openStore === s.id && <StoreDetail id={s.id} />}
          </div>
        ))}
        {stores.data?.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nessuno store. Usa lo Scanner o incolla un dominio.</div>}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Metodo: best-seller sort + recensioni per-prodotto (1 recensione = ≥1 vendita) + inventory-delta dove reale. Mai numeri inventati.</div>
      </div>
    </div>
  );
}

// ─── ETSY (metodo Alura calibrato) ────────────────────────────────────────────
function EtsyDetail({ id }: { id: number }) {
  const detail = trpc.marketIntel.etsyShopDetail.useQuery({ id });
  const [page, setPage] = useState(1);
  if (detail.isLoading) return <div style={{ fontSize: 13, color: C.muted, padding: "6px 10px" }}>Carico prodotti…</div>;
  const all = detail.data?.listings ?? [];
  if (all.length === 0) return <div style={{ fontSize: 13, color: C.muted, padding: "6px 10px" }}>Nessun prodotto salvato. Premi "run" per scansionare.</div>;
  const pages = Math.ceil(all.length / PAGE);
  const slice = all.slice((page - 1) * PAGE, page * PAGE);
  return (
    <div style={{ background: C.soft, borderRadius: 8, padding: 6, margin: "4px 0 8px" }}>
      {slice.map((l) => (
        <a key={l.id} href={l.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, padding: "7px 10px" }}>
          <Thumb src={l.imageUrl} />
          {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
          <span style={truncate}>{l.title}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{num(l.estSales)} vendite</span>
          <span style={{ fontSize: 12, color: C.muted }}>{l.reviewCount} rec · {l.currency} {l.price ?? "?"}</span>
        </a>
      ))}
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}

function EtsyPanel() {
  const analyze = trpc.marketIntel.etsyAnalyze.useMutation();
  const kw = trpc.marketIntel.etsyKeyword.useMutation();
  const watch = trpc.marketIntel.etsyWatchList.useQuery();
  const watchAdd = trpc.marketIntel.etsyWatchAdd.useMutation({ onSuccess: () => watch.refetch() });
  const watchRemove = trpc.marketIntel.etsyWatchRemove.useMutation({ onSuccess: () => watch.refetch() });
  const watchRefresh = trpc.marketIntel.etsyWatchRefresh.useMutation({ onSuccess: () => watch.refetch() });
  const [shopInput, setShopInput] = useState(""); const [filter, setFilter] = useState(""); const [q, setQ] = useState(""); const [openShop, setOpenShop] = useState<number | null>(null);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={sectionTitle}>Shop Analyzer — vendite per prodotto</div>
        <div style={hint}>Vendite = recensioni prodotto ÷ review-rate shop (recensioni ÷ vendite totali). Validato vs Alura entro 1 unità.</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={shopInput} onChange={(e) => setShopInput(e.target.value)} placeholder="URL o nome shop (es. BabylonPrints)" style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter" && shopInput.trim().length >= 3) analyze.mutate({ shop: shopInput.trim() }); }} />
          <Btn disabled={analyze.isPending || shopInput.trim().length < 3} onClick={() => analyze.mutate({ shop: shopInput.trim() })}>{analyze.isPending ? "Analisi…" : "Analizza"}</Btn>
          <Btn kind="ghost" disabled={watchAdd.isPending || shopInput.trim().length < 2} onClick={() => watchAdd.mutate({ shop: shopInput.trim() })}>+ Watchlist</Btn>
        </div>
        {analyze.isError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 6 }}>{String(analyze.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : analyze.error?.message}</div>}
        {analyze.data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
              <Stat label="Vendite tot" value={num(analyze.data.shop.totalSales)} />
              <Stat label="Recensioni" value={num(analyze.data.shop.reviewCount)} />
              <Stat label="Review rate" value={analyze.data.shop.reviewRate != null ? (analyze.data.shop.reviewRate * 100).toFixed(1) + "%" : "?"} accent={C.orange} />
              <Stat label="Vendite/mese" value={num(analyze.data.shop.avgMonthlySales)} accent={C.green} />
            </div>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtra prodotti…" style={{ ...inputStyle, width: "100%", marginBottom: 8, flex: "unset" }} />
            {analyze.data.listings.filter((l) => l.title.toLowerCase().includes(filter.toLowerCase())).map((l) => (
              <a key={l.listingId} href={l.url} target="_blank" rel="noreferrer" style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <Thumb src={l.imageUrl} />
                {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
                <span style={truncate}>{l.title}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{num(l.estSales)} vendite</span>
                <span style={{ fontSize: 12, color: C.muted }}>{l.reviewCount} rec · {l.currency} {l.price ?? "?"} · ♥{l.favorites ?? "?"}</span>
              </a>
            ))}
          </>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={sectionTitle}>Watchlist — clicca uno shop per riaprire i dati</div>
          <Btn kind="ghost" disabled={watchRefresh.isPending} onClick={() => watchRefresh.mutate({})}>{watchRefresh.isPending ? "Scan…" : "Aggiorna tutti"}</Btn>
        </div>
        {(watch.data ?? []).map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <div style={rowStyle}>
              <button onClick={() => setOpenShop(openShop === s.id ? null : s.id)} style={{ ...truncate, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: 14 }}>
                {openShop === s.id ? "▾ " : "▸ "}{s.shopName} {s.lastTotalSales != null && <span style={{ color: C.muted }}>· {num(s.lastTotalSales)} vendite · rate {s.reviewRate != null ? (Number(s.reviewRate) * 100).toFixed(1) + "%" : "?"}</span>}
              </button>
              <span style={{ fontSize: 12, color: s.status === "active" ? C.green : C.muted }}>{s.status}</span>
              <button onClick={() => watchRefresh.mutate({ id: s.id })} style={{ fontSize: 12, color: C.blue, background: "transparent", border: 0, cursor: "pointer" }}>run</button>
              <button onClick={() => watchRemove.mutate({ id: s.id })} style={{ fontSize: 14, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
            </div>
            {openShop === s.id && <EtsyDetail id={s.id} />}
          </div>
        ))}
        {watch.data?.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Aggiungi uno shop con "+ Watchlist": l'AI agent lo scansiona ogni giorno.</div>}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Keyword Research — bestseller di nicchia (cross-shop)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="keyword nicchia (es. peter pan shirt)" style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 2) kw.mutate({ query: q.trim() }); }} />
          <Btn disabled={kw.isPending || q.trim().length < 2} onClick={() => kw.mutate({ query: q.trim() })}>{kw.isPending ? "Ricerca…" : "Cerca"}</Btn>
        </div>
        {(kw.data?.listings ?? []).map((l) => (
          <a key={l.listingId} href={l.url} target="_blank" rel="noreferrer" style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
            <Thumb src={l.imageUrl} />
            {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
            <span style={truncate}>{l.title}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{num(l.reviewCount)} rec · {l.currency} {l.price ?? "?"}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── GOOGLE TRENDS ────────────────────────────────────────────────────────────
function TrendsPanel() {
  const trends = trpc.research.list.useQuery({ source: "trends", sort: "best", limit: 40 } as any);
  const items = (trends.data as any[]) ?? [];
  return (
    <div>
      <div style={hint}>Domanda &amp; trend raccolti dall'AI SEO Specialist (sezione SEO &amp; Research). Ordinati per rilevanza sul brand.</div>
      {items.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nessun trend ancora. L'AI SEO Specialist popola questo feed.</div>}
      {items.map((t) => (
        <a key={t.id} href={t.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6", alignItems: "flex-start" }}>
          <span style={{ background: "#e8f0fe", color: "#1a73e8", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{t.targetScore ?? t.viralityScore ?? "-"}/10</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{t.title}</span>
            {t.brief && <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginTop: 2 }}>{t.brief}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

// ─── DAILY PICKS (colonna destra) ─────────────────────────────────────────────
const SRC_STYLE: Record<string, { bg: string; col: string; label: string }> = {
  meta: { bg: "#e0edff", col: "#0866FF", label: "Meta/TikTok" },
  etsy: { bg: "#ffe9dc", col: "#F1641E", label: "Etsy" },
  shopify: { bg: "#dcfce7", col: "#16a34a", label: "Shopify" },
};
function DailyPicks() {
  const picks = trpc.marketIntel.dailyPicks.useQuery();
  const gen = trpc.marketIntel.generatePicks.useMutation({ onSuccess: () => picks.refetch() });
  const check = trpc.marketIntel.pickChecked.useMutation({ onSuccess: () => picks.refetch() });
  const items = picks.data ?? [];
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", padding: "13px 16px" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>⭐ Prodotti in evidenza — oggi</div>
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 11.5, marginTop: 1 }}>Scelti dall'AI agent (6 Meta/TikTok · 2 Etsy · 2 Shopify). Spunta quelli che pubblichi.</div>
      </div>
      <div style={{ padding: 12 }}>
        <Btn onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? "L'agente sta scegliendo…" : "Genera picks di oggi"}</Btn>
        {gen.data && gen.data.count === 0 && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Nessun candidato ancora: fai qualche scan (Meta/Etsy/Shopify) e la watchlist, poi rigenera.</div>}
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {items.map((p) => {
            const s = SRC_STYLE[p.source] ?? SRC_STYLE.meta;
            return (
              <div key={p.id} style={{ display: "flex", gap: 10, padding: 8, border: "1px solid #f1f5f9", borderRadius: 12, background: p.checked ? "#f0fdf4" : "#fff" }}>
                <input type="checkbox" checked={p.checked} onChange={(e) => check.mutate({ id: p.id, checked: e.target.checked })} style={{ marginTop: 4, width: 18, height: 18, flexShrink: 0 }} />
                <Thumb src={p.imageUrl} size={64} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ background: s.bg, color: s.col, borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{s.label}</span>
                    {p.score != null && <span style={{ fontSize: 11, color: C.muted }}>{p.score}/100</span>}
                  </div>
                  <a href={p.url ?? "#"} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", lineHeight: 1.25 }}>{p.title}</a>
                  {p.reason && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{p.reason}</div>}
                  {p.price && <div style={{ fontSize: 11.5, color: C.green, marginTop: 2 }}>{p.price}</div>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && !gen.isPending && <div style={{ fontSize: 12.5, color: C.muted }}>Premi "Genera picks di oggi" (o l'agente li prepara ogni mattina alle 10:00).</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Pagina ───────────────────────────────────────────────────────────────────
export default function ProductMarketFit() {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 620px", minWidth: 0, display: "grid", gap: 12 }}>
          <CollapsiblePanel brand="meta" title="Meta & TikTok Ad Library" subtitle="Brand con più ads attive & prodotti virali (metodo Kalodata / PiPiads / Minea / Winning Hunter)" defaultOpen>
            <MetaTikTokPanel />
          </CollapsiblePanel>
          <CollapsiblePanel brand="shopify" title="Shopify — Scanner & Tracker (metodo GLITCH)" subtitle="Trova store Shopify vincenti dalle Meta Ads e traccia le vendite nel tempo">
            <ShopifyPanel />
          </CollapsiblePanel>
          <CollapsiblePanel brand="etsy" title="Etsy — Product Research (metodo Alura/Everbee)" subtitle="Vendite per prodotto calibrate + watchlist shop monitorati dall'AI agent">
            <EtsyPanel />
          </CollapsiblePanel>
          <CollapsiblePanel brand="google" title="Google Trends" subtitle="Domanda & trend raccolti dall'AI SEO Specialist">
            <TrendsPanel />
          </CollapsiblePanel>
        </div>
        <div style={{ flex: "0 0 330px", position: "sticky", top: 8 }}>
          <DailyPicks />
        </div>
      </div>
    </div>
  );
}
