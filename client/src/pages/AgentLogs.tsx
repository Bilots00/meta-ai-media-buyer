import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, AlertTriangle, ArrowUpDown, Bot, CheckCircle, Info, TrendingDown, TrendingUp, Zap } from "lucide-react";

const actionTypeLabels: Record<string, string> = {
  audit: "Audit Account",
  optimization: "Ottimizzazione",
  budget_increase: "Aumento Budget",
  budget_decrease: "Riduzione Budget",
  ad_pause: "Pausa Inserzione",
  ad_activate: "Attivazione Inserzione",
  campaign_create: "Creazione Campagna",
  goal_started: "Avvio Obiettivo",
  goal_completed: "Obiettivo Completato",
  goal_failed: "Obiettivo Fallito",
  copy_generation: "Generazione Copy",
  ab_test_create: "Creazione A/B Test",
  ab_test_evaluate: "Valutazione A/B Test",
  alert_triggered: "Alert Attivato",
  tracking_setup: "Setup Tracking",
};

const impactColors: Record<string, string> = {
  positive: "oklch(0.65 0.18 145)",
  negative: "oklch(0.55 0.22 25)",
  critical: "oklch(0.55 0.22 25)",
  neutral: "oklch(0.6 0.02 260)",
};

const impactIcons: Record<string, React.ElementType> = {
  positive: TrendingUp,
  negative: TrendingDown,
  critical: AlertTriangle,
  neutral: ArrowUpDown,
};

const severityIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

export default function AgentLogs() {
  const [filter, setFilter] = useState("all");
  const { data: logs, isLoading } = trpc.agentLogs.list.useQuery({ limit: 200 });

  const filteredLogs = logs?.filter(log => {
    if (filter === "all") return true;
    if (filter === "optimization") return ["optimization", "budget_increase", "budget_decrease", "ad_pause", "ad_activate"].includes(log.actionType);
    if (filter === "alerts") return log.actionType === "alert_triggered";
    if (filter === "goals") return ["goal_started", "goal_completed", "goal_failed"].includes(log.actionType);
    if (filter === "copy") return log.actionType === "copy_generation";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Log Attività Agente AI</h2>
          <p className="text-sm text-muted-foreground">Storico completo di tutte le azioni autonome eseguite dall'AI con motivazione e impatto</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 h-9 text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le azioni</SelectItem>
            <SelectItem value="optimization">Ottimizzazioni</SelectItem>
            <SelectItem value="goals">Obiettivi</SelectItem>
            <SelectItem value="alerts">Alert</SelectItem>
            <SelectItem value="copy">Copy AI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {logs && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Azioni Totali", value: logs.length, color: "oklch(0.65 0.2 265)" },
            { label: "Ottimizzazioni", value: logs.filter(l => ["optimization", "budget_increase", "budget_decrease"].includes(l.actionType)).length, color: "oklch(0.65 0.18 145)" },
            { label: "Alert Generati", value: logs.filter(l => l.actionType === "alert_triggered").length, color: "oklch(0.55 0.22 25)" },
            { label: "Obiettivi Gestiti", value: logs.filter(l => l.actionType.startsWith("goal_")).length, color: "oklch(0.72 0.18 75)" },
          ].map((s) => (
            <div key={s.label} className="card-premium rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Timeline */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 rounded-xl skeleton-shimmer" />)}</div>
      ) : filteredLogs?.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-2">Nessuna attività registrata</h3>
          <p className="text-sm text-muted-foreground">Le azioni dell'agente AI appariranno qui in tempo reale</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs?.map((log) => {
            const ImpactIcon = impactIcons[log.impact ?? "neutral"] ?? ArrowUpDown;
            const _SeverityIcon = severityIcons[log.severity ?? "info"] ?? Info;
            const impactColor = impactColors[log.impact ?? "neutral"];
            const logDetails: Record<string, unknown> | null = (log.actionDetails && typeof log.actionDetails === "object") ? (log.actionDetails as Record<string, unknown>) : null;
            return (
              <div key={log.id} className="card-premium rounded-xl p-4 hover:bg-accent/20 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${impactColor}15`, border: `1px solid ${impactColor}30` }}>
                    <ImpactIcon className="w-4.5 h-4.5" style={{ width: "18px", height: "18px", color: impactColor }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{log.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.2 0.015 260)", color: "oklch(0.65 0.02 260)" }}>
                        {actionTypeLabels[log.actionType] ?? log.actionType}
                      </span>
                      {log.severity === "error" && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.55 0.22 25 / 0.15)", color: "oklch(0.65 0.22 25)" }}>
                          Errore
                        </span>
                      )}
                      {log.severity === "warning" && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.72 0.18 75 / 0.15)", color: "oklch(0.78 0.18 75)" }}>
                          Attenzione
                        </span>
                      )}
                    </div>
                    {log.reasoning && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{log.reasoning}</p>
                    )}
                    {logDetails && Object.keys(logDetails).length > 0 && (
                      <div className="flex items-center gap-3 mt-1.5">
                        {Object.entries(logDetails).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="text-xs" style={{ color: "oklch(0.6 0.02 260)" }}>
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-medium text-foreground">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    <div>{new Date(log.createdAt).toLocaleDateString("it-IT")}</div>
                    <div>{new Date(log.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
