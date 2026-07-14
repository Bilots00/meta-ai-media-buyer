import { describe, expect, it } from "vitest";
import {
  parseChannelInput, median, computeOutlierScores, computeEngagementRate,
  parseAbbreviatedCount, parseIsoDuration, parseRelativeDate, parseClockDuration,
} from "./watchlist";

describe("parseChannelInput", () => {
  it("riconosce gli URL YouTube nei vari formati", () => {
    expect(parseChannelInput("https://www.youtube.com/@kallawaymarketing")).toEqual({ platform: "youtube", handle: "kallawaymarketing" });
    expect(parseChannelInput("youtube.com/@mkbhd/videos")).toEqual({ platform: "youtube", handle: "mkbhd" });
    expect(parseChannelInput("https://www.youtube.com/channel/UC123abc_-xyz")).toEqual({ platform: "youtube", handle: "UC123abc_-xyz" });
  });

  it("riconosce gli URL TikTok e Instagram", () => {
    expect(parseChannelInput("https://www.tiktok.com/@frazerbrookes")).toEqual({ platform: "tiktok", handle: "frazerbrookes" });
    expect(parseChannelInput("https://www.instagram.com/rootsmarketingagency/")).toEqual({ platform: "instagram", handle: "rootsmarketingagency" });
    expect(parseChannelInput("instagram.com/melli.ugc?igsh=xyz")).toEqual({ platform: "instagram", handle: "melli.ugc" });
  });

  it("rifiuta gli URL Instagram di post/reel", () => {
    expect(() => parseChannelInput("https://www.instagram.com/p/Cxyz123/")).toThrow();
    expect(() => parseChannelInput("https://www.instagram.com/reel/Cxyz123/")).toThrow();
  });

  it("gestisce handle nudi con piattaforma esplicita", () => {
    expect(parseChannelInput("@gernucci", "instagram")).toEqual({ platform: "instagram", handle: "gernucci" });
    expect(() => parseChannelInput("@gernucci")).toThrow(/piattaforma/);
    expect(() => parseChannelInput("   ")).toThrow();
  });
});

describe("outlier score (semantica Sandcastles: views / mediana canale)", () => {
  it("median calcola la mediana pari/dispari", () => {
    expect(median([])).toBe(0);
    expect(median([5])).toBe(5);
    expect(median([1, 3, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("computeOutlierScores normalizza sulla mediana del canale", () => {
    const vids = [
      { id: 1, views: 1000 },
      { id: 2, views: 2000 },
      { id: 3, views: 4000 },
      { id: 4, views: 27000 },
    ];
    const scores = computeOutlierScores(vids);
    // mediana = (2000+4000)/2 = 3000
    expect(scores.get(1)).toBeCloseTo(0.33, 2);
    expect(scores.get(4)).toBeCloseTo(9, 2);
  });

  it("con meno di 3 video con views usa baseline 1.0", () => {
    const scores = computeOutlierScores([{ id: 1, views: 100 }, { id: 2, views: 0 }]);
    expect(scores.get(1)).toBe(1);
    expect(scores.get(2)).toBe(1);
  });

  it("computeEngagementRate = interazioni/views", () => {
    expect(computeEngagementRate({ views: 1000, likes: 70, comments: 20, shares: 10 })).toBeCloseTo(0.1, 4);
    expect(computeEngagementRate({ views: 0, likes: 10 })).toBeNull();
    expect(computeEngagementRate({ views: 1000 })).toBeNull();
  });
});

describe("parser scraping", () => {
  it("parseAbbreviatedCount gestisce K/M/B e separatori", () => {
    expect(parseAbbreviatedCount("1.2M views")).toBe(1_200_000);
    expect(parseAbbreviatedCount("894K followers")).toBe(894_000);
    expect(parseAbbreviatedCount("1,234 views")).toBe(1234);
    expect(parseAbbreviatedCount(undefined)).toBe(0);
  });

  it("parseIsoDuration converte PT#H#M#S in secondi", () => {
    expect(parseIsoDuration("PT1M30S")).toBe(90);
    expect(parseIsoDuration("PT2H3M4S")).toBe(7384);
    expect(parseIsoDuration(undefined)).toBeUndefined();
  });

  it("parseClockDuration converte l'overlay thumbnail in secondi", () => {
    expect(parseClockDuration("23:14")).toBe(1394);
    expect(parseClockDuration("1:02:33")).toBe(3753);
    expect(parseClockDuration("SHORTS")).toBeUndefined();
    expect(parseClockDuration(undefined)).toBeUndefined();
  });

  it("parseRelativeDate approssima le date relative di YouTube", () => {
    const d = parseRelativeDate("3 days ago");
    expect(d).toBeInstanceOf(Date);
    const deltaDays = (Date.now() - (d as Date).getTime()) / 86_400_000;
    expect(deltaDays).toBeGreaterThan(2.9);
    expect(deltaDays).toBeLessThan(3.1);
    expect(parseRelativeDate("Streamed live")).toBeUndefined();
  });
});
