import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Calendar, MessageSquare, PenSquare, Instagram, Facebook, Twitter, Youtube, Send, Sparkles, TrendingUp, Clock, Plus, Image as ImageIcon, Hash, Repeat2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = "calendar" | "chat" | "create";
type Platform = "instagram" | "facebook" | "tiktok" | "youtube";
type PostStatus = "scheduled" | "published" | "draft";

interface Post {
  id: string;
  platform: Platform;
  content: string;
  date: string;
  time: string;
  status: PostStatus;
  type: "reel" | "post" | "story" | "carousel";
  tags?: string[];
}

interface Message {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const WEEK_POSTS: Post[] = [
  { id: "1", platform: "instagram", content: "🔥 Nuova collezione disponibile! Ogni pezzo racconta una storia — design esclusivi che trasformano i tuoi spazi.", date: "Lun 9 Giu", time: "09:00", status: "scheduled", type: "reel", tags: ["#wallart", "#homedecor", "#dreambrothers"] },
  { id: "2", platform: "facebook", content: "Spedizione gratuita questo weekend su tutti gli ordini superiori a €50 🎁 Non perdere questa occasione!", date: "Lun 9 Giu", time: "18:00", status: "scheduled", type: "post", tags: ["#offerta", "#spedizionegratis"] },
  { id: "3", platform: "instagram", content: "Behind the scenes: come nascono i nostri quadri premium ✨ Il processo creativo dalla concept alla stampa finale.", date: "Mar 10 Giu", time: "11:00", status: "draft", type: "carousel", tags: ["#behindthescenes", "#print"] },
  { id: "4", platform: "tiktok", content: "POV: trasformi la tua camera con un solo quadro 👀 Prima e dopo incredibile!", date: "Mer 11 Giu", time: "19:00", status: "scheduled", type: "reel", tags: ["#roomtransformation", "#tiktok"] },
  { id: "5", platform: "instagram", content: "🎨 Scegli il tuo stile: Minimal, Boldness o Nature? Rispondi nei commenti e ti suggerisco il design perfetto.", date: "Gio 12 Giu", time: "10:00", status: "scheduled", type: "post", tags: ["#style", "#interiordesign"] },
  { id: "6", platform: "youtube", content: "Nuovo VIDEO: Guida completa come arredare il living con wall art — 5 errori da evitare e 5 trucchi PRO", date: "Ven 13 Giu", time: "16:00", status: "draft", type: "reel", tags: ["#youtube", "#homedecortips"] },
];

const AI_SUGGESTIONS = [
  "Analizza i trend della settimana nella mia nicchia",
  "Crea 3 hook virali per un Reel sui quadri astratti",
  "Ottimizza il caption del post di lunedì per più engagement",
  "Suggerisci gli orari migliori per postare su Instagram questa settimana",
  "Genera 5 idee contenuto basate sui trend TikTok di giugno",
  "Scrivi una sequenza di Stories per il lancio del nuovo prodotto",
];

const PLATFORM_CONFIG = {
  instagram: { label: "Instagram", icon: Instagram, color: "oklch(0.65 0.2 340)" },
  facebook: { label: "Facebook", icon: Facebook, color: "oklch(0.5 0.18 265)" },
  tiktok: { label: "TikTok", icon: Repeat2, color: "oklch(0.97 0.005 260)" },
  youtube: { label: "YouTube", icon: Youtube, color: "oklch(0.55 0.22 25)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  const cfg = PLATFORM_CONFIG[platform];
  const Icon = cfg.icon;
  return (
    <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: size + 12, height: size + 12, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}>
      <Icon style={{ width: size, height: size, color: cfg.color }} />
    </div>
  );
}

function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = {
    scheduled: { label: "Pianificato", color: "oklch(0.65 0.2 265)" },
    published: { label: "Pubblicato", color: "oklch(0.6 0.18 145)" },
    draft: { label: "Bozza", color: "oklch(0.6 0.02 260)" },
  }[status];
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
      {cfg.label}
    </span>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarView() {
  const days = ["Lun 9 Giu", "Mar 10 Giu", "Mer 11 Giu", "Gio 12 Giu", "Ven 13 Giu", "Sab 14 Giu", "Dom 15 Giu"];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Calendar, label: "Post settimana", value: "6", color: "oklch(0.65 0.2 265)" },
          { icon: Clock, label: "In programmazione", value: "4", color: "oklch(0.6 0.18 145)" },
          { icon: TrendingUp, label: "Reach stimato", value: "12.4K", color: "oklch(0.65 0.2 310)" },
          { icon: BarChart2, label: "Eng. rate medio", value: "3.8%", color: "oklch(0.7 0.18 60)" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Weekly grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="grid grid-cols-7 divide-x" style={{ borderBottom: "1px solid oklch(0.2 0.015 260)", divideColor: "oklch(0.2 0.015 260)" }}>
          {days.map((day) => (
            <div key={day} className="p-3 text-center text-xs font-medium text-muted-foreground">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x min-h-48" style={{ divideColor: "oklch(0.2 0.015 260)" }}>
          {days.map((day) => {
            const dayPosts = WEEK_POSTS.filter((p) => p.date === day);
            return (
              <div key={day} className="p-2 space-y-2">
                {dayPosts.map((post) => (
                  <div key={post.id} className="rounded-lg p-2 text-xs space-y-1 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}>
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={post.platform} size={10} />
                      <span className="text-muted-foreground">{post.time}</span>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="text-foreground line-clamp-2 leading-tight">{post.content}</p>
                    <Badge variant="outline" className="text-xs py-0 px-1 h-4">{post.type}</Badge>
                  </div>
                ))}
                <button className="w-full rounded-lg border border-dashed py-1 text-center text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors" style={{ borderColor: "oklch(0.22 0.015 260)" }}>
                  <Plus className="w-3 h-3 inline" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Prossimi post pianificati</h3>
        {WEEK_POSTS.map((post) => (
          <div key={post.id} className="rounded-2xl p-4 flex items-start gap-4 hover:opacity-90 transition-opacity" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
            <PlatformIcon platform={post.platform} size={18} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">{post.date} · {post.time}</span>
                <StatusBadge status={post.status} />
                <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">{post.type}</Badge>
              </div>
              <p className="text-sm text-foreground line-clamp-2">{post.content}</p>
              {post.tags && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {post.tags.map((t) => <span key={t} className="text-xs text-primary opacity-70">{t}</span>)}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Modifica</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-400 hover:text-red-300">Elimina</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────
function ChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "Ciao! Sono il tuo AI Social Media Manager PRO 🚀\n\nPosso aiutarti con:\n• Strategie di contenuto personalizzate\n• Analisi dei trend in tempo reale\n• Generazione di caption e hook virali\n• Ottimizzazione degli orari di pubblicazione\n• Idee per Reel, Stories e Caroselli\n\nCome posso aiutarti oggi?",
      timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    const time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: time }]);
    setInput("");
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    const responses: Record<string, string> = {
      trend: "📈 **Trend della settimana nella tua nicchia (Wall Art / Home Decor):**\n\n1. **Minimal Japandi** — +340% ricerche su TikTok questa settimana\n2. **Gallery Wall** — trend Instagram in crescita del 28%\n3. **Dark Academia** — engagement medio 4.2% sui Reel\n\n**Consiglio**: Lancia un Reel style \"prima/dopo\" su uno stile Japandi — forte potenziale virale!",
      hook: "🎣 **3 Hook Virali per Reel Quadri Astratti:**\n\n1. *\"POV: finalmente trasformi quella parete vuota in arte che ti rappresenta 🖼️\"*\n\n2. *\"Questo quadro ha cambiato completamente l'atmosfera del mio living — non scherzo 😱\"*\n\n3. *\"Nessuno ti dice questa cosa quando scegli arte per casa... 👇 (vai al secondo slide)\"*\n\nVuoi che sviluppi uno di questi in script completo?",
      default: "Ottima domanda! Analizzo il tuo scenario e ti fornisco una strategia personalizzata per DreamBrothers 🎯\n\nBasa la tua prossima settimana su questo mix:\n• **40%** contenuti educativi (come scegliere, come appendere, misure)\n• **35%** prodotto in contesto lifestyle (ambienti reali)\n• **25%** UGC e social proof\n\nVuoi che pianifichi questo in dettaglio per la prossima settimana?",
    };
    const key = msg.toLowerCase().includes("trend") ? "trend" : msg.toLowerCase().includes("hook") ? "hook" : "default";
    setIsTyping(false);
    setMessages((prev) => [...prev, { role: "ai", content: responses[key], timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) }]);
  };

  useEffect(() => {
    try {
      const brief = localStorage.getItem("db_remix_brief");
      if (brief) { localStorage.removeItem("db_remix_brief"); setInput(brief); }
    } catch {}
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ height: "calc(100vh - 240px)", minHeight: "500px" }}>
      {/* Suggestions */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {AI_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => handleSend(s)} className="text-xs px-3 py-1.5 rounded-full border transition-all hover:border-primary hover:text-primary" style={{ border: "1px solid oklch(0.22 0.015 260)", color: "oklch(0.65 0.02 260)" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm" style={{ background: msg.role === "ai" ? "var(--gradient-primary)" : "oklch(0.22 0.025 265)", color: "white", fontWeight: 600 }}>
              {msg.role === "ai" ? "AI" : "A"}
            </div>
            <div className="max-w-[78%]">
              <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: msg.role === "ai" ? "oklch(0.14 0.015 260)" : "oklch(0.65 0.2 265 / 0.15)", border: `1px solid ${msg.role === "ai" ? "oklch(0.22 0.015 260)" : "oklch(0.65 0.2 265 / 0.3)"}` }}>
                {msg.content}
              </div>
              <div className="text-xs text-muted-foreground mt-1 px-1">{msg.timestamp}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--gradient-primary)" }}>AI</div>
            <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}>
              {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3 shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Chiedi una strategia, un hook virale, analisi trend... (Invio per inviare)"
          className="flex-1 resize-none min-h-[48px] max-h-[120px]"
          rows={2}
          style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}
        />
        <Button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className="self-end h-12 w-12 p-0 shrink-0" style={{ background: "var(--gradient-primary)" }}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Create Tab ───────────────────────────────────────────────────────────────
function CreateView() {
  const [platform, setPlatform] = useState<string>("instagram");
  const [postType, setPostType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [asset, setAsset] = useState<{ name: string; thumb: string; view: string; type: string } | null>(null);
  const [assets, setAssets] = useState<{ name: string; thumb: string; view: string; type: string }[]>([]);

  useEffect(() => {
    try {
      const multi = localStorage.getItem("db_social_assets");
      if (multi) {
        const arr = JSON.parse(multi);
        if (Array.isArray(arr) && arr.length) { setAssets(arr); setPostType("carousel"); return; }
      }
      const raw = localStorage.getItem("db_social_asset");
      if (raw) {
        const a = JSON.parse(raw);
        setAsset(a);
        setPostType(a.type === "video" ? "reel" : "post");
      }
    } catch {}
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setCaption(`🖼️ Trasforma il tuo spazio con l'arte che ti appartiene.\n\nOgni quadro DreamBrothers è stampato su materiali premium per durare nel tempo — non solo decorazione, ma un investimento nella tua casa.\n\nQuale stile racconta chi sei? Scopri la nostra collezione in bio 👆\n\n✨ Spedizione gratuita sopra €50`);
    setHashtags("#wallart #homedecor #quadri #arredocasa #interiordesign #livingroom #dreambrothers #printart #minimalhome #italiandesign");
    setIsGenerating(false);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Controls */}
      <div className="space-y-5">
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          <h3 className="font-semibold">Configura il Post</h3>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Piattaforma</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [Platform, typeof PLATFORM_CONFIG.instagram][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={key} onClick={() => setPlatform(key)} className="rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all" style={{ background: platform === key ? `${cfg.color}22` : "oklch(0.16 0.015 260)", border: `1px solid ${platform === key ? cfg.color : "oklch(0.22 0.015 260)"}` }}>
                    <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    <span className="text-xs">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Tipo di contenuto</label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger style={{ background: "oklch(0.16 0.015 260)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reel">🎬 Reel / Video</SelectItem>
                <SelectItem value="post">📸 Post immagine</SelectItem>
                <SelectItem value="story">⭕ Stories</SelectItem>
                <SelectItem value="carousel">🎠 Carosello</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Topic / Brief</label>
            <Textarea placeholder="es. Lancio nuova collezione quadri minimal, target: 25-40 anni appassionati di interior design..." rows={3} className="resize-none" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full text-white" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? "Generando..." : "Genera con AI"}
          </Button>
        </div>

        {/* Media: asset da My Assets oppure upload */}
        {assets.length > 0 ? (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Carosello · {assets.length} immagini</p>
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("db_social_assets"); setAssets([]); }}>Rimuovi</Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {assets.map((a, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={a.thumb} alt={a.name} className="w-20 h-20 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                  <span className="absolute top-1 left-1 text-[10px] px-1.5 rounded bg-black/60 text-white">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        ) : asset ? (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
            <img src={asset.thumb} alt={asset.name} className="w-16 h-16 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{asset.name}</p>
              <p className="text-xs text-muted-foreground">Da My Assets · {asset.type === "video" ? "Video" : "Immagine"}</p>
              <a href={asset.view} target="_blank" rel="noreferrer" className="text-xs text-primary">Apri originale</a>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("db_social_asset"); setAsset(null); }}>Rimuovi</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "oklch(0.22 0.015 260)" }}>
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">Carica immagine o video</p>
            <Button variant="outline" size="sm">Scegli file</Button>
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="space-y-4">
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Anteprima</h3>
            <PlatformIcon platform={(platform as Platform) || "instagram"} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Caption</label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="La tua caption apparirà qui dopo la generazione AI..." rows={8} className="resize-none" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />Hashtag</label>
            <Textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#hashtag generati con AI..." rows={3} className="resize-none text-primary text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full">Salva come bozza</Button>
          <Button className="w-full text-white" style={{ background: "var(--gradient-primary)" }}>
            <Clock className="w-4 h-4 mr-2" />Pianifica
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const tabFromPath = (loc: string): Tab =>
  loc.includes("chat") ? "chat" : loc.includes("create") ? "create" : "calendar";

export default function SocialMedia() {
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(() => tabFromPath(location));

  // Keep the active tab in sync with the URL so sidebar navigation
  // (Calendario / AI Manager / Crea Post) actually switches the view.
  useEffect(() => {
    setTab(tabFromPath(location));
  }, [location]);

  const tabs = [
    { id: "calendar" as Tab, icon: Calendar, label: "Calendario", desc: "Contenuti settimanali" },
    { id: "chat" as Tab, icon: MessageSquare, label: "AI Manager", desc: "Chat & strategia" },
    { id: "create" as Tab, icon: PenSquare, label: "Crea Post", desc: "Generator AI" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="absolute inset-0" style={{ background: "var(--gradient-primary)", opacity: 0.04 }} />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Social Media Manager AI</h1>
            <p className="text-sm text-muted-foreground">Pianifica, crea e ottimizza i tuoi contenuti organici con l'AI</p>
          </div>
          <div className="ml-auto flex gap-2">
            {([{ platform: "instagram", count: "2.1K" }, { platform: "tiktok", count: "8.4K" }, { platform: "facebook", count: "1.2K" }] as const).map(({ platform, count }) => {
              const cfg = PLATFORM_CONFIG[platform];
              const Icon = cfg.icon;
              return (
                <div key={platform} className="rounded-xl px-3 py-2 flex items-center gap-2 text-xs" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  <span className="font-semibold" style={{ color: cfg.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        {tabs.map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            onClick={() => { setTab(id); navigate(`/social/${id}`); }}
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
            style={{ background: tab === id ? "oklch(0.65 0.2 265 / 0.15)" : "transparent", border: tab === id ? "1px solid oklch(0.65 0.2 265 / 0.3)" : "1px solid transparent" }}
          >
            <Icon className="w-4 h-4 shrink-0" style={{ color: tab === id ? "oklch(0.7 0.15 265)" : "oklch(0.5 0.02 260)" }} />
            <div>
              <div className="text-sm font-medium" style={{ color: tab === id ? "oklch(0.97 0.005 260)" : "oklch(0.65 0.02 260)" }}>{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "calendar" && <CalendarView />}
      {tab === "chat" && <ChatView />}
      {tab === "create" && <CreateView />}
    </div>
  );
}
