import type { Express, Request, Response } from "express";
import { getAdBrands } from "../db";
import { ingestFromRest } from "../adsLibraryService";

// Ads Inspiration endpoints — twin di socialRoutes.ts, stesso modello
// "agente-Claude-VPS primario": GET dei brand da scrapare, POST delle ads
// normalizzate. Protetti dallo stesso secret (x-care-secret = CARE_WEBHOOK_SECRET).
const OWNER_USER_ID = 1;

function checkSecret(req: Request, res: Response): boolean {
  const expected = process.env.CARE_WEBHOOK_SECRET;
  if (!expected) {
    res.status(503).json({ error: "CARE_WEBHOOK_SECRET not configured on the server" });
    return false;
  }
  if (req.headers["x-care-secret"] !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export function registerAdsLibraryRoutes(app: Express) {
  // Agente VPS -> lista dei brand in watchlist (con pageId) da scrapare
  app.get("/api/ads-library/brands", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const brands = await getAdBrands(OWNER_USER_ID);
      res.json({
        success: true,
        brands: brands.map((b) => ({
          id: b.id, name: b.name, pageId: b.pageId, status: b.status,
          adCount: b.adCount, lastRefreshAt: b.lastRefreshAt,
        })),
      });
    } catch (err) {
      console.warn("[ads-library/brands] error:", err);
      res.status(500).json({ error: "brands failed" });
    }
  });

  // Agente VPS -> ingest delle ads scrapate dalla Facebook Ads Library
  app.post("/api/ads-library/ingest", async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return;
    try {
      const { pageId, ads } = (req.body ?? {}) as { pageId?: string; ads?: Array<Record<string, unknown>> };
      if (!pageId || !Array.isArray(ads)) {
        res.status(400).json({ error: "pageId and ads[] are required" });
        return;
      }
      const r = await ingestFromRest(OWNER_USER_ID, String(pageId), ads);
      res.json({ success: true, ...r });
    } catch (err) {
      console.warn("[ads-library/ingest] error:", err);
      res.status(500).json({ error: "ingest failed" });
    }
  });
}
