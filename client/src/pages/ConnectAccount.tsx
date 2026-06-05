import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, ExternalLink, Loader2, Plug, RefreshCw, Trash2, Unplug } from "lucide-react";

export default function ConnectAccount() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.meta.listAccounts.useQuery();
  const [form, setForm] = useState({ accountId: "", accountName: "", accessToken: "" });
  const [isConnecting, setIsConnecting] = useState(false);

  const connectAccount = trpc.meta.connectAccount.useMutation({
    onSuccess: (d) => {
      utils.meta.listAccounts.invalidate();
      setForm({ accountId: "", accountName: "", accessToken: "" });
      setIsConnecting(false);
      toast.success(`Account "${d.accountName}" connesso con successo!`);
    },
    onError: (e) => { setIsConnecting(false); toast.error(`Errore: ${e.message}`); },
  });

  const disconnectAccount = trpc.meta.disconnectAccount.useMutation({
    onSuccess: () => { utils.meta.listAccounts.invalidate(); toast.info("Account disconnesso"); },
    onError: (e) => toast.error(e.message),
  });

  const syncAccount = trpc.meta.syncAccount.useMutation({
    onSuccess: (d) => { utils.meta.listAccounts.invalidate(); toast.success(`Sincronizzati ${d.snapshotsSaved} snapshot KPI`); },
    onError: (e) => toast.error(e.message),
  });

  const handleConnect = () => {
    if (!form.accountId || !form.accessToken) { toast.error("Inserisci Account ID e Access Token"); return; }
    setIsConnecting(true);
    connectAccount.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="card-premium rounded-2xl p-6" style={{ background: "oklch(0.65 0.2 265 / 0.05)", border: "1px solid oklch(0.65 0.2 265 / 0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Plug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Connetti Account META</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Collega il tuo account pubblicitario META Business per consentire all'agente AI di gestire le campagne in autonomia. Avrai bisogno dell'Account ID e di un Access Token con permessi di gestione ads.
            </p>
          </div>
        </div>
      </div>

      {/* How to get credentials */}
      <div className="card-premium rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Come ottenere le credenziali META</h3>
        <div className="space-y-3">
          {[
            { step: "1", title: "Account ID", desc: "Vai su Meta Business Manager → Impostazioni account → Informazioni account. L'Account ID è il numero visualizzato (es. 1234567890)." },
            { step: "2", title: "Access Token", desc: "Vai su Meta for Developers → I tuoi app → Strumenti → Graph API Explorer. Genera un token con i permessi: ads_management, ads_read, business_management." },
            { step: "3", title: "Token a lungo termine", desc: "Per uso in produzione, converti il token in un token a lungo termine (60 giorni) tramite l'endpoint /oauth/access_token." },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "oklch(0.16 0.015 260)" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: "var(--gradient-primary)", color: "white" }}>{s.step}</div>
              <div>
                <div className="text-sm font-medium text-foreground">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 text-xs font-medium" style={{ color: "oklch(0.65 0.2 265)" }}>
          <ExternalLink className="w-3.5 h-3.5" />
          Apri Graph API Explorer
        </a>
      </div>

      {/* Connection Form */}
      <div className="card-premium rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Connetti Nuovo Account</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">Account ID *</Label>
              <Input placeholder="es. 1234567890" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
              <p className="text-xs text-muted-foreground mt-1">Senza il prefisso "act_"</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">Nome Account (opzionale)</Label>
              <Input placeholder="es. Il Mio E-commerce" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Access Token *</Label>
            <Input type="password" placeholder="EAAxxxxxxxxxxxxxxxxxxxxx..." value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))} style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.25 0.02 260)" }} />
            <p className="text-xs text-muted-foreground mt-1">Il token viene memorizzato in modo sicuro e non è mai esposto nel frontend</p>
          </div>
          <Button onClick={handleConnect} disabled={isConnecting || connectAccount.isPending} className="gap-2 font-semibold" style={{ background: "var(--gradient-primary)" }}>
            {isConnecting ? <><Loader2 className="w-4 h-4 animate-spin" />Connessione in corso...</> : <><Plug className="w-4 h-4" />Connetti Account</>}
          </Button>
        </div>
      </div>

      {/* Connected Accounts */}
      {isLoading ? (
        <div className="h-24 rounded-2xl skeleton-shimmer" />
      ) : accounts && accounts.length > 0 ? (
        <div className="card-premium rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Account Connessi</h3>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${account.status === "active" ? "" : "opacity-50"}`} style={{ background: account.status === "active" ? "oklch(0.65 0.18 145 / 0.15)" : "oklch(0.55 0.22 25 / 0.15)" }}>
                    {account.status === "active" ? <CheckCircle className="w-4.5 h-4.5" style={{ color: "oklch(0.65 0.18 145)", width: "18px", height: "18px" }} /> : <Unplug className="w-4.5 h-4.5" style={{ color: "oklch(0.55 0.22 25)", width: "18px", height: "18px" }} />}
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{account.accountName ?? account.accountId}</div>
                    <div className="text-xs text-muted-foreground">ID: {account.accountId} · {account.currency} · {account.timezone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => syncAccount.mutate({ metaAccountId: account.id })} disabled={syncAccount.isPending}>
                    <RefreshCw className={`w-3 h-3 ${syncAccount.isPending ? "animate-spin" : ""}`} />
                    Sincronizza KPI
                  </Button>
                  <button onClick={() => disconnectAccount.mutate({ accountId: account.id })} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card-premium rounded-2xl p-8 text-center">
          <Plug className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">Nessun account connesso. Connetti il tuo primo account META per iniziare.</p>
        </div>
      )}
    </div>
  );
}
