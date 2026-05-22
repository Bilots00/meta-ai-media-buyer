import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Bot, Pause, Play, Plus, Target, TrendingUp, Zap } from "lucide-react";

const goalTypeLabels: Record<string, string> = {
  leads: "Lead Generation",
  sales: "Vendite",
  registrations: "Registrazioni",
  traffic: "Traffico",
  awareness: "Brand Awareness",
};

const goalTypeIcons: Record<string, React.ElementType> = {
  leads: Zap,
  sales: TrendingUp,
  registrations: Target,
  traffic: Bot,
  awareness: Bot,
};

export default function Goals() {
  const utils = trpc.useUtils();
  const { data: goals, isLoading } = trpc.goals.list.useQuery();
  const { data: accounts } = trpc.meta.listAccounts.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    goalType: "leads" as "leads" | "sales" | "registrations" | "traffic" | "awareness",
    targetValue: "",
    targetUnit: "count",
    budgetMax: "",
    metaAccountId: "",
  });

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); setOpen(false); toast.success("Obiettivo creato con successo!"); },
    onError: (e) => toast.error(e.message),
  });

  const launchGoal = trpc.goals.launch.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); toast.success("Agente AI lanciato! Sta lavorando per raggiungere l'obiettivo."); },
    onError: (e) => toast.error(e.message),
  });

  const pauseGoal = trpc.goals.pause.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); toast.info("Agente AI messo in pausa."); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.title || !form.targetValue || !form.budgetMax || !form.metaAccountId) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    createGoal.mutate({
      title: form.title,
      description: form.description,
      goalType: form.goalType,
      targetValue: parseFloat(form.targetValue),
      targetUnit: form.targetUnit,
      budgetMax: parseFloat(form.budgetMax),
      metaAccountId: parseInt(form.metaAccountId),
    });
  };

  const getStatusColor = (status: string) => {
    if (status === "running") return "oklch(0.65 0.2 265)";
    if (status === "completed") return "oklch(0.65 0.18 145)";
    if (status === "failed") return "oklch(0.55 0.22 25)";
    if (status === "paused") return "oklch(0.72 0.18 75)";
    return "oklch(0.6 0.02 260)";
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = { running: "In esecuzione", completed: "Completato", failed: "Fallito", paused: "In pausa", pending: "In attesa" };
    return map[status] ?? status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Sistema Goal-Based</h2>
          <p className="text-sm text-muted-foreground">Imposta un obiettivo e lascia che l'AI lavori autonomamente per raggiungerlo</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button style={{ background: "var(--gradient-primary)" }} className="gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              Nuovo Obiettivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" style={{ color: "oklch(0.65 0.2 265)" }} />
                Nuovo Obiettivo AI
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Account META *</Label>
                <Select value={form.metaAccountId} onValueChange={(v) => setForm(f => ({ ...f, metaAccountId: v }))}>
                  <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                    <SelectValue placeholder="Seleziona account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.accountName ?? a.accountId}</SelectItem>)}
                    {!accounts?.length && <SelectItem value="demo" disabled>Nessun account connesso</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Titolo Obiettivo *</Label>
                <Input placeholder="es. 1000 iscritti webinar Maggio" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Descrizione</Label>
                <Textarea placeholder="Descrivi l'obiettivo e il contesto della campagna..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Tipo Obiettivo *</Label>
                  <Select value={form.goalType} onValueChange={(v) => setForm(f => ({ ...f, goalType: v as typeof form.goalType }))}>
                    <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Valore Target *</Label>
                  <Input type="number" placeholder="es. 1000" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Budget Massimo (€) *</Label>
                <Input type="number" placeholder="es. 5000" value={form.budgetMax} onChange={e => setForm(f => ({ ...f, budgetMax: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                <p className="text-xs text-muted-foreground mt-1">L'agente non supererà mai questo limite di spesa</p>
              </div>
              <Button onClick={handleCreate} disabled={createGoal.isPending} className="w-full font-semibold" style={{ background: "var(--gradient-primary)" }}>
                {createGoal.isPending ? "Creazione in corso..." : "Crea Obiettivo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* How it works */}
      <div className="card-premium rounded-2xl p-5" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.65 0.2 265 / 0.15)" }}>
            <Bot className="w-5 h-5" style={{ color: "oklch(0.65 0.2 265)" }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Come funziona l'agente AI</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Imposti l'obiettivo (es. 1000 iscritti webinar) e il budget massimo (es. €5.000). L'agente AI analizza le campagne attive, valuta le performance in tempo reale e prende decisioni autonome: aumenta il budget alle ads vincenti, mette in pausa quelle inefficaci, riallocando continuamente il budget per massimizzare i risultati. Ogni azione viene registrata nel log con motivazione dettagliata.
            </p>
          </div>
        </div>
      </div>

      {/* Goals List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : goals?.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-2">Nessun obiettivo creato</h3>
          <p className="text-sm text-muted-foreground mb-4">Crea il tuo primo obiettivo per lanciare l'agente AI</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals?.map((goal) => {
            const progress = Math.min(100, (parseFloat(goal.currentValue?.toString() ?? "0") / parseFloat(goal.targetValue.toString())) * 100);
            const budgetProgress = Math.min(100, (parseFloat(goal.budgetSpent?.toString() ?? "0") / parseFloat(goal.budgetMax.toString())) * 100);
            const Icon = goalTypeIcons[goal.goalType] ?? Target;
            return (
              <div key={goal.id} className={`card-premium rounded-2xl p-5 ${goal.agentRunning ? "glow-primary" : ""}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${getStatusColor(goal.status)}15`, border: `1px solid ${getStatusColor(goal.status)}30` }}>
                      <Icon className="w-5 h-5" style={{ color: getStatusColor(goal.status) }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{goal.title}</h3>
                        {goal.agentRunning && <div className="pulse-dot pulse-dot-running" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{goalTypeLabels[goal.goalType]} · Budget max: €{parseFloat(goal.budgetMax.toString()).toLocaleString("it-IT")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${getStatusColor(goal.status)}15`, color: getStatusColor(goal.status), border: `1px solid ${getStatusColor(goal.status)}30` }}>
                      {getStatusLabel(goal.status)}
                    </div>
                    {(goal.status === "pending" || goal.status === "paused") && (
                      <Button size="sm" className="h-8 gap-1.5 font-medium" style={{ background: "var(--gradient-primary)" }} onClick={() => launchGoal.mutate({ goalId: goal.id })} disabled={launchGoal.isPending}>
                        <Play className="w-3.5 h-3.5" />
                        Lancia Agente
                      </Button>
                    )}
                    {goal.status === "running" && (
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 font-medium" onClick={() => pauseGoal.mutate({ goalId: goal.id })} disabled={pauseGoal.isPending}>
                        <Pause className="w-3.5 h-3.5" />
                        Pausa
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Progresso obiettivo</span>
                      <span className="font-medium text-foreground">{parseFloat(goal.currentValue?.toString() ?? "0").toFixed(0)} / {parseFloat(goal.targetValue.toString()).toFixed(0)} {goal.targetUnit}</span>
                    </div>
                    <Progress value={progress} className="h-2" style={{ background: "oklch(0.2 0.015 260)" }} />
                    <div className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% completato</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Budget utilizzato</span>
                      <span className="font-medium text-foreground">€{parseFloat(goal.budgetSpent?.toString() ?? "0").toFixed(2)} / €{parseFloat(goal.budgetMax.toString()).toFixed(2)}</span>
                    </div>
                    <Progress value={budgetProgress} className="h-2" style={{ background: "oklch(0.2 0.015 260)" }} />
                    <div className="text-xs text-muted-foreground mt-1">{budgetProgress.toFixed(1)}% del budget</div>
                  </div>
                </div>

                {goal.description && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3" style={{ borderTop: "1px solid oklch(0.2 0.015 260)" }}>{goal.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
