import { useState } from "react";
import { BookOpen, RefreshCw, ExternalLink, Sparkles, Trash2, Globe, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "—";

export default function SeoBlogs() {
  const utils = trpc.useUtils();
  const config = trpc.research.getConfig.useQuery();
  const items = trpc.research.list.useQuery(
    { source: "blog", hours: 0, sort: "recent", limit: 100 },
    { refetchInterval: 120000 }
  );

  const [feedsText, setFeedsText] = useState<string | null>(null);
  const feeds = config.data?.sources.blogFeeds ?? [];
  const shownFeeds = feedsText ?? feeds.join("\n");

  const invalidate = () => { utils.research.list.invalidate(); utils.research.getConfig.invalidate(); };

  const saveConfig = trpc.research.saveConfig.useMutation({
    onSuccess: () => { toast.success("Blog salvati — premi Aggiorna feed per importare gli articoli"); setFeedsText(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const refresh = trpc.research.refresh.useMutation({
    onSuccess: (r) => {
      invalidate();
      const blogErrs = r.errors.filter((e) => e.startsWith("blog "));
      if (blogErrs.length) toast.warning(`Feed aggiornato, ma ${blogErrs.length} blog in errore`, { description: blogErrs[0], duration: 10000 });
      else toast.success(`Feed aggiornato: ${r.stored} nuovi contenuti`);
    },
    onError: (e) => toast.error(e.message),
  });
  const generate = trpc.research.generateContent.useMutation({
    onSuccess: (r) => {
      invalidate();
      if (r.ok && r.delegated) toast.success("🧠 Riscrittura inviata al tuo agente Claude — le bozze arriveranno in Bozze");
      else if (r.ok) toast.success(`✅ ${r.draftIds?.length ?? 0} bozze create — vai in Bozze per revisionarle`, { duration: 8000 });
      else if (r.skipped) toast.warning(r.error ?? "Scartato dal gate di qualità");
      else toast.error(r.error ?? "Errore");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveFeeds = () => {
    if (!config.data) return;
    const list = shownFeeds.split("\n").map((s) => s.trim()).filter(Boolean);
    saveConfig.mutate({ sources: { ...config.data.sources, blogFeeds: list } });
  };

  const list = items.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 flex items-center gap-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Blog Post</h1>
          <p className="text-sm text-muted-foreground">Blog e siti competitor da cui prendere spunto: l'AI riscrive gli articoli in chiave brand con le keyword del Research Hub. Mai copie: pezzi originali, migliori.</p>
        </div>
        <Button size="sm" className="h-9 text-white ml-auto" style={{ background: "var(--gradient-primary)" }} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refresh.isPending ? "animate-spin" : ""}`} />{refresh.isPending ? "Scansione..." : "Aggiorna feed"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
        {/* Gestione blog monitorati */}
        <div className="rounded-2xl p-4 space-y-3 lg:sticky lg:top-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          <h2 className="text-sm font-semibold flex items-center gap-2"><Globe className="w-4 h-4" />Blog monitorati</h2>
          <p className="text-xs text-muted-foreground">Un sito per riga: URL del blog (il feed RSS/Atom viene trovato da solo, funziona anche coi blog Shopify) oppure URL diretto del feed.</p>
          <Textarea rows={8} value={shownFeeds} onChange={(e) => setFeedsText(e.target.value)}
            placeholder={"https://blogcompetitor1.com\nhttps://brand2.com/blogs/news\nhttps://sito3.com/feed"}
            className="text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
          <Button size="sm" className="h-9 w-full text-white" style={{ background: "var(--gradient-primary)" }}
            disabled={saveConfig.isPending || !config.data} onClick={saveFeeds}>
            Salva blog
          </Button>
        </div>

        {/* Articoli raccolti */}
        <div className="space-y-2">
          {list.length === 0 && (
            <div className="rounded-2xl p-10 text-center text-sm text-muted-foreground" style={{ background: "oklch(0.13 0.015 260)", border: "1px dashed oklch(0.22 0.015 260)" }}>
              Nessun articolo ancora. Aggiungi i blog competitor a sinistra, salva e premi <b>Aggiorna feed</b>. 📚
            </div>
          )}
          {list.map((i) => (
            <div key={i.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
              <span className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: "oklch(0.6 0.15 250 / 0.15)", border: "1px solid oklch(0.6 0.15 250 / 0.35)" }}>
                <BookOpen className="w-3.5 h-3.5" style={{ color: "oklch(0.7 0.15 250)" }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{i.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {i.sourceDetail} · {fmtDate(i.publishedAt ?? i.fetchedAt)}
                  {i.status === "usato" && <span style={{ color: "oklch(0.75 0.15 265)" }}> · Riscritto</span>}
                  {i.angle && <span> · 💡 {i.angle.slice(0, 60)}...</span>}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" className="h-8 px-3 text-xs text-white" style={{ background: "var(--gradient-primary)" }}
                  disabled={generate.isPending}
                  onClick={() => generate.mutate({ id: i.id, formats: ["blog", "x", "facebook"], rewrite: true })}>
                  <PenLine className={`w-3.5 h-3.5 mr-1 ${generate.isPending ? "animate-pulse" : ""}`} />Riscrivi in chiave brand
                </Button>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Apri originale"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
