import { BulkCreator } from "@/components/gelato/bulk-creator";
import { Package2, Zap, Layers } from "lucide-react";

export default function GelatoMaker() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-primary)", opacity: 0.04 }} />
        <div className="relative grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                <Package2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Gelato Print Studio</h1>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Carica i tuoi design, imposta le regole e crea automaticamente centinaia di prodotti nel tuo store Gelato con le giuste dimensioni e posizionamento.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span>Bulk Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.7 0.2 265)" }} />
                <span>Smart Sizing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.65 0.2 310)" }} />
                <span>Chunk Upload</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Package2, label: "Bulk Creator", desc: "Upload multiplo" },
              { icon: Zap, label: "Chunk Sicuro", desc: "6MB per chunk" },
              { icon: Layers, label: "Multi-Ratio", desc: "3x4, 5x7, 1x1" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }}>
                <Icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">4 Step per Creare i Tuoi Prodotti</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Connetti Gelato, carica le immagini, scegli il template e lancia la creazione massiva.
          </p>
        </div>
        <BulkCreator />
      </div>
    </div>
  );
}
