import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, FileText, Loader2, Sparkles, Zap } from "lucide-react";
import { Streamdown } from "streamdown";

export default function AuditAI() {
  const { data: accounts } = trpc.meta.listAccounts.useQuery();
  const [selectedAccount, setSelectedAccount] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = trpc.audit.run.useMutation({
    onSuccess: (data) => { setReport(data.report); setIsRunning(false); toast.success("Audit completato!"); },
    onError: (e) => { setIsRunning(false); toast.error(e.message); },
  });

  const handleRun = () => {
    if (!selectedAccount) { toast.error("Seleziona un account META"); return; }
    setIsRunning(true);
    setReport(null);
    runAudit.mutate({ metaAccountId: parseInt(selectedAccount) });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="card-premium rounded-2xl p-6" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Audit AI dell'Account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              L'agente AI analizza l'intero storico del tuo account META — campagne, performance, KPI, spesa — e genera un report dettagliato con analisi dei punti di forza, criticità e raccomandazioni concrete per ottimizzare le tue campagne.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card-premium rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Avvia Analisi</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1.5 block">Account META da analizzare</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                <SelectValue placeholder="Seleziona account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.accountName ?? a.accountId}</SelectItem>)}
                {!accounts?.length && <SelectItem value="none" disabled>Nessun account connesso — vai a "Connetti Account"</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning || !selectedAccount}
            className="gap-2 font-semibold px-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Analisi in corso...</>
            ) : (
              <><Zap className="w-4 h-4" />Avvia Audit AI</>
            )}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isRunning && (
        <div className="card-premium rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 agent-running-indicator" style={{ background: "var(--gradient-primary)" }}>
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Agente AI in analisi...</h3>
          <p className="text-sm text-muted-foreground">Sto analizzando lo storico dell'account, le performance delle campagne e i KPI. Questo richiede circa 30-60 secondi.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {["Lettura dati storici", "Analisi KPI", "Identificazione pattern", "Generazione report"].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: "oklch(0.65 0.2 265)", animationDelay: `${i * 0.2}s` }} />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report && !isRunning && (
        <div className="card-premium rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: "1px solid oklch(0.22 0.015 260)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.18 145 / 0.15)" }}>
              <FileText className="w-5 h-5" style={{ color: "oklch(0.65 0.18 145)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Report Audit AI</h3>
              <p className="text-xs text-muted-foreground">Generato il {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => { navigator.clipboard.writeText(report); toast.success("Report copiato!"); }}>
              Copia Report
            </Button>
          </div>
          <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "oklch(0.88 0.01 260)" }}>
            <Streamdown>{report}</Streamdown>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !isRunning && (
        <div className="card-premium rounded-2xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-2">Nessun audit eseguito</h3>
          <p className="text-sm text-muted-foreground">Seleziona un account e avvia l'analisi AI per ottenere il tuo report personalizzato</p>
        </div>
      )}
    </div>
  );
}
