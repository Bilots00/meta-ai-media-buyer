import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Check, Copy, Loader2, Sparkles, Wand2 } from "lucide-react";

const toneOptions = ["professionale", "amichevole", "urgente", "emozionale", "diretto", "storytelling", "provocatorio"];
const objectiveOptions = ["Vendite e-commerce", "Lead generation", "Iscrizioni webinar", "Download app", "Traffico sito", "Brand awareness", "Retargeting acquirenti"];

export default function CopyGenerator() {
  const [form, setForm] = useState({ objective: "", productDescription: "", targetAudience: "", tone: "professionale", campaignContext: "" });
  const [result, setResult] = useState<{ headlines: string[]; primaryTexts: string[]; descriptions: string[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = trpc.copyGen.generate.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Copy generati con successo!"); },
    onError: (e) => toast.error(e.message),
  });

  const handleGenerate = () => {
    if (!form.objective || !form.productDescription || !form.targetAudience) {
      toast.error("Compila obiettivo, descrizione prodotto e target audience");
      return;
    }
    generate.mutate(form);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiato!");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="card-premium rounded-2xl p-6" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Generatore Copy AI</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              L'AI genera automaticamente 5 varianti di headline, testo primario e descrizione per le tue inserzioni META, ottimizzate per il tuo obiettivo e target specifico.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Form */}
        <div className="col-span-2 space-y-4">
          <div className="card-premium rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Parametri Campagna</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Obiettivo *</Label>
                <Select value={form.objective} onValueChange={(v) => setForm(f => ({ ...f, objective: v }))}>
                  <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                    <SelectValue placeholder="Seleziona obiettivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {objectiveOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Prodotto / Servizio *</Label>
                <Textarea
                  placeholder="Descrivi il prodotto o servizio che vuoi promuovere..."
                  value={form.productDescription}
                  onChange={e => setForm(f => ({ ...f, productDescription: e.target.value }))}
                  rows={3}
                  style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Target Audience *</Label>
                <Input
                  placeholder="es. Donne 25-45 anni, appassionate di fitness"
                  value={form.targetAudience}
                  onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                  style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Tono di Voce</Label>
                <Select value={form.tone} onValueChange={(v) => setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Contesto Aggiuntivo</Label>
                <Textarea
                  placeholder="Promozioni attive, stagionalità, USP specifiche..."
                  value={form.campaignContext}
                  onChange={e => setForm(f => ({ ...f, campaignContext: e.target.value }))}
                  rows={2}
                  style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}
                />
              </div>
              <Button onClick={handleGenerate} disabled={generate.isPending} className="w-full gap-2 font-semibold" style={{ background: "var(--gradient-primary)" }}>
                {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generazione...</> : <><Sparkles className="w-4 h-4" />Genera Copy AI</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-3 space-y-4">
          {generate.isPending && (
            <div className="card-premium rounded-2xl p-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 agent-running-indicator" style={{ background: "var(--gradient-primary)" }}>
                <Bot className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">AI sta scrivendo...</h3>
              <p className="text-sm text-muted-foreground">Generazione di 5 varianti per ogni elemento del copy</p>
            </div>
          )}

          {result && !generate.isPending && (
            <>
              {/* Headlines */}
              <div className="card-premium rounded-2xl p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.65 0.2 265 / 0.15)", color: "oklch(0.75 0.15 265)" }}>Headline</span>
                  Titoli (max 40 caratteri)
                </h3>
                <div className="space-y-2">
                  {result.headlines.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl group hover:bg-accent/50 transition-colors" style={{ border: "1px solid oklch(0.22 0.015 260)" }}>
                      <span className="text-sm text-foreground">{h}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">{h.length}/40</span>
                        <button onClick={() => copyToClipboard(h, `h${i}`)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                          {copied === `h${i}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Texts */}
              <div className="card-premium rounded-2xl p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.75 0.18 145)" }}>Testo Primario</span>
                  Testi Principali (max 125 caratteri)
                </h3>
                <div className="space-y-2">
                  {result.primaryTexts.map((t, i) => (
                    <div key={i} className="flex items-start justify-between p-3 rounded-xl group hover:bg-accent/50 transition-colors" style={{ border: "1px solid oklch(0.22 0.015 260)" }}>
                      <span className="text-sm text-foreground flex-1 pr-3">{t}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <span className="text-xs text-muted-foreground">{t.length}/125</span>
                        <button onClick={() => copyToClipboard(t, `t${i}`)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                          {copied === `t${i}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Descriptions */}
              <div className="card-premium rounded-2xl p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.72 0.18 75 / 0.15)", color: "oklch(0.78 0.18 75)" }}>Descrizione</span>
                  Descrizioni (max 30 caratteri)
                </h3>
                <div className="space-y-2">
                  {result.descriptions.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl group hover:bg-accent/50 transition-colors" style={{ border: "1px solid oklch(0.22 0.015 260)" }}>
                      <span className="text-sm text-foreground">{d}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">{d.length}/30</span>
                        <button onClick={() => copyToClipboard(d, `d${i}`)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                          {copied === `d${i}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!result && !generate.isPending && (
            <div className="card-premium rounded-2xl p-12 text-center">
              <Wand2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="font-semibold text-foreground mb-2">Nessun copy generato</h3>
              <p className="text-sm text-muted-foreground">Compila i parametri e clicca "Genera Copy AI"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
