import { type ElementType } from "react";
import { Instagram, Facebook, MessageSquare, Clock, Pencil, X, Eye, Bot, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "instagram" | "facebook" | "pinterest";
type Format = "carousel" | "post" | "pin";

interface Draft {
  id: string; platform: Platform; format: Format; title: string;
  preview: string; slides?: number; createdBy: string; date: string;
}

const PLATFORMS: Record<Platform, { label: string; icon: ElementType; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, color: "oklch(0.65 0.2 340)" },
  facebook: { label: "Facebook", icon: Facebook, color: "oklch(0.5 0.18 265)" },
  pinterest: { label: "Pinterest", icon: MessageSquare, color: "oklch(0.6 0.22 25)" },
};

// La fase scheduler popolerà questa lista con le bozze reali dell'agente.
const DRAFTS: Draft[] = [
  { id: "d1", platform: "instagram", format: "carousel", title: "“For the ones they called too much”", preview: "Carosello ispirazionale (stile Gernucci) — 7 slide, zero prodotto, CTA community.", slides: 7, createdBy: "AI Social Media Manager", date: "Oggi 09:00" },
  { id: "d2", platform: "facebook", format: "post", title: "Storia — “No pressure, no diamonds”", preview: "Post storytelling in prima persona per pubblico adulto, con CTA soft.", createdBy: "AI Social Media Manager", date: "Oggi 09:00" },
  { id: "d3", platform: "pinterest", format: "pin", title: "Cozy dreamer's corner", preview: "Pin UGC pulito, nessun overlay; SEO solo nei campi titolo/descrizione.", createdBy: "AI Social Media Manager", date: "Oggi 09:00" },
];

export default function SocialDrafts() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Bozze da revisionare</h1>
            <p className="text-sm text-muted-foreground">Contenuti generati dall'AI in attesa della tua approvazione — niente viene pubblicato senza il tuo OK</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: "oklch(0.65 0.2 265 / 0.12)", border: "1px solid oklch(0.65 0.2 265 / 0.3)", color: "oklch(0.75 0.15 265)" }}>
            <Bot className="w-3.5 h-3.5" /> {DRAFTS.length} bozze pronte
          </div>
        </div>
      </div>

      {/* Drafts grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {DRAFTS.map((d) => {
          const p = PLATFORMS[d.platform]; const Icon = p.icon;
          return (
            <div key={d.id} className="rounded-2xl p-5 flex flex-col" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: `${p.color}22`, border: `1px solid ${p.color}44` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                </div>
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: "oklch(0.2 0.02 260)", color: "oklch(0.7 0.02 260)" }}>{d.format}{d.slides ? ` · ${d.slides} slide` : ""}</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">{d.title}</h3>
              <p className="text-xs text-muted-foreground flex-1">{d.preview}</p>
              <div className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5"><Bot className="w-3 h-3" />{d.createdBy} · {d.date}</div>
              <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid oklch(0.2 0.015 260)" }}>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs"><Eye className="w-3.5 h-3.5 mr-1" />Anteprima</Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs"><Pencil className="w-3.5 h-3.5 mr-1" />Modifica</Button>
                <Button size="sm" className="h-8 px-3 text-xs text-white ml-auto" style={{ background: "var(--gradient-primary)" }}><Clock className="w-3.5 h-3.5 mr-1" />Approva &amp; Pianifica</Button>
              </div>
              <button className="text-xs text-red-400/80 hover:text-red-300 mt-2 flex items-center gap-1 justify-center"><X className="w-3 h-3" />Rifiuta bozza</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
