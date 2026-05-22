import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle, Code, Copy, ExternalLink, Loader2, Shield, Zap } from "lucide-react";

const STANDARD_EVENTS = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead", "CompleteRegistration", "Contact", "Subscribe", "Search"];

export default function TrackingSetup() {
  const utils = trpc.useUtils();
  const { data: accounts } = trpc.meta.listAccounts.useQuery();
  const [selectedAccount, setSelectedAccount] = useState("");
  const [capiEnabled, setCapiEnabled] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["PageView", "Purchase", "Lead"]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ verified: boolean; lastFired?: string; pixelName?: string } | null>(null);

  const { data: config } = trpc.tracking.getConfig.useQuery(
    { metaAccountId: parseInt(selectedAccount) },
    { enabled: !!selectedAccount }
  );

  useEffect(() => {
    if (config) {
      setPixelId(config.pixelId ?? "");
      setCapiEnabled(config.capiEnabled ?? false);
      setCapiToken(config.capiAccessToken ?? "");
      setWebsiteUrl(config.websiteUrl ?? "");
      setSelectedEvents((config.trackedEvents as string[]) ?? ["PageView", "Purchase", "Lead"]);
    }
  }, [config]);

  const { data: pixels } = trpc.tracking.getPixels.useQuery({ metaAccountId: parseInt(selectedAccount) }, { enabled: !!selectedAccount });

  const saveConfig = trpc.tracking.saveConfig.useMutation({
    onSuccess: () => { utils.tracking.getConfig.invalidate(); toast.success("Configurazione tracking salvata!"); },
    onError: (e) => toast.error(e.message),
  });

  const verifyPixel = trpc.tracking.verifyPixel.useMutation({
    onSuccess: (d) => {
      setIsVerifying(false);
      setVerificationResult(d);
      if (d.verified) toast.success("Pixel verificato! Sta ricevendo eventi.");
      else toast.warning("Pixel non verificato. Controlla l'installazione.");
    },
    onError: (e) => { setIsVerifying(false); toast.error(e.message); },
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const pixelCode = pixelId ? `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->` : "";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="card-premium rounded-2xl p-6" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Configurazione Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Configura il Meta Pixel e le Conversions API (CAPI) per tracciare accuratamente le conversioni. Il CAPI invia gli eventi direttamente dal server, bypassando gli ad blocker e migliorando la qualità dei dati del 30-50%.
            </p>
          </div>
        </div>
      </div>

      {/* Account Selection */}
      <div className="card-premium rounded-2xl p-5">
        <Label className="text-sm text-muted-foreground mb-2 block">Account META</Label>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="max-w-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
            <SelectValue placeholder="Seleziona account" />
          </SelectTrigger>
          <SelectContent>
            {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.accountName ?? a.accountId}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedAccount && (
        <>
          {/* Pixel Configuration */}
          <div className="card-premium rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "oklch(0.65 0.2 265 / 0.15)" }}>
                <Shield className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.2 265)" }} />
              </div>
              Meta Pixel
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Pixel ID</Label>
                <div className="flex gap-2">
                  <Input placeholder="es. 1234567890123456" value={pixelId} onChange={e => setPixelId(e.target.value)} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                  {pixels && pixels.length > 0 && (
                    <Select onValueChange={(v) => setPixelId(v)}>
                      <SelectTrigger className="w-32" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }}>
                        <SelectValue placeholder="Scegli" />
                      </SelectTrigger>
                      <SelectContent>
                        {pixels.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">URL Sito Web</Label>
                <Input placeholder="https://tuosito.it" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              </div>
            </div>

            {/* Verification */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setIsVerifying(true); verifyPixel.mutate({ metaAccountId: parseInt(selectedAccount) }); }} disabled={!pixelId || isVerifying}>
                {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Verifica Installazione
              </Button>
              {verificationResult && (
                <div className={`flex items-center gap-2 text-sm font-medium ${verificationResult.verified ? "text-green-400" : "text-yellow-400"}`}>
                  {verificationResult.verified ? (
                    <><CheckCircle className="w-4 h-4" />Pixel attivo — ultimo evento: {verificationResult.lastFired ? new Date(verificationResult.lastFired).toLocaleDateString("it-IT") : "N/A"}</>
                  ) : (
                    <>Pixel non rilevato. Installa il codice sul sito.</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CAPI */}
          <div className="card-premium rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "oklch(0.65 0.18 145 / 0.15)" }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.18 145)" }} />
                </div>
                Conversions API (CAPI)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Abilitato</span>
                <Switch checked={capiEnabled} onCheckedChange={setCapiEnabled} />
              </div>
            </div>
            {capiEnabled && (
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">Access Token CAPI</Label>
                <Input type="password" placeholder="Token di accesso per le Conversions API" value={capiToken} onChange={e => setCapiToken(e.target.value)} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Ottieni il token da: Meta Business Manager → Gestione eventi → Impostazioni → Conversions API
                </p>
              </div>
            )}
          </div>

          {/* Events */}
          <div className="card-premium rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Eventi da Tracciare</h3>
            <div className="grid grid-cols-5 gap-2">
              {STANDARD_EVENTS.map(event => (
                <button key={event} onClick={() => toggleEvent(event)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${selectedEvents.includes(event) ? "text-white" : "text-muted-foreground hover:text-foreground"}`} style={{ background: selectedEvents.includes(event) ? "var(--gradient-primary)" : "oklch(0.18 0.015 260)", border: `1px solid ${selectedEvents.includes(event) ? "transparent" : "oklch(0.25 0.02 260)"}` }}>
                  {event}
                </button>
              ))}
            </div>
          </div>

          {/* Pixel Code */}
          {pixelId && (
            <div className="card-premium rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Code className="w-4 h-4 text-muted-foreground" />
                  Codice Pixel da Installare
                </h3>
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => { navigator.clipboard.writeText(pixelCode); toast.success("Codice copiato!"); }}>
                  <Copy className="w-3 h-3" />
                  Copia
                </Button>
              </div>
              <pre className="text-xs p-4 rounded-xl overflow-x-auto" style={{ background: "oklch(0.12 0.01 260)", color: "oklch(0.75 0.05 265)", border: "1px solid oklch(0.2 0.015 260)" }}>
                {pixelCode}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">Incolla questo codice nell'&lt;head&gt; di tutte le pagine del tuo sito web.</p>
            </div>
          )}

          {/* Save */}
          <Button onClick={() => saveConfig.mutate({ metaAccountId: parseInt(selectedAccount), pixelId, capiEnabled, capiAccessToken: capiToken, websiteUrl, trackedEvents: selectedEvents })} disabled={saveConfig.isPending} className="gap-2 font-semibold" style={{ background: "var(--gradient-primary)" }}>
            {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Salva Configurazione
          </Button>
        </>
      )}
    </div>
  );
}
