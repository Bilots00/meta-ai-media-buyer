import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ListChecks, CheckCircle2, Zap, AlertTriangle, ChevronRight,
  Pause, Play, Plus, X, Satellite,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const initials = (name: string) => name.slice(0, 2).toUpperCase();

function AgentAvatar({ name, colorHue, size = 36 }: { name: string; colorHue: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.33,
        background: `linear-gradient(135deg, ${colorHue}, ${colorHue.replace(")", " / 0.6)")})`,
        color: "white",
      }}
    >
      {initials(name)}
    </div>
  );
}

// Colori della Campaign Distribution (ordine identico ad AdLevel)
const DIST_META: Record<string, { label: string; color: string }> = {
  generating: { label: "Generating", color: "oklch(0.6 0.05 260)" },
  publishing: { label: "Publishing", color: "oklch(0.6 0.22 310)" },
  active: { label: "Active", color: "oklch(0.65 0.18 145)" },
  needs_attention: { label: "Needs Attention", color: "oklch(0.55 0.22 25)" },
  review: { label: "Review", color: "oklch(0.65 0.2 265)" },
  paused: { label: "Paused", color: "oklch(0.72 0.18 75)" },
  done: { label: "Done", color: "oklch(0.45 0.03 260)" },
};

const STATUS_DOT: Record<string, string> = {
  active: "oklch(0.65 0.18 145)",
  needs_attention: "oklch(0.55 0.22 25)",
  review: "oklch(0.65 0.2 265)",
  paused: "oklch(0.72 0.18 75)",
  generating: "oklch(0.6 0.05 260)",
  publishing: "oklch(0.6 0.22 310)",
  done: "oklch(0.45 0.03 260)",
};

const cardStyle = { background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.22 0.02 260)" };

