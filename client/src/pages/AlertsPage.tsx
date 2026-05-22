import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCheck, CheckCircle, Info, Shield, XCircle, Zap } from "lucide-react";

const alertTypeLabels: Record<string, string> = {
  budget_anomaly: "Anomalia Budget",
  performance_drop: "Calo Performance",
  api_error: "Errore API",
  spend_limit_reached: "Limite Spesa Raggiunto",
  cpa_spike: "Picco CPA",
  roas_drop: "Calo ROAS",
  ad_rejected: "Inserzione Rifiutata",
  account_disabled: "Account Disabilitato",
  goal_at_risk: "Obiettivo a Rischio",
};

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: React.ElementType; label: string }> = {
  critical: { color: "oklch(0.55 0.22 25)", bg: "oklch(0.55 0.22 25 / 0.1)", border: "oklch(0.55 0.22 25 / 0.3)", icon: XCircle, label: "Critico" },
  high: { color: "oklch(0.65 0.22 35)", bg: "oklch(0.65 0.22 35 / 0.1)", border: "oklch(0.65 0.22 35 / 0.3)", icon: AlertTriangle, label: "Alto" },
  medium: { color: "oklch(0.72 0.18 75)", bg: "oklch(0.72 0.18 75 / 0.1)", border: "oklch(0.72 0.18 75 / 0.3)", icon: AlertTriangle, label: "Medio" },
  low: { color: "oklch(0.65 0.2 265)", bg: "oklch(0.65 0.2 265 / 0.1)", border: "oklch(0.65 0.2 265 / 0.3)", icon: Info, label: "Basso" },
};

export default function AlertsPage() {
  const utils = trpc.useUtils();
  const { data: allAlerts, isLoading } = trpc.alerts.list.useQuery({ onlyUnread: false });
  const { data: unreadAlerts } = trpc.alerts.list.useQuery({ onlyUnread: true });

  const markRead = trpc.alerts.markRead.useMutation({
    onSuccess: () => { utils.alerts.list.invalidate(); },
  });

  const resolve = trpc.alerts.resolve.useMutation({
    onSuccess: () => { utils.alerts.list.invalidate(); toast.success("Alert risolto"); },
  });

  const markAllRead = trpc.alerts.markAllRead.useMutation({
    onSuccess: (d) => { utils.alerts.list.invalidate(); toast.success(`${d.count} alert segnati come letti`); },
  });

  const criticalAlerts = allAlerts?.filter(a => a.severity === "critical" && !a.isResolved) ?? [];
  const unreadCount = unreadAlerts?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Alert & Disaster Recovery</h2>
          <p className="text-sm text-muted-foreground">Sistema di monitoraggio attivo — notifiche immediate per anomalie critiche</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="w-3.5 h-3.5" />
            Segna tutti come letti ({unreadCount})
          </Button>
        )}
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "oklch(0.55 0.22 25 / 0.08)", border: "2px solid oklch(0.55 0.22 25 / 0.4)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.55 0.22 25 / 0.2)" }}>
              <XCircle className="w-4.5 h-4.5" style={{ color: "oklch(0.65 0.22 25)", width: "18px", height: "18px" }} />
            </div>
            <div>
              <div className="font-semibold" style={{ color: "oklch(0.75 0.22 25)" }}>
                {criticalAlerts.length} Alert Critico{criticalAlerts.length > 1 ? "i" : ""} — Intervento Richiesto
              </div>
              <div className="text-xs text-muted-foreground">L'agente AI ha sospeso le operazioni automatiche in attesa della tua revisione</div>
            </div>
          </div>
          <div className="space-y-2">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "oklch(0.55 0.22 25 / 0.05)" }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: "oklch(0.8 0.15 25)" }}>{alert.title}</div>
                  <div className="text-xs text-muted-foreground">{alert.message}</div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs h-7" onClick={() => resolve.mutate({ id: alert.id })}>
                  <CheckCircle className="w-3 h-3" />
                  Risolto
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, title: "Monitoraggio Continuo", desc: "L'agente monitora spesa, CPA, ROAS e performance ogni ciclo di ottimizzazione" },
          { icon: Bell, title: "Notifica Immediata", desc: "Alert critici e alti vengono notificati immediatamente al supervisore via notifica" },
          { icon: Zap, title: "Azione Automatica", desc: "Per alert critici, l'agente si ferma autonomamente in attesa della tua approvazione" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card-premium rounded-xl p-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: "oklch(0.65 0.2 265 / 0.1)" }}>
                <Icon className="w-4 h-4" style={{ color: "oklch(0.65 0.2 265)" }} />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">{s.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* All Alerts */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl skeleton-shimmer" />)}</div>
      ) : allAlerts?.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(0.65 0.18 145)", opacity: 0.5 }} />
          <h3 className="font-semibold text-foreground mb-2">Nessun alert</h3>
          <p className="text-sm text-muted-foreground">Tutto nella norma — l'agente sta operando correttamente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allAlerts?.map((alert) => {
            const config = severityConfig[alert.severity] ?? severityConfig.low;
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`rounded-xl p-4 transition-opacity ${alert.isResolved ? "opacity-50" : ""}`} style={{ background: alert.isRead ? "oklch(0.14 0.015 260)" : config.bg, border: `1px solid ${alert.isRead ? "oklch(0.22 0.015 260)" : config.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${config.color}15` }}>
                    <Icon className="w-4.5 h-4.5" style={{ width: "18px", height: "18px", color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground">{alert.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${config.color}15`, color: config.color }}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{alertTypeLabels[alert.alertType] ?? alert.alertType}</span>
                      {!alert.isRead && <div className="w-2 h-2 rounded-full ml-auto shrink-0" style={{ background: config.color }} />}
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.createdAt).toLocaleDateString("it-IT")} alle {new Date(alert.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!alert.isRead && (
                      <button onClick={() => markRead.mutate({ id: alert.id })} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground text-xs">
                        Letto
                      </button>
                    )}
                    {!alert.isResolved && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => resolve.mutate({ id: alert.id })}>
                        <CheckCircle className="w-3 h-3" />
                        Risolvi
                      </Button>
                    )}
                    {alert.isResolved && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Risolto
                      </span>
                    )}
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
