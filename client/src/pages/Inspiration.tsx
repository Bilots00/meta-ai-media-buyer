import { useState } from "react";
import { useLocation } from "wouter";
import { Lightbulb, Plus, Sparkles, ExternalLink, Trash2, Instagram, Music2, Youtube, Twitter, Globe, Search, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Inspo {
  id: string; url: string; note: string; image: string; format: string; platform: string; createdAt: string;
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
function load(): Inspo[] { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } }
function save(items: Inspo[]) { localStorage.setItem(LS, JSON.stringify(items)); }

function downscale(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Inspiration() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<Inspo[]>(() => load());
  const setSetting = trpc.settings.set.useMutation();
  const pushCloud = (arr: Inspo[]) => setSetting.mutate({ key: LS, value: JSON.stringify(arr) });
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState("");
  const [format, setFormat] = useState("");
  const [search, setSearch] = useState("");

  const handleFile = async (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Allega un'immagine"); return; }
    try { setImage(await downscale(f)); } catch { toast.error("Errore immagine"); }
  };

  const add = () => {
    if (!image && !url.trim() && !note.trim()) { toast.error("Allega un'immagine o inserisci URL/nota"); return; }
    const item: Inspo = { id: Date.now().toString(), url: url.trim(), note: note.trim(), image, format: format.trim(), platform: detectPlatform(url), createdAt: new Date().toISOString() };
    const next = [item, ...items];
    setItems(next); save(next); pushCloud(next);
    setUrl(""); setNote(""); setImage(""); setFormat("");
    toast.success("Riferimento salvato");
  };
  const remove = (id: string) => { const next = items.filter(i => i.id !== id); setItems(next); save(next); pushCloud(next); };

  const remix = (i: Inspo) => {
    let brandName = "DreamBrothers", brandCtx = "";
    try { const b = JSON.parse(localStorage.getItem("db_brand") || "{}"); if (b.name) brandName = b.name; if (b.products) brandCtx = b.products; } catch {}
    const brief = `Remixa questo post di riferimento nella VOCE e IDENTITA' del brand ${brandName}. Mantieni lo STESSO FORMATO/struttura del riferimento ma con i miei contenuti e il mio tono.\n\nFormato/Serie: ${i.format || "(non specificato)"}\nRiferimento: ${i.url || "(immagine allegata)"}\nNote: ${i.note || "-"}` + (brandCtx ? `\n\nContesto brand: ${brandCtx}` : "") + `\n\nGenera: hook iniziale, struttura del post passo-passo, caption pronta e hashtag.`;
    localStorage.setItem("db_remix_brief", brief);
    toast.success("Aperto nell'AI Manager — premi invio per remixare");
    navigate("/social/chat");
  };

  const filtered = items.filter(i => (i.note + " " + i.format + " " + i.url + " " + i.platform).toLowerCase().includes(search.toLowerCase()));
  const inputStyle = { background: "oklch(0.16 0.015 260)" } as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5" style={{ color: "oklch(0.8 0.16 85)" }} />
        <div>
          <h1 className="text-xl font-bold">Inspiration</h1>
          <p className="text-sm text-muted-foreground">Salva i post di riferimento e remixali con la voce del tuo brand</p>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        {/* File attach */}
        <input id="inspo-file" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {image ? (
          <div className="relative inline-block">
            <img src={image} className="h-32 rounded-lg object-cover" />
            <button onClick={() => setImage("")} className="absolute -top-2 -right-2 bg-black/70 rounded-full p-1"><X className="w-3.5 h-3.5 text-white" /></button>
          </div>
        ) : (
          <label htmlFor="inspo-file" className="flex flex-col items-center justify-center rounded-xl border border-dashed p-7 cursor-pointer hover:opacity-80" style={{ borderColor: "oklch(0.25 0.02 260)" }}>
            <ImageIcon className="w-8 h-8 mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Allega screenshot/immagine del post</span>
            <span className="text-xs text-muted-foreground mt-0.5">clicca per caricare dal tuo dispositivo</span>
          </label>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="URL del post (opzionale)" value={url} onChange={e => setUrl(e.target.value)} style={inputStyle} />
          <Input placeholder="Formato / Serie (es. 'Prima-Dopo', 'POV')" value={format} onChange={e => setFormat(e.target.value)} style={inputStyle} />
        </div>
        <Textarea placeholder="Nota: cosa ti piace di questo post? Cosa vuoi replicare?" rows={2} value={note} onChange={e => setNote(e.target.value)} className="resize-none" style={inputStyle} />
        <Button onClick={add} className="text-white" style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 265), oklch(0.45 0.2 290))" }}>
          <Plus className="w-4 h-4 mr-2" /> Salva riferimento
        </Button>
      </div>

      {items.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per formato, nota, piattaforma..." className="pl-9" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{items.length === 0 ? "Nessun riferimento ancora — allega il tuo primo post ispirazione" : "Nessun risultato"}</p>
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
