import { useState } from "react";
import { useLocation } from "wouter";
import { Lightbulb, Plus, Sparkles, ExternalLink, Trash2, Instagram, Music2, Youtube, Twitter, Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Inspo {
  id: string;
  url: string;
  note: string;
  image: string;
  format: string;
  platform: string;
  createdAt: string;
}

const LS = "db_inspirations";

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram")) return "Instagram";
  if (u.includes("tiktok")) return "TikTok";
  if (u.includes("youtube") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("twitter") || u.includes("x.com")) return "X";
  return "Web";
}

function PlatformIcon({ p }: { p: string }) {
  const map: Record<string, { Icon: any; color: string }> = {
    Instagram: { Icon: Instagram, color: "oklch(0.65 0.2 340)" },
    TikTok: { Icon: Music2, color: "oklch(0.85 0.02 260)" },
    YouTube: { Icon: Youtube, color: "oklch(0.55 0.22 25)" },
    X: { Icon: Twitter, color: "oklch(0.85 0.02 260)" },
    Web: { Icon: Globe, color: "oklch(0.65 0.15 230)" },
  };
  const { Icon, color } = map[p] || map.Web;
  return <Icon className="w-4 h-4" style={{ color }} />;
}

function load(): Inspo[] {
  try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; }
}
function save(items: Inspo[]) { localStorage.setItem(LS, JSON.stringify(items)); }

export default function Inspiration() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<Inspo[]>(() => load());
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState("");
  const [format, setFormat] = useState("");
  const [search, setSearch] = useState("");

  const add = () => {
    if (!url.trim() && !note.trim()) { toast.error("Inserisci almeno un URL o una nota"); return; }
    const item: Inspo = {
      id: Date.now().toString(),
      url: url.trim(),
      note: note.trim(),
      image: image.trim(),
      format: format.trim(),
      platform: detectPlatform(url),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...items];
    setItems(next); save(next);
    setUrl(""); setNote(""); setImage(""); setFormat("");
    toast.success("Riferimento salvato in Inspiration");
  };

  const remove = (id: string) => {
    const next = items.filter(i => i.id !== id);
    setItems(next); save(next);
  };

  const remix = (i: Inspo) => {
    const brief = `Remixa questo post di riferimento nella VOCE e IDENTITA' del mio brand DreamBrothers. Mantieni lo STESSO FORMATO/struttura del riferimento ma con i miei contenuti e il mio tono.\n\nFormato/Serie: ${i.format || "(non specificato)"}\nRiferimento: ${i.url || "(solo nota)"}\nNote: ${i.note || "-"}\n\nGenera: hook iniziale, struttura del post passo-passo, caption pronta e hashtag.`;
    localStorage.setItem("db_remix_brief", brief);
    toast.success("Aperto nell'AI Manager — premi invio per remixare");
    navigate("/social/chat");
  };

  const filtered = items.filter(i =>
    (i.note + " " + i.format + " " + i.url + " " + i.platform).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5" style={{ color: "oklch(0.8 0.16 85)" }} />
        <div>
          <h1 className="text-xl font-bold">Inspiration</h1>
          <p className="text-sm text-muted-foreground">Salva i post di riferimento e remixali con la voce del tuo brand</p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="URL del post (Instagram, TikTok, X, YouTube...)" value={url} onChange={e => setUrl(e.target.value)} style={{ background: "oklch(0.16 0.015 260)" }} />
          <Input placeholder="Formato / Serie (es. 'Prima-Dopo', 'POV', 'Carosello 5 tips')" value={format} onChange={e => setFormat(e.target.value)} style={{ background: "oklch(0.16 0.015 260)" }} />
        </div>
        <Input placeholder="URL immagine/screenshot (opzionale)" value={image} onChange={e => setImage(e.target.value)} style={{ background: "oklch(0.16 0.015 260)" }} />
        <Textarea placeholder="Nota: cosa ti piace di questo post? Cosa vuoi replicare?" rows={2} value={note} onChange={e => setNote(e.target.value)} className="resize-none" style={{ background: "oklch(0.16 0.015 260)" }} />
        <Button onClick={add} className="text-white" style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 265), oklch(0.45 0.2 290))" }}>
          <Plus className="w-4 h-4 mr-2" /> Salva riferimento
        </Button>
      </div>

      {/* Search */}
      {items.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per formato, nota, piattaforma..." className="pl-9" />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{items.length === 0 ? "Nessun riferimento ancora — salva il tuo primo post ispirazione" : "Nessun risultato"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(i => (
            <div key={i.id} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
              {i.image ? (
                <div className="aspect-video overflow-hidden" style={{ background: "oklch(0.12 0.01 260)" }}>
                  <img src={i.image} alt={i.format || "inspiration"} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ) : null}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><PlatformIcon p={i.platform} /><span className="text-xs text-muted-foreground">{i.platform}</span></div>
                  {i.format && <Badge variant="outline" className="text-xs">{i.format}</Badge>}
                </div>
                {i.note && <p className="text-sm text-foreground/90 line-clamp-3">{i.note}</p>}
                {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 truncate"><ExternalLink className="w-3 h-3 shrink-0" />{i.url}</a>}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <Button size="sm" onClick={() => remix(i)} className="flex-1 text-white gap-1.5" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 300), oklch(0.55 0.2 320))" }}>
                    <Sparkles className="w-3.5 h-3.5" /> Remix
                  </Button>
                  <button onClick={() => remove(i.id)} className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-accent" title="Elimina"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