// ─── Stat card (riga 1) ───────────────────────────────────────────────────────
function StatCard({ label, icon: Icon, value, sub, valueColor }: {
  label: string; icon: React.ElementType; value: React.ReactNode; sub: string; valueColor?: string;
}) {
  return (
    <div className="card-premium rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-bold" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

// ─── Activity log entry (drawer) ──────────────────────────────────────────────
function ActivityEntry({ agentName, colorHue, message, at }: { agentName: string; colorHue: string; message: string; at: string | Date }) {
  const [expanded, setExpanded] = useState(false);
  const long = message.length > 180;
  return (
    <div className="flex gap-3 py-3 border-b" style={{ borderColor: "oklch(0.2 0.015 260)" }}>
      <AgentAvatar name={agentName} colorHue={colorHue} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">
          {long && !expanded ? `${message.slice(0, 180)}…` : message}
        </p>
        {long && (
          <button className="text-xs mt-1" style={{ color: "oklch(0.65 0.2 265)" }} onClick={() => setExpanded(!expanded)}>
            {expanded ? "See Less ⌃" : "See More ⌄"}
          </button>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(at)}</span>
    </div>
  );
}

// ─── Pagina ───────────────────────────────────────────────────────────────────
export default function MissionControl() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [drawerCampaignId, setDrawerCampaignId] = useState<number | null>(null);
  const [drawerAgentCode, setDrawerAgentCode] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const overview = trpc.metaAgents.overview.useQuery(undefined, { refetchInterval: 15000 });
  const campaignDrawer = trpc.metaAgents.campaignDrawer.useQuery(
    { campaignId: drawerCampaignId ?? 0 },
    { enabled: drawerCampaignId != null, refetchInterval: drawerCampaignId != null ? 20000 : false },
  );
  const agentDrawer = trpc.metaAgents.agentDrawer.useQuery(
    { code: drawerAgentCode ?? "" },
    { enabled: drawerAgentCode != null, refetchInterval: drawerAgentCode != null ? 20000 : false },
  );

  const invalidate = () => { utils.metaAgents.overview.invalidate(); utils.metaAgents.campaignDrawer.invalidate(); };
  const pauseMut = trpc.metaAgents.pauseCampaign.useMutation({ onSuccess: () => { toast.success("Campagna in pausa (propagato su Meta)"); invalidate(); }, onError: (e) => toast.error(e.message) });
  const resumeMut = trpc.metaAgents.resumeCampaign.useMutation({ onSuccess: () => { toast.success("Campagna riattivata"); invalidate(); }, onError: (e) => toast.error(e.message) });
  const managedMut = trpc.metaAgents.setManaged.useMutation({ onSuccess: () => { invalidate(); }, onError: (e) => toast.error(e.message) });

  const data = overview.data;
  const agentByCode = new Map((data?.agents ?? []).map((a) => [a.code, a]));
  const distTotal = data ? Object.values(data.distribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Mission Control</h2>
      </div>

      {/* Riga 1 — stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" icon={ListChecks}
          value={data?.stats.activeCampaigns ?? "—"}
          sub={`${data?.stats.activeCampaigns ?? 0} active`} />
        <StatCard label="Done Today" icon={CheckCircle2}
          value={data?.stats.doneToday ?? "—"}
          sub="completed actions" />
        <StatCard label="Agents Online" icon={Zap}
          value={<span>{data?.stats.agentsOnline ?? 0}<span className="text-base text-muted-foreground font-medium"> /{data?.stats.agentsTotal ?? 9}</span></span>}
          sub={data?.stats.agentsOnlineNames?.length ? data.stats.agentsOnlineNames.join(", ") : "team in standby"} />
        <StatCard label="Urgent" icon={AlertTriangle}
          value={data?.stats.urgent ?? 0}
          sub={data && data.stats.urgent > 0 ? "needs your attention" : "all clear"}
          valueColor={data && data.stats.urgent > 0 ? "oklch(0.55 0.22 25)" : undefined} />
      </div>

      {/* Riga 2 — Campaign Distribution */}
      <div className="card-premium rounded-2xl p-5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign Distribution</span>
        <div className="mt-4 h-2 w-full rounded-full overflow-hidden flex" style={{ background: "oklch(0.2 0.015 260)" }}>
          {data && distTotal > 0 && data.statusOrder.map((s) => (
            data.distribution[s] > 0 ? (
              <div key={s} style={{ width: `${(data.distribution[s] / distTotal) * 100}%`, background: DIST_META[s].color }} />
            ) : null
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {(data?.statusOrder ?? Object.keys(DIST_META)).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: DIST_META[s].color }} />
              {DIST_META[s].label} {data?.distribution[s as keyof typeof data.distribution] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {/* Riga 3 — Active Campaigns + Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ACTIVE CAMPAIGNS */}
        <div className="lg:col-span-2 card-premium rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Campaigns</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{data?.campaigns.length ?? 0} campaigns</span>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
          {overview.isLoading ? (
            <div className="skeleton-shimmer h-16 rounded-xl" />
          ) : (data?.campaigns.length ?? 0) === 0 ? (
            <div className="py-10 text-center">
              <Satellite className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p className="text-sm text-muted-foreground">Nessuna campagna affidata agli agenti.</p>
              <p className="text-xs text-muted-foreground mt-1">Usa "+ Add" oppure lancia una campagna dall'AI Manager.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data!.campaigns.map((c) => {
                const agent = agentByCode.get(c.lastActivityAgent ?? c.assignedAgentCode);
                return (
                  <button
                    key={c.id}
                    onClick={() => { setDrawerAgentCode(null); setDrawerCampaignId(c.id); }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/40"
                    style={{ background: "oklch(0.16 0.015 260)" }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: STATUS_DOT[c.mcStatus] ?? STATUS_DOT.review }} />
                    <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: "oklch(0.65 0.2 265)" }} />
                    <span className="flex-1 font-medium text-sm truncate">{c.name}</span>
                    {agent && <AgentAvatar name={agent.name} colorHue={agent.colorHue} size={26} />}
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.lastActivityAt)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AGENTS */}
        <div className="card-premium rounded-2xl p-5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agents</span>
          <div className="mt-3 space-y-1">
            {(data?.agents ?? []).filter((a) => !a.isLiaison).map((a) => (
              <button key={a.code} onClick={() => { setDrawerCampaignId(null); setDrawerAgentCode(a.code); }}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent/40">
                <AgentAvatar name={a.name} colorHue={a.colorHue} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{a.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{a.role}</span>
                </span>
                {a.status === "working" ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider" style={{ color: "oklch(0.65 0.18 145)" }}>
                    <span className="pulse-dot pulse-dot-active" /> WORKING
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground">IDLE</span>
                )}
              </button>
            ))}
            <div className="pt-3 pb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Department Liaisons</span>
            </div>
            {(data?.agents ?? []).filter((a) => a.isLiaison).map((a) => (
              <button key={a.code} onClick={() => { setDrawerCampaignId(null); setDrawerAgentCode(a.code); }}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent/40">
                <AgentAvatar name={a.name} colorHue={a.colorHue} size={30} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{a.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{a.department} · {a.role}</span>
                </span>
                {a.status === "working" ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider" style={{ color: "oklch(0.65 0.18 145)" }}>
                    <span className="pulse-dot pulse-dot-active" /> WORKING
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground">IDLE</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="text-sm" style={{ color: "oklch(0.65 0.2 265)" }} onClick={() => navigate("/logs")}>
          View full activity log
        </button>
      </div>

      {/* Dialog "+ Add": affida campagne esistenti agli agenti */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg" style={cardStyle}>
          <DialogHeader><DialogTitle>Affida una campagna agli agenti</DialogTitle></DialogHeader>
          {(overview.data?.unmanagedCampaigns.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tutte le campagne sono già gestite dagli agenti (o non ci sono campagne — creane una dall'AI Manager).</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {overview.data!.unmanagedCampaigns.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "oklch(0.16 0.015 260)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[c.mcStatus] ?? STATUS_DOT.review }} />
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  <Button size="sm" className="h-7 text-xs" style={{ background: "var(--gradient-primary)" }}
                    disabled={managedMut.isPending}
                    onClick={() => managedMut.mutate({ campaignId: c.id, managed: true })}>
                    Aggiungi
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drawer campagna (replica AdLevel) */}
      <Sheet open={drawerCampaignId != null} onOpenChange={(o) => !o && setDrawerCampaignId(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto p-5" style={{ background: "oklch(0.12 0.012 260)", borderColor: "oklch(0.22 0.02 260)" }}>
          {campaignDrawer.data ? (
            <div className="space-y-6">
              <div>
                <SheetTitle className="text-lg font-semibold">{campaignDrawer.data.campaign.name}</SheetTitle>
                <span className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: campaignDrawer.data.campaign.status === "ACTIVE" ? "oklch(0.65 0.18 145)" : "oklch(0.72 0.18 75)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                  {campaignDrawer.data.campaign.status === "ACTIVE" ? "Active" : campaignDrawer.data.campaign.status === "DRAFT" ? "In review (Draft)" : campaignDrawer.data.campaign.status.toLowerCase()}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</span>
                <div className="mt-2 flex gap-2">
                  {campaignDrawer.data.campaign.status === "ACTIVE" ? (
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={pauseMut.isPending}
                      onClick={() => pauseMut.mutate({ campaignId: campaignDrawer.data!.campaign.id })}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={resumeMut.isPending}
                      onClick={() => resumeMut.mutate({ campaignId: campaignDrawer.data!.campaign.id })}>
                      <Play className="h-3.5 w-3.5" /> Activate
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5 text-white" style={{ background: "oklch(0.45 0.18 25)" }} disabled={managedMut.isPending}
                    onClick={() => { managedMut.mutate({ campaignId: campaignDrawer.data!.campaign.id, managed: false }); setDrawerCampaignId(null); }}>
                    <X className="h-3.5 w-3.5" /> Remove from Agents
                  </Button>
                </div>
              </div>

              {campaignDrawer.data.currentStatus && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Status</span>
                  <div className="mt-2 flex gap-3 items-start">
                    <AgentAvatar
                      name={campaignDrawer.data.currentStatus.agentName}
                      colorHue={agentByCode.get(campaignDrawer.data.currentStatus.agentCode)?.colorHue ?? "oklch(0.65 0.2 265)"}
                      size={30}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{campaignDrawer.data.currentStatus.agentName} <span className="font-normal text-muted-foreground">— {campaignDrawer.data.currentStatus.agentRole}</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(campaignDrawer.data.currentStatus.at)}: {campaignDrawer.data.currentStatus.message.slice(0, 140)}{campaignDrawer.data.currentStatus.message.length > 140 ? "…" : ""}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={cardStyle}>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-lg font-bold mt-0.5">{campaignDrawer.data.campaign.dailyBudget != null ? `€${campaignDrawer.data.campaign.dailyBudget}/day` : "—"}</p>
                </div>
                <div className="rounded-xl p-3" style={cardStyle}>
                  <p className="text-xs text-muted-foreground">Purchases today</p>
                  <p className="text-lg font-bold mt-0.5">{campaignDrawer.data.kpis.today ? campaignDrawer.data.kpis.today.purchases : "—"}</p>
                </div>
                <div className="rounded-xl p-3" style={cardStyle}>
                  <p className="text-xs text-muted-foreground">CPA</p>
                  <p className="text-lg font-bold mt-0.5">{campaignDrawer.data.kpis.today?.cpa != null ? `€${campaignDrawer.data.kpis.today.cpa.toFixed(2)}` : "—"}</p>
                </div>
                <div className="rounded-xl p-3" style={cardStyle}>
                  <p className="text-xs text-muted-foreground">Creatives active</p>
                  <p className="text-lg font-bold mt-0.5">{campaignDrawer.data.kpis.creativesTotal > 0 ? `${campaignDrawer.data.kpis.creativesActive}/${campaignDrawer.data.kpis.creativesTotal}` : "—"}</p>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Log</span>
                <div className="mt-1">
                  {campaignDrawer.data.activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Ancora nessuna attività degli agenti su questa campagna.</p>
                  ) : campaignDrawer.data.activity.map((a) => (
                    <ActivityEntry key={a.id} agentName={a.agentName}
                      colorHue={agentByCode.get(a.agentCode)?.colorHue ?? "oklch(0.65 0.2 265)"}
                      message={a.message} at={a.at} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="skeleton-shimmer h-40 rounded-xl mt-8" />
          )}
        </SheetContent>
      </Sheet>

      {/* Drawer agente */}
      <Sheet open={drawerAgentCode != null} onOpenChange={(o) => !o && setDrawerAgentCode(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto p-5" style={{ background: "oklch(0.12 0.012 260)", borderColor: "oklch(0.22 0.02 260)" }}>
          {agentDrawer.data ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <AgentAvatar name={agentDrawer.data.agent.name} colorHue={agentDrawer.data.agent.colorHue} size={44} />
                <div>
                  <SheetTitle className="text-lg font-semibold">{agentDrawer.data.agent.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{agentDrawer.data.agent.department} · {agentDrawer.data.agent.role}</p>
                </div>
                <span className="ml-auto text-[10px] font-bold tracking-wider"
                  style={{ color: agentDrawer.data.agent.status === "working" ? "oklch(0.65 0.18 145)" : "oklch(0.55 0.02 260)" }}>
                  {agentDrawer.data.agent.status === "working" ? "WORKING" : "IDLE"}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Log</span>
                <div className="mt-1">
                  {agentDrawer.data.activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nessuna attività registrata (l'agente entra in azione quando gli affidi una campagna).</p>
                  ) : agentDrawer.data.activity.map((a) => (
                    <div key={a.id}>
                      {a.campaignName && <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">{a.campaignName}</p>}
                      <ActivityEntry agentName={a.agentName} colorHue={agentDrawer.data!.agent.colorHue} message={a.message} at={a.at} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="skeleton-shimmer h-40 rounded-xl mt-8" />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
