import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Megaphone, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";

const objectiveLabels: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffico",
  OUTCOME_LEADS: "Lead Generation",
  OUTCOME_SALES: "Vendite",
  OUTCOME_AWARENESS: "Brand Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "Promozione App",
};

export default function Campaigns() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const { data: accounts } = trpc.meta.listAccounts.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_LEADS" as "OUTCOME_TRAFFIC" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_APP_PROMOTION",
    dailyBudget: "",
    budgetLimit: "",
    metaAccountId: "",
    publishToMeta: false,
    notes: "",
  });

  const [creatives, setCreatives] = useState<{ name: string; thumb: string; view: string }[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("db_campaign_assets");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          setCreatives(arr);
          setOpen(true);
          setForm(f => ({ ...f, notes: "Creative: " + arr.map((a: { name: string }) => a.name).join(", ") }));
        }
        localStorage.removeItem("db_campaign_assets");
      }
    } catch {}
  }, []);

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); setOpen(false); toast.success("Campagna creata!"); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.campaigns.updateStatus.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Stato aggiornato"); },
    onError: (e) => toast.error(e.message),
  });

  const syncFromMeta = trpc.campaigns.syncFromMeta.useMutation({
    onSuccess: (d) => { utils.campaigns.list.invalidate(); toast.success(`Sincronizzate ${d.synced} campagne da META`); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name || !form.metaAccountId) { toast.error("Compila nome e account"); return; }
    createCampaign.mutate({
      name: form.name,
      objective: form.objective,
      dailyBudget: form.dailyBudget ? parseFloat(form.dailyBudget) : undefined,
      budgetLimit: form.budgetLimit ? parseFloat(form.budgetLimit) : undefined,
      metaAccountId: parseInt(form.metaAccountId),
      publishToMeta: form.publishToMeta,
      notes: form.notes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Gestione Campagne META</h2>
          <p className="text-sm text-muted-foreground">Crea, monitora e ottimizza le tue campagne pubblicitarie</p>
        </div>
        <div className="flex items-center gap-3">
          {accounts?.[0] && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => syncFromMeta.mutate({ metaAccountId: accounts[0].id })} disabled={syncFromMeta.isPending}>
              <RefreshCw className={`w-3.5 h-3.5 ${syncFromMeta.isPending ? "animate-spin" : ""}`} />
              Sincronizza da META
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button style={{ background: "var(--gradient-primary)" }} className="gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                Nuova Campagna
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5" style={{ color: "oklch(0.65 0.2 265)" }} />
                  Nuova Campagna META
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {creatives.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                    <div className="text-xs text-muted-foreground mb-2">Creative selezionate ({creatives.length})</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {creatives.map((c2, i) => <img key={i} src={c2.thumb} alt={c2.name} className="w-14 h-14 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />)}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Account META *</Label>
                  <Select value={form.metaAccountId} onValueChange={(v) => setForm(f => ({ ...f, metaAccountId: v }))}>
                    <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                      <SelectValue placeholder="Seleziona account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.accountName ?? a.accountId}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Nome Campagna *</Label>
                  <Input placeholder="es. Campagna Lead Gen Maggio 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Obiettivo</Label>
                  <Select value={form.objective} onValueChange={(v) => setForm(f => ({ ...f, objective: v as typeof form.objective }))}>
                    <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(objectiveLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block">Budget Giornaliero (€)</Label>
                    <Input type="number" placeholder="es. 50" value={form.dailyBudget} onChange={e => setForm(f => ({ ...f, dailyBudget: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block">Limite Budget (€)</Label>
                    <Input type="number" placeholder="es. 1500" value={form.budgetLimit} onChange={e => setForm(f => ({ ...f, budgetLimit: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                  <div>
                    <div className="text-sm font-medium text-foreground">Pubblica su META</div>
                    <div className="text-xs text-muted-foreground">Crea la campagna direttamente nell'account META</div>
                  </div>
                  <Switch checked={form.publishToMeta} onCheckedChange={(v) => setForm(f => ({ ...f, publishToMeta: v }))} />
                </div>
                <Button onClick={handleCreate} disabled={createCampaign.isPending} className="w-full font-semibold" style={{ background: "var(--gradient-primary)" }}>
                  {createCampaign.isPending ? "Creazione..." : "Crea Campagna"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Campaigns Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
        </div>
      ) : campaigns?.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-2">Nessuna campagna</h3>
          <p className="text-sm text-muted-foreground mb-4">Crea la tua prima campagna o sincronizza dall'account META</p>
        </div>
      ) : (
        <div className="card-premium rounded-2xl overflow-hidden">
          <table className="w-full table-premium">
            <thead>
              <tr style={{ background: "oklch(0.16 0.015 260)" }}>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Campagna</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Obiettivo</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget/giorno</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stato</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {campaigns?.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-foreground text-sm">{c.name}</div>
                    {c.metaCampaignId && <div className="text-xs text-muted-foreground mt-0.5">ID: {c.metaCampaignId}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-muted-foreground">{objectiveLabels[c.objective] ?? c.objective}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-foreground">{c.dailyBudget ? `€${parseFloat(c.dailyBudget.toString()).toFixed(2)}` : "—"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className={c.status === "ACTIVE" ? "badge-active" : c.status === "PAUSED" ? "badge-paused" : "badge-draft"}>
                      <div className={`pulse-dot ${c.status === "ACTIVE" ? "pulse-dot-active" : c.status === "PAUSED" ? "pulse-dot-warning" : "bg-muted-foreground"}`} />
                      {c.status === "ACTIVE" ? "Attiva" : c.status === "PAUSED" ? "In pausa" : c.status === "DRAFT" ? "Bozza" : c.status}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {c.status !== "ACTIVE" && (
                        <button onClick={() => updateStatus.mutate({ id: c.id, status: "ACTIVE" })} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-green-400" title="Attiva">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {c.status === "ACTIVE" && (
                        <button onClick={() => updateStatus.mutate({ id: c.id, status: "PAUSED" })} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-yellow-400" title="Pausa">
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => updateStatus.mutate({ id: c.id, status: "ARCHIVED" })} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-red-400" title="Archivia">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
