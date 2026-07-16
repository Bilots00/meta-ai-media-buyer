import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { Loader2, Send, Star, Rocket, Check, X, Satellite } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Lancia una nuova campagna per il best seller",
  "Come stanno andando le campagne attive? Ragiona in MER, non solo ROAS",
  "Prepara un brief creativo data-driven per il Creative Director",
  "Fai un audit della struttura dell'account",
];

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Sales", OUTCOME_LEADS: "Leads", OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement", OUTCOME_APP_PROMOTION: "App",
};

type ChatAction = {
  type: "launch_campaign" | "pause_campaign" | "resume_campaign";
  metaAccountId: number; campaignId: number; name: string;
  objective: string; dailyBudget: number; notes: string;
  state: "pending" | "executed" | "cancelled";
};

function ActionCard({ action, messageId, onConfirm, busy }: {
  action: ChatAction; messageId: number;
  onConfirm: (messageId: number, approve: boolean) => void; busy: boolean;
}) {
  const title = action.type === "launch_campaign"
    ? `Lancio campagna: "${action.name}"`
    : action.type === "pause_campaign" ? `Pausa campagna #${action.campaignId}` : `Riattivazione campagna #${action.campaignId}`;
  return (
    <div className="mt-3 rounded-xl p-4" style={{ background: "oklch(0.65 0.2 265 / 0.07)", border: "1px solid oklch(0.65 0.2 265 / 0.25)" }}>
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4" style={{ color: "oklch(0.65 0.2 265)" }} />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {action.type === "launch_campaign" && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Obiettivo: <span className="text-foreground">{OBJECTIVE_LABELS[action.objective] ?? action.objective}</span></span>
          <span>Budget: <span className="text-foreground">€{action.dailyBudget}/day</span></span>
          {action.notes && <span className="col-span-2">Note: <span className="text-foreground">{action.notes}</span></span>}
          <span className="col-span-2" style={{ color: "oklch(0.72 0.18 75)" }}>Verrà creata su Meta in PAUSED (draft-first): nessuna spesa finché non la attivi tu.</span>
        </div>
      )}
      <div className="mt-3">
        {action.state === "pending" ? (
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5 font-semibold" style={{ background: "var(--gradient-primary)" }}
              disabled={busy} onClick={() => onConfirm(messageId, true)}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approva
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onConfirm(messageId, false)}>
              <X className="h-3.5 w-3.5" /> Annulla
            </Button>
          </div>
        ) : (
          <span className="text-xs font-semibold" style={{ color: action.state === "executed" ? "oklch(0.65 0.18 145)" : "oklch(0.55 0.02 260)" }}>
            {action.state === "executed" ? "✓ Approvata ed eseguita" : "✕ Annullata"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MetaAiManager() {
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const utils = trpc.useUtils();
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = trpc.metaAgents.chatList.useQuery(undefined, { refetchInterval: 8000 });
  const sendMut = trpc.metaAgents.chatSend.useMutation({
    onSuccess: () => utils.metaAgents.chatList.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const confirmMut = trpc.metaAgents.chatConfirm.useMutation({
    onSuccess: (r) => {
      utils.metaAgents.chatList.invalidate();
      utils.metaAgents.overview.invalidate();
      if (r.executed) toast.success("Azione eseguita — la trovi in Mission Control");
    },
    onError: (e) => toast.error(e.message),
  });

  const messages = chat.data ?? [];
  const waiting = sendMut.isPending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, waiting]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || waiting) return;
    setInput("");
    sendMut.mutate({ text: t });
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 130px)" }}>
      {/* Header Polaris */}
      <div className="flex items-center gap-3 pb-4 border-b shrink-0" style={{ borderColor: "oklch(0.2 0.015 260)" }}>
        <div className="flex items-center justify-center rounded-full h-10 w-10" style={{ background: "linear-gradient(135deg, oklch(0.75 0.15 85), oklch(0.65 0.2 65))" }}>
          <Star className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Polaris — AI Media Buyer Orchestrator</h2>
          <p className="text-xs text-muted-foreground">Parla con lui per lanciare e gestire le campagne Meta. Ogni azione richiede la tua approvazione (draft-first).</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/mission-control")}>
          <Satellite className="h-3.5 w-3.5" /> Mission Control
        </Button>
      </div>

      {/* Messaggi */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-5 space-y-4 max-w-3xl w-full mx-auto">
        {messages.length === 0 && !waiting && (
          <div className="text-center pt-16">
            <div className="mx-auto mb-4 flex items-center justify-center rounded-2xl h-12 w-12" style={{ background: "var(--gradient-primary)" }}>
              <Star className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-muted-foreground mb-6">Sono Polaris, il tuo Senior Media Buyer. Dimmi cosa vuoi lanciare o chiedimi come stanno andando le campagne.</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs rounded-full px-3 py-1.5 transition-colors hover:bg-accent"
                  style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "text-white" : ""}`}
              style={m.role === "user"
                ? { background: "var(--gradient-primary)" }
                : { background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.02 260)" }}>
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{m.text}</Streamdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.text}</p>
              )}
              {m.role === "assistant" && m.action && (
                <ActionCard action={m.action as ChatAction} messageId={m.id}
                  onConfirm={(id, approve) => confirmMut.mutate({ messageId: id, approve })}
                  busy={confirmMut.isPending} />
              )}
            </div>
          </div>
        ))}
        {waiting && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground"
              style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.02 260)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Polaris sta analizzando…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 max-w-3xl w-full mx-auto pb-2">
        <div className="flex items-end gap-2 rounded-2xl p-2" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder='Es. "Lancia una campagna sales per il poster Dream Big, €20/day, broad USA"'
            className="flex-1 bg-transparent resize-none outline-none text-sm px-2 py-1.5 placeholder:text-muted-foreground"
          />
          <Button size="sm" className="h-9 w-9 p-0 shrink-0" style={{ background: "var(--gradient-primary)" }}
            disabled={waiting || !input.trim()} onClick={() => send(input)}>
            {waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">Le campagne nascono in PAUSED su Meta. Budget e lanci richiedono sempre la tua approvazione.</p>
      </div>
    </div>
  );
}
