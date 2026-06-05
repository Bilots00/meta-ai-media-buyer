import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Package, Plus, Loader2, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTemplate } from "@/lib/gelatoFetch";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  type: string;
  variants: string[];
  printAreas: string[];
};

type ProductSelectorProps = {
  onProductSelect: (product: Product) => void;
  selectedProduct?: Product;
};

type SavedTemplate = {
  id: string;
  templateId: string;
  name: string;
  productType?: string;
  variants?: string[];
  createdAt: number;
};

const LS_KEY = "gelato.savedTemplates";

export function ProductSelector({ onProductSelect, selectedProduct }: ProductSelectorProps) {
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showManual, setShowManual] = useState(true);
  const [saved, setSaved] = useState<SavedTemplate[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(saved)); } catch {}
  }, [saved]);

  const isGuidSelected =
    !!selectedProduct &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(selectedProduct.id);

  const loadTemplateById = async (tplId: string, forcedName?: string) => {
    setIsLoading(true);
    try {
      const template = await getTemplate(tplId);
      const product: Product = {
        id: template.id,
        name: forcedName || template.title || `Template ${tplId}`,
        type: template.productType || "apparel",
        variants: (template.variants || []).map((v: any) => v.title),
        printAreas:
          template.variants?.[0]?.imagePlaceholders?.map((p: any) => p.name) ||
          template.imagePlaceholders?.map((p: any) => p.name) ||
          ["front"],
      };
      onProductSelect(product);
      toast.success(`Template caricato: ${product.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Errore nel caricamento del template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductLoad = async () => {
    if (!productId.trim()) return;
    await loadTemplateById(productId, productName || undefined);
    setShowManual(false);
  };

  const onSelectSaved = async (val: string) => {
    if (val === "__other__") { setShowManual(true); return; }
    const picked = saved.find((s) => s.templateId === val);
    if (!picked) return;
    setProductId(picked.templateId);
    setProductName(picked.name);
    setShowManual(false);
    await loadTemplateById(picked.templateId, picked.name);
  };

  const onSaveTemplate = () => {
    if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
      toast.error("Serve un UUID Gelato valido.");
      return;
    }
    const name = productName?.trim() || "Saved Template";
    const entry: SavedTemplate = { id: crypto.randomUUID(), templateId: productId, name, createdAt: Date.now() };
    setSaved((prev) => [entry, ...prev.filter((x) => x.templateId !== entry.templateId)].slice(0, 50));
    toast.success(`Template "${name}" salvato.`);
    setShowManual(false);
  };

  return (
    <div className="space-y-6">
      <Card style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Scegli Template Gelato</span>
          </CardTitle>
          <CardDescription>Usa un template salvato o caricane uno nuovo tramite UUID</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Template salvati</Label>
            <Select onValueChange={onSelectSaved}>
              <SelectTrigger style={{ background: "oklch(0.16 0.015 260)" }}>
                <SelectValue placeholder={saved.length ? "Scegli un template salvato…" : "Nessun template salvato"} />
              </SelectTrigger>
              <SelectContent>
                {saved.map((s) => (
                  <SelectItem key={s.id} value={s.templateId}>{s.name}</SelectItem>
                ))}
                <SelectItem value="__other__">Aggiungi nuovo template…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showManual && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="productId">Template ID Gelato (UUID)</Label>
                <Input id="productId" placeholder="es. 184d99bc-8fbb-40c2-a2f7-32adfc709e98" value={productId} onChange={(e) => setProductId(e.target.value)} style={{ background: "oklch(0.16 0.015 260)" }} />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Trova gli ID template nel tuo dashboard Gelato
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productName">Nome prodotto (opzionale)</Label>
                <Input id="productName" placeholder="Nome personalizzato" value={productName} onChange={(e) => setProductName(e.target.value)} style={{ background: "oklch(0.16 0.015 260)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleProductLoad} disabled={!productId.trim() || isLoading} className="w-full">
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Caricamento…</> : "Carica Template"}
                </Button>
                <Button type="button" variant="secondary" onClick={onSaveTemplate} className="w-full">
                  <Save className="h-4 w-4 mr-2" />Salva
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {isGuidSelected && selectedProduct && (
        <Card style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.35 0.15 145 / 0.5)" }}>
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "oklch(0.35 0.15 145 / 0.15)" }}>
                <Package className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-400">Template Selezionato</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedProduct.name}</p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                  <span>ID: {selectedProduct.id.slice(0, 8)}…</span>
                  <span>•</span>
                  <span>{selectedProduct.variants.length} varianti</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowManual(true)}>
                <Plus className="h-4 w-4 mr-1" />Cambia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
