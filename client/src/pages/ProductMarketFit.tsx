import { useState, type ReactNode, type CSSProperties } from "react";
import { trpc } from "@/lib/trpc";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";

// ─── Light (Alura-style) UI primitives ───────────────────────────────────────
const C = { text: "#111827", muted: "#6b7280", border: "#e5e7eb", blue: "#2563eb", soft: "#f9fafb", green: "#16a34a", orange: "#ea580c" };
const inputStyle: CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, color: C.text, background: "#fff", outline: "none", flex: 1, minWidth: 0 };

function Btn({ children, onClick, disabled, kind = "primary" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost" | "green" }) {
  const bg = disabled ? "#cbd5e1" : kind === "green" ? C.green : kind === "ghost" ? "#fff" : C.blue;
  const col = kind === "ghost" ? "#374151" : "#fff";
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", background: bg, color: col, border: kind === "ghost" ? "1px solid #d1d5db" : 0, whiteSpace: "nowrap" }}>{children}</button>
  );
}
function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div style={{ background: C.soft, border: "1px solid #f3f4f6", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent || C.text }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, fontSize: 13, color: C.text };
function num(n: number | null | undefined) { return n != null ? Number(n).toLocaleString() : "?"; }

// ─── META / TIKTOK Ad Library (metodo Kalodata / PiPiads / Minea) ─────────────
function MetaTikTokPanel() {
  const meta = trpc.marketIntel.metaAdsScan.useMutation();
  const tiktok = trpc.marketIntel.tiktokScan.useMutation();
  const [kw, setKw] = useState("");
  const [country, setCountry] = useState("IT");
  const [minAds, setMinAds] = useState(3);
  const [ttKw, setTtKw] = useState("");
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>Meta Ad Library — brand con più ads attive</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="keyword (es. teeth whitening)" style={inputStyle} />
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...inputStyle, flex: "0 0 90px" }}>
            {["IT", "US", "GB", "DE", "FR", "ES", "ALL"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={minAds} onChange={(e) => setMinAds(Number(e.target.value))} style={{ ...inputStyle, flex: "0 0 110px" }}>
            {[1, 3, 5, 10, 20].map((n) => <option key={n} value={n}>≥ {n} ads</option>)}
          </select>
          <Btn disabled={meta.isPending || kw.trim().length < 2} onClick={() => meta.mutate({ keyword: kw.trim(), country, minAds })}>{meta.isPending ? "Scan…" : "Scansiona Meta"}</Btn>
        </div>
        {meta.isError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 6 }}>{String(meta.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : meta.error?.message}</div>}
        {meta.data && (
          <>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{meta.data.note}</div>
            {meta.data.advertisers.map((a, i) => (
              <div key={a.advertiser + i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ background: "#eff6ff", color: C.blue, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{a.adCount} ads</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.advertiser}</span>
                {a.isShopify && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>Shopify</span>}
                {a.domain && <a href={`https://${a.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.muted }}>{a.domain}</a>}
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>TikTok Creative Center — top ads/prodotti</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={ttKw} onChange={(e) => setTtKw(e.target.value)} placeholder="keyword prodotto (opzionale)" style={inputStyle} />
          <Btn disabled={tiktok.isPending} onClick={() => tiktok.mutate({ keyword: ttKw.trim() || undefined, region: country })}>{tiktok.isPending ? "Scan…" : "Scansiona TikTok"}</Btn>
        </div>
        {tiktok.isError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 6 }}>{tiktok.error?.message}</div>}
        {tiktok.data && (
          <>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{tiktok.data.note}</div>
            {tiktok.data.items.map((t, i) => (
              <div key={i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{t.views != null ? num(t.views) + " views" : ""} {t.likes != null ? "· " + num(t.likes) + " like" : ""}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>Metodo Kalodata/PiPiads/Minea/Winning Hunter: più ads attive = più budget = maggiore probabilità di Winning Product. Estrazione ad-library best-effort (pagine JS/anti-bot).</div>
    </div>
  );
}

// ─── SHOPIFY (metodo GLITCH: Scanner + Tracker) ───────────────────────────────
function StoreDetail({ id }: { id: number }) {
  const detail = trpc.marketIntel.storeDetail.useQuery({ id });
  if (detail.isLoading) return <div style={{ fontSize: 12, color: C.muted, padding: "6px 10px" }}>Carico prodotti…</div>;
  const products = detail.data?.products ?? [];
  if (products.length === 0) return <div style={{ fontSize: 12, color: C.muted, padding: "6px 10px" }}>Nessun prodotto ancora tracciato. Premi "run" per la prima scansione.</div>;
  return (
    <div style={{ background: C.soft, borderRadius: 8, padding: 6, margin: "4px 0 8px" }}>
      {products.slice(0, 40).map((p) => (
        <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, padding: "6px 10px" }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
          {p.bestSellerRank != null && <span style={{ fontSize: 11, color: C.blue }}>#{p.bestSellerRank}</span>}
          <span style={{ fontSize: 11, color: C.muted }}>{p.minPrice != null ? "€" + p.minPrice : ""} {p.available ? "" : "· esaurito"}</span>
        </a>
      ))}
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
  const [label, setLabel] = useState(""); const [domain, setDomain] = useState("");
  const [openStore, setOpenStore] = useState<number | null>(null);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* GLITCH Scanner */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>Scanner GLITCH — trova store Shopify vincenti dalle Meta Ads</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Cerca nella Meta Ad Library per keyword+paese, tiene solo chi ha ≥ N ads attive E punta a uno store Shopify, e li mette in tracking.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={gKw} onChange={(e) => setGKw(e.target.value)} placeholder="keyword (es. free shipping, dog bed)" style={inputStyle} />
          <select value={gCountry} onChange={(e) => setGCountry(e.target.value)} style={{ ...inputStyle, flex: "0 0 90px" }}>{["IT", "US", "GB", "DE", "FR", "ES", "ALL"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={gMinAds} onChange={(e) => setGMinAds(Number(e.target.value))} style={{ ...inputStyle, flex: "0 0 110px" }}>{[3, 5, 10, 20, 30].map((n) => <option key={n} value={n}>≥ {n} ads</option>)}</select>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={gAdd} onChange={(e) => setGAdd(e.target.checked)} /> in watchlist</label>
          <Btn kind="green" disabled={glitch.isPending || gKw.trim().length < 2} onClick={() => glitch.mutate({ keyword: gKw.trim(), country: gCountry, minAds: gMinAds, addToWatchlist: gAdd })}>{glitch.isPending ? "Scanner…" : "Avvia Scanner"}</Btn>
        </div>
        {glitch.isError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 6 }}>{String(glitch.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : glitch.error?.message}</div>}
        {glitch.data && (
          <div style={{ fontSize: 12, color: C.muted }}>
            {glitch.data.note} {glitch.data.added > 0 && <b style={{ color: C.green }}>· {glitch.data.added} store aggiunti alla watchlist</b>}
            {glitch.data.advertisers.map((a, i) => (
              <div key={i} style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ background: "#dcfce7", color: C.green, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{a.adCount} ads</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.advertiser}</span>
                {a.domain && <a href={`https://${a.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.blue }}>{a.domain}</a>}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Tracker / Watchlist store */}
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Tracker — store Shopify monitorati (clicca per riaprire i dati)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etichetta" style={inputStyle} />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="dominio-store.com" style={inputStyle} />
          <Btn kind="green" disabled={addStore.isPending || !domain} onClick={() => { addStore.mutate({ label: label || domain, domain }); setLabel(""); setDomain(""); }}>Traccia</Btn>
        </div>
        {(stores.data ?? []).map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <div style={rowStyle}>
              <button onClick={() => setOpenStore(openStore === s.id ? null : s.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {openStore === s.id ? "▾ " : "▸ "}{s.label} <span style={{ color: C.muted }}>· {s.domain}{s.productCount ? " · " + s.productCount + " prod" : ""}</span>
              </button>
              {!s.isShopify && <span style={{ fontSize: 10, color: C.orange }}>non-Shopify</span>}
              <span style={{ fontSize: 11, color: s.status === "active" ? C.green : C.muted }}>{s.status}</span>
              <button onClick={() => runNow.mutate({ id: s.id })} style={{ fontSize: 11, color: C.blue, background: "transparent", border: 0, cursor: "pointer" }}>run</button>
              <button onClick={() => removeStore.mutate({ id: s.id })} style={{ fontSize: 13, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
            </div>
            {openStore === s.id && <StoreDetail id={s.id} />}
          </div>
        ))}
        {stores.data?.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Nessuno store. Usa lo Scanner o incolla un dominio.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Vendite tracciate col metodo onesto (inventory-delta dove l'inventario è reale; POD → domanda relativa). Mai numeri inventati.</div>
      </div>
    </div>
  );
}

// ─── ETSY (metodo Alura calibrato) ────────────────────────────────────────────
function EtsyDetail({ id }: { id: number }) {
  const detail = trpc.marketIntel.etsyShopDetail.useQuery({ id });
  if (detail.isLoading) return <div style={{ fontSize: 12, color: C.muted, padding: "6px 10px" }}>Carico prodotti…</div>;
  const listings = detail.data?.listings ?? [];
  if (listings.length === 0) return <div style={{ fontSize: 12, color: C.muted, padding: "6px 10px" }}>Nessun prodotto salvato. Premi "run" per scansionare.</div>;
  return (
    <div style={{ background: C.soft, borderRadius: 8, padding: 6, margin: "4px 0 8px" }}>
      {listings.map((l) => (
        <a key={l.id} href={l.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, padding: "6px 10px" }}>
          {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{num(l.estSales)} vendite</span>
          <span style={{ fontSize: 11, color: C.muted }}>{l.reviewCount} rec · {l.currency} {l.price ?? "?"}</span>
        </a>
      ))}
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
  const [shopInput, setShopInput] = useState(""); const [filter, setFilter] = useState(""); const [q, setQ] = useState("");
  const [openShop, setOpenShop] = useState<number | null>(null);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Shop Analyzer */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>Shop Analyzer — vendite per prodotto</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Vendite = recensioni prodotto ÷ review-rate shop (recensioni ÷ vendite totali, dati pubblici). Validato vs Alura entro 1 unità.</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={shopInput} onChange={(e) => setShopInput(e.target.value)} placeholder="URL o nome shop (es. BabylonPrints)" style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter" && shopInput.trim().length >= 3) analyze.mutate({ shop: shopInput.trim() }); }} />
          <Btn disabled={analyze.isPending || shopInput.trim().length < 3} onClick={() => analyze.mutate({ shop: shopInput.trim() })}>{analyze.isPending ? "Analisi…" : "Analizza"}</Btn>
          <Btn kind="ghost" disabled={watchAdd.isPending || shopInput.trim().length < 2} onClick={() => watchAdd.mutate({ shop: shopInput.trim() })}>+ Watchlist</Btn>
        </div>
        {analyze.isError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 6 }}>{String(analyze.error?.message || "").includes("FIRECRAWL") ? "Manca FIRECRAWL_API_KEY sul server." : analyze.error?.message}</div>}
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
                {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{num(l.estSales)} vendite</span>
                <span style={{ fontSize: 11, color: C.muted }}>{l.reviewCount} rec · {l.currency} {l.price ?? "?"} · ♥{l.favorites ?? "?"}</span>
              </a>
            ))}
          </>
        )}
      </div>
      {/* Watchlist con riapertura */}
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Watchlist — clicca uno shop per riaprire i dati salvati</div>
          <Btn kind="ghost" disabled={watchRefresh.isPending} onClick={() => watchRefresh.mutate({})}>{watchRefresh.isPending ? "Scan…" : "Aggiorna tutti"}</Btn>
        </div>
        {(watch.data ?? []).map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <div style={rowStyle}>
              <button onClick={() => setOpenShop(openShop === s.id ? null : s.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {openShop === s.id ? "▾ " : "▸ "}{s.shopName} {s.lastTotalSales != null && <span style={{ color: C.muted }}>· {num(s.lastTotalSales)} vendite · rate {s.reviewRate != null ? (Number(s.reviewRate) * 100).toFixed(1) + "%" : "?"}</span>}
              </button>
              <span style={{ fontSize: 11, color: s.status === "active" ? C.green : C.muted }}>{s.status}</span>
              <button onClick={() => watchRefresh.mutate({ id: s.id })} style={{ fontSize: 11, color: C.blue, background: "transparent", border: 0, cursor: "pointer" }}>run</button>
              <button onClick={() => watchRemove.mutate({ id: s.id })} style={{ fontSize: 13, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
            </div>
            {openShop === s.id && <EtsyDetail id={s.id} />}
          </div>
        ))}
        {watch.data?.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Aggiungi uno shop con "+ Watchlist": l'AI agent lo scansiona ogni giorno per i prodotti vincenti.</div>}
      </div>
      {/* Keyword research */}
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Keyword Research — bestseller di nicchia (cross-shop)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="keyword nicchia (es. peter pan shirt)" style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 2) kw.mutate({ query: q.trim() }); }} />
          <Btn disabled={kw.isPending || q.trim().length < 2} onClick={() => kw.mutate({ query: q.trim() })}>{kw.isPending ? "Ricerca…" : "Cerca"}</Btn>
        </div>
        {(kw.data?.listings ?? []).map((l) => (
          <a key={l.listingId} href={l.url} target="_blank" rel="noreferrer" style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}>
            {l.isBestseller && <span style={{ background: "#dcfce7", color: C.green, borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>BS</span>}
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{num(l.reviewCount)} rec · {l.currency} {l.price ?? "?"}</span>
          </a>
        ))}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>I vincitori sono validazione + ispirazione: redesign e copy tuoi, mai copia.</div>
      </div>
    </div>
  );
}

// ─── GOOGLE TRENDS (feed dell'AI SEO Specialist) ──────────────────────────────
function TrendsPanel() {
  const trends = trpc.research.list.useQuery({ source: "trends", sort: "best", limit: 40 } as any);
  const items = (trends.data as any[]) ?? [];
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Dati raccolti dall'AI SEO Specialist nella sezione SEO &amp; Research (Google Trends). Ordinati per rilevanza sul brand.</div>
      {items.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Nessun trend ancora. L'AI SEO Specialist popola questo feed dalla sezione SEO &amp; Research.</div>}
      {items.map((t) => (
        <a key={t.id} href={t.url ?? "#"} target="_blank" rel="noreferrer" style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6", alignItems: "flex-start" }}>
          <span style={{ background: "#e8f0fe", color: "#1a73e8", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{t.targetScore ?? t.viralityScore ?? "-"}/10</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600 }}>{t.title}</span>
            {t.brief && <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 2 }}>{t.brief}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

// ─── Pagina ───────────────────────────────────────────────────────────────────
export default function ProductMarketFit() {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 16, padding: 16, maxWidth: 1000 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <CollapsiblePanel brand="meta" title="Meta & TikTok Ad Library" subtitle="Brand con più ads attive & prodotti virali (metodo Kalodata / PiPiads / Minea / Winning Hunter)" defaultOpen>
          <MetaTikTokPanel />
        </CollapsiblePanel>

        <CollapsiblePanel brand="shopify" title="Shopify — Scanner & Tracker (metodo GLITCH)" subtitle="Trova store Shopify vincenti dalle Meta Ads e traccia le vendite nel tempo" defaultOpen>
          <ShopifyPanel />
        </CollapsiblePanel>

        <CollapsiblePanel brand="etsy" title="Etsy — Product Research (metodo Alura/Everbee)" subtitle="Vendite per prodotto calibrate + watchlist shop monitorati dall'AI agent" defaultOpen>
          <EtsyPanel />
        </CollapsiblePanel>

        <CollapsiblePanel brand="google" title="Google Trends" subtitle="Domanda & trend raccolti dall'AI SEO Specialist">
          <TrendsPanel />
        </CollapsiblePanel>
      </div>
    </div>
  );
}
