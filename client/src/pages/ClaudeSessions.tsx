import { useState, useEffect, useRef, type ElementType } from "react";
import {
  Search, Send, Plus, Brain, ArrowLeft, Archive, Trash2, Pencil,
  Globe, Terminal, MessageCircle, ArchiveRestore, Check, X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Badge origine: da dove è nata (o continua) la sessione. L'alpha va DENTRO
// oklch(), quindi ogni voce porta già la sua variante di sfondo e bordo.
const SOURCES: Record<string, { label: string; icon: ElementType; color: string; bg: string; border: string }> = {
  web:      { label: "Web",      icon: Globe,         color: "oklch(0.75 0.15 265)", bg: "oklch(0.65 0.2 265 / 0.12)",  border: "oklch(0.65 0.2 265 / 0.3)" },
  telegram: { label: "Telegram", icon: MessageCircle, color: "oklch(0.78 0.12 230)", bg: "oklch(0.7 0.15 230 / 0.12)",  border: "oklch(0.7 0.15 230 / 0.3)" },
  code:     { label: "Code",     icon: Terminal,      color: "oklch(0.8 0.14 75)",   bg: "oklch(0.72 0.18 75 / 0.12)",  border: "oklch(0.72 0.18 75 / 0.3)" },
};
const SOURCE_FALLBACK = { label: "—", icon: Globe, color: "oklch(0.7 0.02 260)", bg: "oklch(0.5 0.02 260 / 0.12)", border: "oklch(0.5 0.02 260 / 0.3)" };
function sourceMeta(s: string) {
  return SOURCES[s] ?? { ...SOURCE_FALLBACK, label: s };
}

const BORDER = "1px solid oklch(0.2 0.015 260)";
const PANEL_BG = "oklch(0.12 0.015 260)";

export default function ClaudeSessions() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Sotto 1024px si vede un pannello alla volta: lista → chat, con back button.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: sessions = [], isLoading: loadingSessions } = trpc.claude.sessions.useQuery(
    { q: search || undefined, includeArchived },
    { refetchInterval: 8000 },
  );
  const { data: messages = [] } = trpc.claude.messages.useQuery(
    { sessionId: selectedId! },
    { enabled: selectedId != null, refetchInterval: 3500 },
  );
  const { data: agent } = trpc.claude.agentStatus.useQuery(undefined, { refetchInterval: 30000 });

  const selected = sessions.find((s) => s.id === selectedId);

  const send = trpc.claude.send.useMutation({
    onSuccess: (r) => {
      setDraft("");
      setSelectedId(r.sessionId);
      utils.claude.messages.invalidate();
      utils.claude.sessions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const rename = trpc.claude.rename.useMutation({
    onSuccess: () => { setRenamingId(null); utils.claude.sessions.invalidate(); toast.success("Sessione rinominata"); },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = trpc.claude.setStatus.useMutation({
    onSuccess: () => { utils.claude.sessions.invalidate(); toast.success("Sessione aggiornata"); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.claude.remove.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      setMobileView("list");
      utils.claude.sessions.invalidate();
      toast.success("Sessione eliminata");
    },
    onError: (e) => toast.error(e.message),
  });

  // La chat resta incollata in fondo mentre arrivano i turni dell'agente.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, selectedId]);

  function openSession(id: number) {
    setSelectedId(id);
    setMobileView("chat");
  }

  function newSession() {
    setSelectedId(null);
    setDraft("");
    setMobileView("chat");
  }

  function submit() {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate({ sessionId: selectedId ?? undefined, text });
  }

  const online = agent?.online ?? false;

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Lista sessioni ─────────────────────────────────────────── */}
      <aside
        className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-80 shrink-0 rounded-2xl overflow-hidden`}
        style={{ background: PANEL_BG, border: BORDER }}
      >
        <div className="p-3 space-y-3 shrink-0" style={{ borderBottom: BORDER }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">Sessioni</span>
              {/* Pallino stato agente: verde = ha battuto un colpo negli ultimi 2 min */}
              <span
                className="flex items-center gap-1.5 text-[11px] shrink-0"
                title={online ? "Agente Claude online" : "Agente Claude offline"}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: online ? "oklch(0.7 0.18 145)" : "oklch(0.5 0.02 260)",
                    boxShadow: online ? "0 0 6px oklch(0.7 0.18 145)" : "none",
                  }}
                />
                <span className="text-muted-foreground">{online ? "online" : "offline"}</span>
              </span>
            </div>
            <Button size="sm" onClick={newSession} style={{ background: "var(--gradient-primary)" }} className="h-8">
              <Plus className="w-4 h-4" />
              <span className="ml-1 text-xs">Nuova</span>
            </Button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca nei titoli e nei messaggi…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <button
            onClick={() => setIncludeArchived((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {includeArchived ? "✓ Mostra archiviate" : "Mostra archiviate"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingSessions && <div className="text-xs text-muted-foreground p-3">Carico…</div>}
          {!loadingSessions && sessions.length === 0 && (
            <div className="text-xs text-muted-foreground p-3 leading-relaxed">
              {search ? "Nessuna sessione trovata." : "Nessuna sessione. Premi Nuova per iniziare."}
            </div>
          )}
          {sessions.map((s) => {
            const meta = sourceMeta(s.source);
            const Icon = meta.icon;
            const isActive = s.id === selectedId;
            return (
              <div
                key={s.id}
                onClick={() => renamingId !== s.id && openSession(s.id)}
                className={`group p-2.5 rounded-xl cursor-pointer transition-all ${isActive ? "sidebar-item-active" : "hover:bg-accent"}`}
                style={isActive ? { background: "oklch(0.65 0.2 265 / 0.12)", border: "1px solid oklch(0.65 0.2 265 / 0.3)" } : { border: "1px solid transparent" }}
              >
                {renamingId === s.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameValue.trim()) rename.mutate({ id: s.id, title: renameValue.trim() });
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-7 text-xs"
                    />
                    <button
                      onClick={() => renameValue.trim() && rename.mutate({ id: s.id, title: renameValue.trim() })}
                      className="p-1 rounded text-muted-foreground hover:text-foreground"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setRenamingId(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">{s.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{s.when}</span>
                    </div>
                    {s.preview && <div className="text-xs text-muted-foreground truncate mt-0.5">{s.preview}</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{s.messageCount} msg</span>
                      {s.status === "archived" && <span className="text-[10px] text-muted-foreground">· archiviata</span>}
                      <span className="flex-1" />
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setRenamingId(s.id); setRenameValue(s.title); }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          title="Rinomina"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setStatus.mutate({ id: s.id, status: s.status === "archived" ? "active" : "archived" })}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          title={s.status === "archived" ? "Ripristina" : "Archivia"}
                        >
                          {s.status === "archived" ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => { if (confirm(`Eliminare "${s.title}"? I messaggi vanno persi.`)) remove.mutate({ id: s.id }); }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive"
                          title="Elimina"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Chat ───────────────────────────────────────────────────── */}
      <section
        className={`${mobileView === "chat" ? "flex" : "hidden"} lg:flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden`}
        style={{ background: PANEL_BG, border: BORDER }}
      >
        <div className="flex items-center gap-3 p-3 shrink-0" style={{ borderBottom: BORDER }}>
          <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{selected?.title ?? "Nuova sessione"}</div>
            <div className="text-[11px] text-muted-foreground">
              {selected ? `${selected.messageCount} messaggi` : "Scrivi per iniziare una sessione"}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedId == null && (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--gradient-primary)" }}>
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Le tue sessioni Claude, ovunque. Scrivi qui e riprendi da Claude Code, o continua da mobile quello che hai iniziato al PC.
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => {
            const isUser = m.role === "user";
            if (m.role === "system") {
              return (
                <div key={m.id} className="text-[11px] text-muted-foreground text-center italic px-4">{m.text}</div>
              );
            }
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
                  style={isUser
                    ? { background: "var(--gradient-primary)", color: "white" }
                    : { background: "oklch(0.16 0.015 260)", border: BORDER }}
                >
                  {isUser ? (
                    <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                  ) : (
                    <div className="text-sm claude-md break-words">
                      <Streamdown>{m.text}</Streamdown>
                    </div>
                  )}
                  <div className={`text-[10px] mt-1 ${isUser ? "text-white/60" : "text-muted-foreground"}`}>
                    {m.when}
                    {m.pending && " · in attesa dell'agente"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 shrink-0" style={{ borderTop: BORDER }}>
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              placeholder="Scrivi a Claude… (Enter invia, Shift+Enter a capo)"
              className="min-h-[44px] max-h-40 resize-none text-sm"
              rows={1}
            />
            <Button
              onClick={submit}
              disabled={!draft.trim() || send.isPending}
              className="h-11 shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
