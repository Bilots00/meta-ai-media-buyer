import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Image as ImageIcon, X, LogOut, FileText, Upload } from "lucide-react";

const LS = "db_brand";

interface BrandDoc { name: string; size: number; type: string; text: string; }
interface Brand {
  name: string; language: string; website: string;
  products: string; customers: string; location: string;
  topics: string; visuals: string[]; documents: BrandDoc[];
}
const empty: Brand = { name: "DreamBrothers", language: "Italiano", website: "", products: "", customers: "", location: "Worldwide", topics: "", visuals: [], documents: [] };

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

const CAP = 20000;
async function extractText(file: File): Promise<string> {
  const n = file.name.toLowerCase();
  try {
    if (n.endsWith(".txt") || n.endsWith(".md")) return (await file.text()).slice(0, CAP);
    if (n.endsWith(".pdf")) {
      const pdfjs: any = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let p = 1; p <= pdf.numPages && text.length < CAP; p++) {
        const page = await pdf.getPage(p);
        const c = await page.getTextContent();
        text += c.items.map((it: any) => it.str).join(" ") + "\n";
      }
      return text.slice(0, CAP);
    }
  } catch { /* best effort */ }
  return "";
}

function fmtSize(b: number) { return b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB"; }

export default function Settings() {
  const { logout, user } = useAuth();
  const [brand, setBrand] = useState<Brand>(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return empty; }
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Brand, v: any) => setBrand(b => ({ ...b, [k]: v }));
  const save = () => { localStorage.setItem(LS, JSON.stringify(brand)); toast.success("Dati del brand salvati"); };

  const onVisuals = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all([...files].filter(f => f.type.startsWith("image/")).map(f => downscale(f)));
      set("visuals", [...brand.visuals, ...urls]);
    } catch { toast.error("Errore immagini"); }
  };

  const onDocs = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      const docs = [...brand.documents];
      for (const f of [...files]) {
        const text = await extractText(f);
        docs.push({ name: f.name, size: f.size, type: f.name.split(".").pop() || "", text });
      }
      set("documents", docs);
      const extracted = docs.filter(d => d.text).length;
      toast.success(`${files.length} documenti aggiunti${extracted ? ` (${extracted} con testo estratto)` : ""}`);
    } catch { toast.error("Errore documenti"); }
    finally { setBusy(false); }
  };

  const inputStyle = { background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" } as const;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" style={{ color: "oklch(0.65 0.2 265)" }} />
          <div>
            <h1 className="text-xl font-bold">Impostazioni</h1>
            <p className="text-sm text-muted-foreground">My Brand — contesto usato dall'AI per generare i contenuti</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-muted-foreground"><LogOut className="w-4 h-4" /> Logout</Button>
      </div>

      <div className="rounded-2xl p-6 space-y-5" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basics</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Nome Brand</label>
            <Input value={brand.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Lingua dei contenuti</label>
            <Select value={brand.language} onValueChange={v => set("language", v)}>
              <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Italiano">Italiano</SelectItem>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Español">Español</SelectItem>
                <SelectItem value="Français">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Website</label>
          <Input value={brand.website} onChange={e => set("website", e.target.value)} placeholder="https://dream-brothers.com/" style={inputStyle} />
        </div>

        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Il tuo Business</div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Cosa offri (prodotti/servizi)</label>
          <Textarea rows={4} value={brand.products} onChange={e => set("products", e.target.value)} className="resize-none" style={inputStyle} placeholder="Descrivi il tuo brand, missione, valori..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Cliente ideale</label>
            <Textarea rows={3} value={brand.customers} onChange={e => set("customers", e.target.value)} className="resize-none" style={inputStyle} placeholder="Chi è il tuo cliente ideale?" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Dove sono i clienti</label>
            <Input value={brand.location} onChange={e => set("location", e.target.value)} style={inputStyle} placeholder="Worldwide" />
          </div>
        </div>

        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Contenuti</div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Di cosa parli? (temi) — opzionale, il contesto principale arriva dai documenti</label>
          <Textarea rows={2} value={brand.topics} onChange={e => set("topics", e.target.value)} className="resize-none" style={inputStyle} placeholder="Quali argomenti risuonano col tuo pubblico?" />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Brand Visuals (opzionale)</label>
          <input id="brand-visuals" type="file" accept="image/*" multiple className="hidden" onChange={e => onVisuals(e.target.files)} />
          <div className="flex gap-2 flex-wrap">
            {brand.visuals.map((v, i) => (
              <div key={i} className="relative">
                <img src={v} className="w-20 h-20 rounded-lg object-cover" />
                <button onClick={() => set("visuals", brand.visuals.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-black/70 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
              </div>
            ))}
            <label htmlFor="brand-visuals" className="w-20 h-20 rounded-lg border border-dashed flex flex-col items-center justify-center cursor-pointer text-muted-foreground" style={{ borderColor: "oklch(0.25 0.02 260)" }}>
              <ImageIcon className="w-5 h-5" /><span className="text-[10px] mt-1">Allega</span>
            </label>
          </div>
        </div>

        {/* Brand Documents */}
        <div className="space-y-2 pt-2">
          <label className="text-sm font-semibold">Brand Documents</label>
          <p className="text-xs text-muted-foreground">Carica USP, buyer persona, brand identity, business doc... Il testo viene estratto e usato come contesto per l'AI (PDF e TXT supportati).</p>
          <input id="brand-docs" type="file" accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx" multiple className="hidden" onChange={e => onDocs(e.target.files)} />
          <div className="space-y-1.5">
            {brand.documents.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}>
                <FileText className="w-4 h-4 shrink-0" style={{ color: "oklch(0.65 0.2 265)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtSize(d.size)} · {d.text ? `${d.text.length} caratteri estratti ✓` : "testo non estratto (formato non supportato)"}</p>
                </div>
                <button onClick={() => set("documents", brand.documents.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <label htmlFor="brand-docs" className="flex flex-col items-center justify-center rounded-xl border border-dashed p-7 cursor-pointer hover:opacity-80" style={{ borderColor: "oklch(0.25 0.02 260)" }}>
            <Upload className="w-7 h-7 mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{busy ? "Estrazione testo in corso..." : "Trascina o clicca per caricare documenti"}</span>
            <span className="text-xs text-muted-foreground mt-0.5">.pdf, .txt, .md, .doc, .docx, .ppt, .pptx</span>
          </label>
        </div>

        <Button onClick={save} className="w-full text-white font-semibold" style={{ background: "var(--gradient-primary)" }}>
          <Save className="w-4 h-4 mr-2" /> Salva Brand
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">Account: {user?.email}</p>
    </div>
  );
}
