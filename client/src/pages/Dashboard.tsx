import { trpc } from "@/lib/trpc";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, BarChart3, Megaphone, RefreshCw, Target, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

function KpiCard({ label, value, unit, change, color, icon: Icon }: {
  label: string; value: string | number; unit?: string; change?: number; color: string; icon: React.ElementType;
}) {
  return (
    <div className="card-premium kpi-card rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {unit && <div className="text-sm text-muted-foreground mb-1">{unit}</div>}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}% vs periodo precedente
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-sm" style={{ background: "oklch(0.16 0.02 260)", border: "1px solid oklch(0.25 0.02 260)", boxShadow: "var(--shadow-elevated)" }}>
      <div className="text-muted-foreground mb-2 text-xs">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground font-medium">{p.name}: </span>
          <span style={{ color: p.color }}>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [, navigate] = useLocation();
  const { data, isLoading, refetch } = trpc.kpi.getDashboard.useQuery({ days }, { refetchInterval: 60000 });
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: goals } = trpc.goals.list.useQuery();

  const kpis = data?.kpis;
  const chartData = data?.chartData ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Performance Overview</h2>
          <p className="text-sm text-muted-foreground">Aggiornamento automatico ogni 60 secondi</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-36 h-9 text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="14">Ultimi 14 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="ROAS" value={isLoading ? "—" : (kpis?.roas ?? 0).toFixed(2)} unit="x" color="oklch(0.65 0.18 145)" icon={TrendingUp} />
        <KpiCard label="CPA" value={isLoading ? "—" : `€${(kpis?.cpa ?? 0).toFixed(2)}`} color="oklch(0.65 0.2 265)" icon={Target} />
        <KpiCard label="CPL" value={isLoading ? "—" : `€${(kpis?.cpl ?? 0).toFixed(2)}`} color="oklch(0.72 0.18 75)" icon={Zap} />
        <KpiCard label="Conv. Rate" value={isLoading ? "—" : (kpis?.conversionRate ?? 0).toFixed(2)} unit="%" color="oklch(0.68 0.2 45)" icon={BarChart3} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Budget Speso", value: `€${(kpis?.totalSpend ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`, color: "oklch(0.6 0.22 310)" },
          { label: "Revenue Generata", value: `€${(kpis?.totalRevenue ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`, color: "oklch(0.65 0.18 145)" },
          { label: "Conversioni Totali", value: (kpis?.totalConversions ?? 0).toLocaleString("it-IT"), color: "oklch(0.65 0.2 265)" },
          { label: "Lead Generati", value: (kpis?.totalLeads ?? 0).toLocaleString("it-IT"), color: "oklch(0.72 0.18 75)" },
        ].map((item) => (
          <div key={item.label} className="card-premium rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
            <div className="text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5">
        {/* Spend & Revenue Chart */}
        <div className="col-span-2 card-premium rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-foreground">Spesa vs Revenue</h3>
              <p className="text-xs text-muted-foreground">Andamento giornaliero</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.65 0.2 265)" }} /><span className="text-muted-foreground">Spesa</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.65 0.18 145)" }} /><span className="text-muted-foreground">Revenue</span></div>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.65 0.2 265)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.2 265)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.01 260)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 260)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.02 260)" }} tickFormatter={(v) => `€${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="spend" name="Spesa" stroke="oklch(0.65 0.2 265)" fill="url(#spendGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="oklch(0.65 0.18 145)" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
                <p className="text-xs text-muted-foreground mt-1">Connetti il tuo account META per iniziare</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="space-y-4">
          <div className="card-premium rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Campagne</span>
              <Megaphone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{data?.activeCampaigns ?? 0}</div>
            <div className="text-xs text-muted-foreground">attive su {data?.totalCampaigns ?? 0} totali</div>
            <Button variant="ghost" size="sm" className="mt-3 w-full text-xs h-8" onClick={() => navigate("/campaigns")}>
              Gestisci campagne →
            </Button>
          </div>

          <div className="card-premium rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Obiettivi AI</span>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{data?.activeGoals ?? 0}</div>
            <div className="text-xs text-muted-foreground">agenti in esecuzione</div>
            <Button variant="ghost" size="sm" className="mt-3 w-full text-xs h-8" onClick={() => navigate("/goals")}>
              Gestisci obiettivi →
            </Button>
          </div>

          <div className="card-premium rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Alert Attivi</span>
              <div className={`w-2 h-2 rounded-full ${(data?.unreadAlerts ?? 0) > 0 ? "pulse-dot pulse-dot-error" : "pulse-dot pulse-dot-active"}`} />
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{data?.unreadAlerts ?? 0}</div>
            <div className="text-xs text-muted-foreground">notifiche non lette</div>
            <Button variant="ghost" size="sm" className="mt-3 w-full text-xs h-8" onClick={() => navigate("/alerts")}>
              Visualizza alert →
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      {campaigns && campaigns.length > 0 && (
        <div className="card-premium rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Campagne Recenti</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/campaigns")}>
              Vedi tutte →
            </Button>
          </div>
          <div className="space-y-2">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${c.status === "ACTIVE" ? "pulse-dot pulse-dot-active" : c.status === "PAUSED" ? "bg-yellow-500" : "bg-muted"}`} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.objective.replace("OUTCOME_", "")}</div>
                  </div>
                </div>
                <div className={c.status === "ACTIVE" ? "badge-active" : c.status === "PAUSED" ? "badge-paused" : "badge-draft"}>
                  {c.status === "ACTIVE" ? "Attiva" : c.status === "PAUSED" ? "In pausa" : c.status === "DRAFT" ? "Bozza" : c.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
