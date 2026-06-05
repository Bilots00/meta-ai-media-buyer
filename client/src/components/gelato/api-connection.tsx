import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, ExternalLink } from "lucide-react";

interface ApiConnectionProps {
  onConnect: (credentials: { apiKey: string; storeName: string }) => void;
  isConnected: boolean;
  storeName?: string;
}

export function ApiConnection({ onConnect, isConnected, storeName }: ApiConnectionProps) {
  const [apiKey, setApiKey] = useState("");
  const [storeNameInput, setStoreNameInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim() || !storeNameInput.trim()) return;
    setIsConnecting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    onConnect({ apiKey: apiKey.trim(), storeName: storeNameInput.trim() });
    setIsConnecting(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)" }}>
          <span className="text-2xl font-bold text-white">G</span>
        </div>
        <CardTitle className="text-xl">Connetti Gelato</CardTitle>
        <CardDescription>Inserisci le credenziali API per iniziare ad automatizzare</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Connesso</span>
            </div>
            <Badge variant="secondary">{storeName}</Badge>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Gelato API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Inserisci la tua API key Gelato"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ background: "oklch(0.16 0.015 260)" }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeName">Nome Store</Label>
              <Input
                id="storeName"
                placeholder="es. DreamBrothers"
                value={storeNameInput}
                onChange={(e) => setStoreNameInput(e.target.value)}
                style={{ background: "oklch(0.16 0.015 260)" }}
              />
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <span>Trova la tua API key nel dashboard Gelato → Settings → API</span>
            </div>
            <Button onClick={handleConnect} disabled={!apiKey.trim() || !storeNameInput.trim() || isConnecting} className="w-full" style={{ background: "var(--gradient-primary)" }}>
              {isConnecting ? "Connessione..." : "Connetti"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
