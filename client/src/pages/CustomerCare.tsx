import { useState, type ElementType } from "react";
import { useLocation } from "wouter";
import {
  Search, Star, Send, ExternalLink, Archive, EyeOff, AlertTriangle, Bot,
  Instagram, Facebook, Mail, MessageCircle, MessageSquare, Inbox, CheckCheck, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────
type Channel = "ig_dm" | "ig_comment" | "facebook" | "email" | "whatsapp";
type Status = "ai_handled" | "needs_human" | "open" | "archived";

interface Msg { from: "customer" | "you" | "ai"; text: string; time: string }
interface Conversation {
  id: string; name: string; handle: string; channel: Channel; status: Status;
  preview: string; date: string; unread: boolean; starred: boolean;
  flagReason?: string; aiSuggestion: string; channelUrl: string; thread: Msg[];
}

const CHANNELS: Record<Channel, { label: string; icon: ElementType; color: string }> = {
  ig_dm:      { label: "Instagram DM", icon: Instagram,     color: "oklch(0.65 0.2 340)" },
  ig_comment: { label: "Commento IG",  icon: MessageSquare, color: "oklch(0.65 0.2 310)" },
  facebook:   { label: "Facebook",     icon: Facebook,      color: "oklch(0.5 0.18 265)" },
  email:      { label: "Email",        icon: Mail,          color: "oklch(0.72 0.18 60)" },
  whatsapp:   { label: "WhatsApp",     icon: MessageCircle, color: "oklch(0.6 0.18 145)" },
};

// ─── Mock data (la fase 2 collegherà i canali reali via MCP / n8n) ────────────
const CONVERSATIONS: Conversation[] = [
  {
    id: "c1", name: "marco_dreams", handle: "@marco_dreams", channel: "ig_dm", status: "needs_human",
    flagReason: "Possibile abuso della garanzia — serve la tua decisione",
    preview: "Voglio il rimborso totale ma ho già appeso il poster da 3 settimane…",
    date: "10:24", unread: true, starred: false,
    channelUrl: "https://instagram.com/direct/t/marco_dreams",
    aiSuggestion: "Hi Marco, thanks for reaching out 🤍 I totally get it. So I can find the best solution for you, could you send me a quick photo of the print? That way I can check everything and make it right.",
    thread: [
      { from: "customer", text: "Voglio il rimborso totale ma ho già appeso il poster da 3 settimane e mi sono stancato.", time: "10:24" },
    ],
  },
  {
    id: "c2", name: "giulia.creates", handle: "@giulia.creates", channel: "ig_comment", status: "ai_handled",
    preview: "Do you ship to Germany? 😍 obsessed with this one",
    date: "09:58", unread: false, starred: true,
    channelUrl: "https://instagram.com/p/abc/",
    aiSuggestion: "Yes we do, Giulia! 🇩🇪🤍 Worldwide shipping. Tap the link in bio to make it yours.",
    thread: [
      { from: "customer", text: "Do you ship to Germany? 😍 obsessed with this one", time: "09:58" },
      { from: "ai", text: "Yes we do, Giulia! 🇩🇪🤍 Worldwide shipping. Tap the link in bio to make it yours.", time: "09:58" },
    ],
  },
  {
    id: "c3", name: "+39 333 1234567", handle: "WhatsApp", channel: "whatsapp", status: "open",
    preview: "Ciao! Il 50x70 sta bene sopra un divano da 2 metri?",
    date: "Ieri", unread: true, starred: false,
    channelUrl: "https://wa.me/393331234567",
    aiSuggestion: "Ciao! Sì, il 50×70 è perfetto da solo sopra un divano da 2m, oppure in coppia per un effetto gallery wall ancora più scenografico ✨ Vuoi che ti mandi un mockup?",
    thread: [{ from: "customer", text: "Ciao! Il 50x70 sta bene sopra un divano da 2 metri?", time: "Ieri 18:40" }],
  },
  {
    id: "c4", name: "Laura B.", handle: "laura.b@email.com", channel: "email", status: "open",
    preview: "Custom order — vorrei una frase personalizzata per un regalo…",
    date: "Ieri", unread: false, starred: false,
    channelUrl: "https://mail.google.com/",
    aiSuggestion: "Hi Laura 🤍 We'd love to create something custom for you. Could you share the exact quote, the vibe (minimal, bold, poetic…) and the size you're thinking of?",
    thread: [{ from: "customer", text: "Vorrei una frase personalizzata per un regalo, è possibile?", time: "Ieri 14:02" }],
  },
  {
    id: "c5", name: "hater_92", handle: "@hater_92", channel: "ig_comment", status: "needs_human",
    flagReason: "Commento negativo — modera (nascondi/elimina) o rispondi tu",
    preview: "overpriced trash, my kid draws better 🤡",
    date: "Ieri", unread: true, starred: false,
    channelUrl: "https://instagram.com/p/xyz/",
    aiSuggestion: "(Moderazione consigliata: nascondi il commento. Rispondere alimenterebbe il troll.)",
    thread: [{ from: "customer", text: "overpriced trash, my kid draws better 🤡", time: "Ieri 21:10" }],
  },
  {
    id: "c6", name: "Tom R.", handle: "Facebook", channel: "facebook", status: "ai_handled",
    preview: "Where's my order? #DB-10293",
    date: "2 giorni fa", unread: false, starred: false,
    channelUrl: "https://facebook.com/messages/t/tomr",
    aiSuggestion: "Hi Tom! Your order #DB-10293 shipped yesterday — it's on the way 🚚 Tracking in your email. Thanks for the patience! 🤍",
    thread: [{ from: "customer", text: "Where's my order? #DB-10293", time: "2 giorni fa" }],
  },
];

const fmtCount = (n: number) => (n > 99 ? "99+" : String(n));

export default function CustomerCare() {
  const [location] = useLocation();
  const [folder, setFolder] = useState<string>(location.includes("urgent") ? "needs_human" : "all");
  const [selectedId, setSelectedId] = useState<string>("c1");
  const [reply, setReply] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const counts = {
    all: CONVERSATIONS.filter((c) => c.status !== "archived").length,
    unread: CONVERSATIONS.filter((c) => c.unread).length,
    needs_human: CONVERSATIONS.filter((c) => c.status === "needs_human").length,
    starred: CONVERSATIONS.filter((c) => c.starred).length,
  };

  const FOLDERS: { id: string; label: string; icon: ElementType; count?: number; danger?: boolean }[] = [
    { id: "all", label: "Inbox", icon: Inbox, count: counts.all },
    { id: "needs_human", label: "Da rivedere", icon: AlertTriangle, count: counts.needs_human, danger: true },
    { id: "unread", label: "Non letti", icon: Bell, count: counts.unread },
    { id: "starred", label: "Speciali", icon: Star, count: counts.starred },
    { id: "ig_dm", label: "Instagram DM", icon: Instagram },
    { id: "ig_comment", label: "Commenti IG", icon: MessageSquare },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "email", label: "Email", icon: Mail },
    { id: "facebook", label: "Facebook", icon: Facebook },
    { id: "archived", label: "Archiviati", icon: Archive },
  ];

  const list = CONVERSATIONS.filter((c) => {
    if (folder === "all") return c.status !== "archived";
    if (folder === "unread") return c.unread;
    if (folder === "needs_human") return c.status === "needs_human";
    if (folder === "starred") return c.starred;
    if (folder === "archived") return c.status === "archived";
    return c.channel === folder;
  }).filter((c) => !query || (c.name + c.preview).toLowerCase().includes(query.toLowerCase()));

  const selected = CONVERSATIONS.find((c) => c.id === selectedId) ?? list[0] ?? CONVERSATIONS[0];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      {/* Header */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden shrink-0" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Customer Care</h1>
            <p className="text-xs text-muted-foreground">Tutte le conversazioni clienti (DM, commenti, email, WhatsApp) in un unico posto</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: "oklch(0.6 0.18 145 / 0.12)", border: "1px solid oklch(0.6 0.18 145 / 0.3)", color: "oklch(0.7 0.16 145)" }}>
            <Bot className="w-3.5 h-3.5" /> AI risponde in automatico · escala a te se non è sicura
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Folders */}
        <div className="w-52 shrink-0 rounded-2xl p-2 overflow-y-auto hidden md:block" style={{ background: "oklch(0.13 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          {FOLDERS.map((f) => {
            const Icon = f.icon; const active = folder === f.id;
            return (
              <button key={f.id} onClick={() => setFolder(f.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all mb-0.5"
                style={{ background: active ? "oklch(0.65 0.2 265 / 0.15)" : "transparent", color: active ? "oklch(0.97 0.005 260)" : "oklch(0.6 0.02 260)" }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: f.danger ? "oklch(0.65 0.2 25)" : undefined }} />
                <span className="flex-1 truncate">{f.label}</span>
                {f.count ? (
                  <span className="text-xs px-1.5 rounded-full font-medium" style={{ background: f.danger ? "oklch(0.65 0.2 25)" : "oklch(0.3 0.02 260)", color: "white" }}>{fmtCount(f.count)}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="w-full max-w-sm shrink-0 rounded-2xl flex flex-col overflow-hidden" style={{ background: "oklch(0.13 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          <div className="p-3 shrink-0" style={{ borderBottom: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "oklch(0.16 0.015 260)" }}>
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca conversazioni…" className="bg-transparent outline-none text-sm flex-1 text-foreground" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nessun messaggio qui ✨</div>}
            {list.map((c) => {
              const ch = CHANNELS[c.channel]; const ChIcon = ch.icon; const active = c.id === selected.id;
              return (
                <button key={c.id} onClick={() => { setSelectedId(c.id); setReply(""); }}
                  className="w-full text-left p-3 flex gap-3 transition-colors"
                  style={{ background: active ? "oklch(0.16 0.02 265)" : "transparent", borderBottom: "1px solid oklch(0.17 0.015 260)", borderLeft: active ? "2px solid oklch(0.65 0.2 265)" : "2px solid transparent" }}>
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: "oklch(0.22 0.02 265)", color: "white" }}>{c.name.charAt(0).toUpperCase()}</div>
                    <div className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center" style={{ width: 17, height: 17, background: "oklch(0.12 0.015 260)" }}>
                      <ChIcon className="w-3 h-3" style={{ color: ch.color }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm truncate ${c.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{c.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{c.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.preview}</p>
                    <div className="flex gap-1 mt-1">
                      {c.status === "needs_human" && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "oklch(0.65 0.2 25 / 0.2)", color: "oklch(0.72 0.18 25)" }}>URGENTE</span>}
                      {c.status === "ai_handled" && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: "oklch(0.6 0.18 145 / 0.15)", color: "oklch(0.7 0.16 145)" }}><Bot className="w-2.5 h-2.5" />Risposto AI</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail / reply */}
        <div className="flex-1 rounded-2xl flex flex-col overflow-hidden min-w-0" style={{ background: "oklch(0.13 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
          {/* conv header */}
          <div className="p-4 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style={{ background: "oklch(0.22 0.02 265)" }}>{selected.name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{selected.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">{(() => { const I = CHANNELS[selected.channel].icon; return <I className="w-3 h-3" style={{ color: CHANNELS[selected.channel].color }} />; })()}{CHANNELS[selected.channel].label} · {selected.handle}</div>
            </div>
            <a href={selected.channelUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors" style={{ background: "oklch(0.16 0.015 260)", color: "oklch(0.7 0.15 265)" }}>
              Rispondi nel canale <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* escalation banner */}
          {selected.status === "needs_human" && (
            <div className="mx-4 mt-3 p-3 rounded-xl flex items-start gap-2 shrink-0" style={{ background: "oklch(0.65 0.2 25 / 0.12)", border: "1px solid oklch(0.65 0.2 25 / 0.3)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "oklch(0.72 0.18 25)" }} />
              <div className="text-xs" style={{ color: "oklch(0.8 0.1 25)" }}>
                <b>Richiede risposta umana.</b> {selected.flagReason}
                <div className="mt-1 opacity-80">L'AI ha messo in pausa la risposta automatica e (in fase 2) ti ha notificato su Telegram + WhatsApp via n8n.</div>
              </div>
            </div>
          )}

          {/* thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selected.thread.map((m, i) => (
              <div key={i} className={`flex ${m.from === "customer" ? "" : "flex-row-reverse"}`}>
                <div className="max-w-[75%]">
                  <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap" style={{ background: m.from === "customer" ? "oklch(0.16 0.015 260)" : "oklch(0.65 0.2 265 / 0.18)", border: "1px solid oklch(0.22 0.015 260)" }}>{m.text}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 px-1">{m.from === "ai" ? "AI · " : ""}{m.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* AI suggestion + reply */}
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "oklch(0.7 0.16 145)" }}>
              <Bot className="w-3.5 h-3.5" /> Risposta suggerita dall'AI {selected.status === "needs_human" && "(rivedila prima di inviare)"}
              <button onClick={() => setReply(selected.aiSuggestion)} className="ml-auto text-xs px-2 py-1 rounded-lg" style={{ background: "oklch(0.16 0.015 260)", color: "oklch(0.7 0.15 265)" }}>Usa suggerimento</button>
            </div>
            <Textarea value={reply || selected.aiSuggestion} onChange={(e) => setReply(e.target.value)} rows={3} className="resize-none text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
            <div className="flex flex-wrap gap-2 mt-2">
              <Button className="text-white h-9" style={{ background: "var(--gradient-primary)" }}><Send className="w-4 h-4 mr-2" />Invia risposta</Button>
              <Button variant="outline" size="sm" className="h-9"><Bell className="w-4 h-4 mr-1.5" />Inoltra a Telegram + WhatsApp</Button>
              {selected.channel === "ig_comment" && <Button variant="outline" size="sm" className="h-9 text-red-400"><EyeOff className="w-4 h-4 mr-1.5" />Nascondi / Modera</Button>}
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"><CheckCheck className="w-4 h-4 mr-1.5" />Segna risolto</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
