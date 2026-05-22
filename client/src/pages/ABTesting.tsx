import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FlaskConical, Loader2, Plus, Trophy, Zap } from "lucide-react";

export default function ABTesting() {
  const utils = trpc.useUtils();
  const { data: tests, isLoading } = trpc.abTests.list.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ campaignId: "", name: "", hypothesis: "" });

  const createTest = trpc.abTests.create.useMutation({
    onSuccess: () => { utils.abTests.list.invalidate(); setOpen(false); toast.success("A/B Test creato!"); },
    onError: (e) => toast.error(e.message),
  });

  const evaluateTest = trpc.abTests.evaluate.useMutation({
    onSuccess: (d) => {
      utils.abTests.list.invalidate();
      toast.success(`Valutazione completata! Vincitore: Variante ${d.winner} (confidenza ${d.confidence}%)`);
    },
    onError: (e) => toast.error(e.message),
  });

  const getStatusColor = (status: string) => {
    if (status === "running") return "oklch(0.65 0.2 265)";
    if (status === "completed") return "oklch(0.65 0.18 145)";
    if (status === "paused") return "oklch(0.72 0.18 75)";
    return "oklch(0.6 0.02 260)";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">A/B Testing Intelligente</h2>
          <p className="text-sm text-muted-foreground">Crea e monitora test comparativi con valutazione statistica AI</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button style={{ background: "var(--gradient-primary)" }} className="gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              Nuovo A/B Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5" style={{ color: "oklch(0.65 0.2 265)" }} />
                Nuovo A/B Test
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Campagna *</Label>
                <Select value={form.campaignId} onValueChange={(v) => setForm(f => ({ ...f, campaignId: v }))}>
                  <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                    <SelectValue placeholder="Seleziona campagna" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Nome del Test *</Label>
                <Input placeholder="es. Test headline emozionale vs razionale" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Ipotesi del Test</Label>
                <Textarea placeholder="Cosa ti aspetti di dimostrare con questo test?" value={form.hypothesis} onChange={e => setForm(f => ({ ...f, hypothesis: e.target.value }))} rows={3} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              </div>
              <div className="p-3 rounded-xl text-sm text-muted-foreground" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
                Dopo la creazione, potrai assegnare le varianti A e B dal pannello del test. L'AI valuterà automaticamente i risultati con analisi statistica.
              </div>
              <Button onClick={() => { if (!form.campaignId || !form.name) { toast.error("Compila tutti i campi"); return; } createTest.mutate({ campaignId: parseInt(form.campaignId), name: form.name, hypothesis: form.hypothesis }); }} disabled={createTest.isPending} className="w-full font-semibold" style={{ background: "var(--gradient-primary)" }}>
                {createTest.isPending ? "Creazione..." : "Crea A/B Test"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { step: "1", title: "Crea il test", desc: "Definisci l'ipotesi e assegna le varianti A e B alle tue inserzioni" },
          { step: "2", title: "Monitora le performance", desc: "L'AI raccoglie dati in tempo reale su CTR, conversioni e CPA per ogni variante" },
          { step: "3", title: "Valutazione statistica", desc: "L'AI determina il vincitore con significatività statistica e spiega il perché" },
        ].map((s) => (
          <div key={s.step} className="card-premium rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-3" style={{ background: "var(--gradient-primary)", color: "white" }}>{s.step}</div>
            <h4 className="font-semibold text-foreground text-sm mb-1">{s.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Tests List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 rounded-2xl skeleton-shimmer" />)}</div>
      ) : tests?.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-2">Nessun A/B Test attivo</h3>
          <p className="text-sm text-muted-foreground">Crea il tuo primo test comparativo per ottimizzare le inserzioni</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests?.map((test) => (
            <div key={test.id} className="card-premium rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${getStatusColor(test.status)}15`, border: `1px solid ${getStatusColor(test.status)}30` }}>
                    {test.status === "completed" ? <Trophy className="w-5 h-5" style={{ color: getStatusColor(test.status) }} /> : <FlaskConical className="w-5 h-5" style={{ color: getStatusColor(test.status) }} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{test.name}</h3>
                    <div className="text-xs text-muted-foreground">Campagna ID: {test.campaignId}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${getStatusColor(test.status)}15`, color: getStatusColor(test.status), border: `1px solid ${getStatusColor(test.status)}30` }}>
                    {test.status === "running" ? "In corso" : test.status === "completed" ? "Completato" : "In pausa"}
                  </div>
                  {test.status === "running" && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => evaluateTest.mutate({ testId: test.id })} disabled={evaluateTest.isPending}>
                      {evaluateTest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Valuta AI
                    </Button>
                  )}
                </div>
              </div>

              {test.hypothesis && (
                <div className="text-sm text-muted-foreground mb-3 p-3 rounded-lg" style={{ background: "oklch(0.16 0.015 260)" }}>
                  <span className="font-medium text-foreground">Ipotesi: </span>{test.hypothesis}
                </div>
              )}

              {test.status === "completed" && test.winnerVariant && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 145 / 0.08)", border: "1px solid oklch(0.65 0.18 145 / 0.2)" }}>
                  <Trophy className="w-5 h-5 shrink-0" style={{ color: "oklch(0.65 0.18 145)" }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 145)" }}>
                      Vincitore: Variante {test.winnerVariant}
                      {test.confidenceLevel && ` — Confidenza: ${parseFloat(test.confidenceLevel.toString()).toFixed(0)}%`}
                    </div>
                    {test.conclusionNotes && <div className="text-xs text-muted-foreground mt-0.5">{test.conclusionNotes}</div>}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 text-xs text-muted-foreground" style={{ borderTop: "1px solid oklch(0.2 0.015 260)" }}>
                <span>Creato: {new Date(test.createdAt).toLocaleDateString("it-IT")}</span>
                {test.endDate && <span>Concluso: {new Date(test.endDate).toLocaleDateString("it-IT")}</span>}
                {test.statisticalSignificance && <span className="text-green-400">✓ Statisticamente significativo</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
