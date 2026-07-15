import type { Express, Request, Response } from "express";

// Proxy immagini per la Watchlist. Instagram (cdninstagram/fbcdn) e TikTok
// (tiktokcdn) bloccano l'hotlinking cross-origin dal browser → le thumbnail
// restano nere. Il server le scarica (server-to-server, nessun blocco) e le
// ri-serve dal nostro dominio. Allowlist rigida sugli host per evitare SSRF.
const ALLOWED_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "ttwstatic.com",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// 1x1 GIF trasparente: risposta di fallback così l'onError del client scatta pulito
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function isAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

export function registerImageProxy(app: Express) {
  app.get("/api/img", async (req: Request, res: Response) => {
    const raw = typeof req.query.url === "string" ? req.query.url : "";
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      res.status(400).send("bad url");
      return;
    }
    if (target.protocol !== "https:" || !isAllowed(target.hostname)) {
      res.status(403).send("host not allowed");
      return;
    }
    try {
      const upstream = await fetch(target.toString(), {
        headers: { "User-Agent": BROWSER_UA, Accept: "image/*,*/*" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) {
        // immagine scaduta/rimossa: 1x1 trasparente, il client mostra il placeholder
        res.set("Cache-Control", "public, max-age=300");
        res.type("gif").send(TRANSPARENT_GIF);
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
      // le URL firmate dei CDN durano ore: cache 6h nel browser
      res.set("Cache-Control", "public, max-age=21600, immutable");
      res.send(buf);
    } catch (err) {
      console.warn("[imageProxy] error:", err);
      res.set("Cache-Control", "no-store");
      res.type("gif").send(TRANSPARENT_GIF);
    }
  });
}
