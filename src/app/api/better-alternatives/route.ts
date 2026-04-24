import { NextRequest, NextResponse } from "next/server";
import type { RawProductData } from "@/lib/scan/types";
import type { ScanAnalysis } from "@/lib/scan/types";
import { analyzeWithClaude } from "@/lib/scan/analyze";
import { scrapeProductFromUrl } from "@/lib/scan/scrape";
import { getGoogleShoppingResults } from "@/lib/scan/serpapi";
import {
  dominantFiberLine,
  fabricGuidanceMessage,
  getAlternativeShoppingQueries,
  isComparableAlternative,
  meetsCrossBrandImprovement,
  MIN_SERP_RESULTS_BEFORE_RETRY,
  normalizeBrand,
  pickComparisonBadge,
  scoreAlternative
} from "@/lib/better-alternatives/logic";
import type { BetterAlternativeCard, BetterAlternativesPayload } from "@/lib/better-alternatives/types";

export type { BetterAlternativeCard, BetterAlternativesPayload } from "@/lib/better-alternatives/types";

export const maxDuration = 120;

const LOG = "[api/better-alternatives]";

async function analyzeProductUrl(productUrl: string): Promise<ScanAnalysis | null> {
  try {
    const scraped = await scrapeProductFromUrl(productUrl);
    if (!scraped || (!scraped.name && !scraped.brand)) return null;
    const raw: RawProductData = {
      url: productUrl,
      name: scraped.name,
      brand: scraped.brand,
      price: scraped.price,
      materials: scraped.materials,
      description: scraped.description,
      imageUrl: scraped.imageUrl ?? null,
      source: "url"
    };
    return await analyzeWithClaude(raw, []);
  } catch (e) {
    console.warn(LOG, "analyzeProductUrl failed", productUrl.slice(0, 80), (e as Error).message);
    return null;
  }
}

function toCard(alt: ScanAnalysis, url: string, original: ScanAnalysis): BetterAlternativeCard {
  return {
    title: alt.name,
    brand: alt.brand || "—",
    price: typeof alt.price === "number" && alt.price > 0 ? alt.price : 0,
    imageUrl: alt.imageUrl ?? null,
    url,
    badge: pickComparisonBadge(original, alt),
    fiberSummary: dominantFiberLine(alt.materials)
  };
}

/**
 * Single unified search across all brands.
 * Priority: (1) same garment type, (2) higher natural fiber %, (3) similar/lower price.
 *
 * Two qualification tiers:
 *   - Tier 1 (meetsCrossBrandImprovement): strictly better fiber, markup, or CPW
 *   - Tier 2 (isComparableAlternative): strong absolute natural content at comparable price
 *
 * Always returns a fallbackMessage when no cards are found.
 */
async function findAlternatives(original: ScanAnalysis): Promise<BetterAlternativesPayload> {
  const { primary: q1, secondary: q2, simplified: q3 } = getAlternativeShoppingQueries(original);
  const origNorm = normalizeBrand(original.brand || "");

  // Fetch candidates — try progressively looser queries until we have enough
  let results = await getGoogleShoppingResults(q1, 15);
  if (results.length < MIN_SERP_RESULTS_BEFORE_RETRY) {
    const more = await getGoogleShoppingResults(q2, 15);
    if (more.length > results.length) results = more;
  }
  if (results.length < MIN_SERP_RESULTS_BEFORE_RETRY) {
    const more = await getGoogleShoppingResults(q3, 15);
    if (more.length > results.length) results = more;
  }

  const top = results.slice(0, 8);
  if (top.length === 0) {
    return { primary: null, secondary: null, fallbackMessage: fabricGuidanceMessage(original) };
  }

  // Scrape and analyze all candidates in parallel
  const analyses = await Promise.all(top.map((p) => analyzeProductUrl(p.link)));

  type Candidate = { alt: ScanAnalysis; url: string; score: number };
  const tier1: Candidate[] = [];
  const tier2: Candidate[] = [];

  for (let i = 0; i < analyses.length; i++) {
    const alt = analyses[i];
    if (!alt) continue;
    // Always exclude the same brand as the scanned item
    const b = normalizeBrand(alt.brand || "");
    if (origNorm && b === origNorm) continue;

    const score = scoreAlternative(original, alt);
    if (meetsCrossBrandImprovement(original, alt)) {
      tier1.push({ alt, url: top[i].link, score });
    } else if (isComparableAlternative(original, alt)) {
      tier2.push({ alt, url: top[i].link, score });
    }
  }

  // Prefer tier-1 candidates; fill from tier-2 if needed
  const pool = tier1.length > 0 ? tier1 : tier2;
  pool.sort((a, b) => b.score - a.score);

  if (pool.length === 0) {
    return { primary: null, secondary: null, fallbackMessage: fabricGuidanceMessage(original) };
  }

  const primaryCandidate = pool[0];
  const primary = toCard(primaryCandidate.alt, primaryCandidate.url, original);

  // Secondary must come from a different brand than primary
  const primaryBrandNorm = normalizeBrand(primaryCandidate.alt.brand || "");
  const secondaryCandidate = pool.slice(1).find((c) => {
    const b = normalizeBrand(c.alt.brand || "");
    return !primaryBrandNorm || b !== primaryBrandNorm;
  }) ?? null;
  const secondary = secondaryCandidate
    ? toCard(secondaryCandidate.alt, secondaryCandidate.url, original)
    : null;

  return { primary, secondary, fallbackMessage: null };
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<BetterAlternativesPayload | { error: string }>> {
  try {
    const body = await req.json().catch(() => ({}));
    const scan = body?.scan as ScanAnalysis | undefined;
    if (!scan || typeof scan !== "object" || !Array.isArray(scan.materials)) {
      return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
    }

    const payload = await findAlternatives(scan);
    return NextResponse.json(payload);
  } catch (e) {
    console.error(LOG, (e as Error).message);
    return NextResponse.json({ error: "Better alternatives failed" }, { status: 500 });
  }
}
