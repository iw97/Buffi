import { NextRequest, NextResponse } from "next/server";
import type { RawProductData } from "@/lib/scan/types";
import type { ScanAnalysis } from "@/lib/scan/types";
import { analyzeWithClaude } from "@/lib/scan/analyze";
import { scrapeProductFromUrl } from "@/lib/scan/scrape";
import { getGoogleShoppingResults } from "@/lib/scan/serpapi";
import {
  dominantFiberLine,
  getCrossBrandShoppingQueries,
  getSameBrandShoppingQueries,
  isClearlyBetterFiberComposition,
  meetsCrossBrandImprovement,
  MIN_SERP_RESULTS_BEFORE_RETRY,
  normalizeBrand,
  pickComparisonBadge,
  titleMatchesBrand
} from "@/lib/better-alternatives/logic";
import { getFiberBreakdown } from "@/lib/scan/verdict";
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

async function findSameBrandBetter(original: ScanAnalysis): Promise<{
  card: BetterAlternativeCard | null;
  skippedMessage: string | null;
}> {
  const queries = getSameBrandShoppingQueries(original);
  if (!queries) {
    return { card: null, skippedMessage: null };
  }
  const brand = (original.brand || "").trim();
  const { primary: samePrimary, simplified: sameSimplified } = queries;
  let results = await getGoogleShoppingResults(samePrimary, 12);
  if (
    results.length < MIN_SERP_RESULTS_BEFORE_RETRY &&
    samePrimary !== sameSimplified
  ) {
    const more = await getGoogleShoppingResults(sameSimplified, 12);
    if (more.length > results.length) results = more;
  }
  const pool = results.filter((r) => titleMatchesBrand(r.title, brand)).slice(0, 3);

  if (pool.length === 0) {
    return {
      card: null,
      skippedMessage: `We couldn't find a better option from ${brand} in this category.`
    };
  }

  const analyses = await Promise.all(pool.map((p) => analyzeProductUrl(p.link)));
  for (let i = 0; i < analyses.length; i++) {
    const alt = analyses[i];
    if (!alt) continue;
    if (!titleMatchesBrand(alt.brand || alt.name, brand) && !titleMatchesBrand(pool[i].title, brand)) {
      continue;
    }
    if (isClearlyBetterFiberComposition(original, alt)) {
      return { card: toCard(alt, pool[i].link, original), skippedMessage: null };
    }
  }

  return {
    card: null,
    skippedMessage: `We couldn't find a better option from ${brand} in this category.`
  };
}

function scoreAlternative(original: ScanAnalysis, alt: ScanAnalysis): number {
  const a = getFiberBreakdown(alt.materials);
  const markupPenalty =
    typeof alt.markupMax === "number" ? alt.markupMax : alt.markup ?? 50;
  const cpw = alt.costPerWear > 0 ? alt.costPerWear : 99;
  return a.naturalPct * 2 + a.premiumNaturalPct - markupPenalty * 0.15 - cpw * 3;
}

async function findCrossBrandBetter(
  original: ScanAnalysis,
  excludeBrandNorm: string | null
): Promise<BetterAlternativeCard | null> {
  const { primary: crossPrimary, simplified: crossSimplified } = getCrossBrandShoppingQueries(original);
  let results = await getGoogleShoppingResults(crossPrimary, 8);
  if (
    results.length < MIN_SERP_RESULTS_BEFORE_RETRY &&
    crossPrimary !== crossSimplified
  ) {
    const more = await getGoogleShoppingResults(crossSimplified, 8);
    if (more.length > results.length) results = more;
  }
  const top = results.slice(0, 5);
  if (top.length === 0) return null;

  const analyses = await Promise.all(top.map((p) => analyzeProductUrl(p.link)));
  const candidates: { alt: ScanAnalysis; url: string; score: number }[] = [];
  const origNorm = normalizeBrand(original.brand || "");

  for (let i = 0; i < analyses.length; i++) {
    const alt = analyses[i];
    if (!alt) continue;
    if (!meetsCrossBrandImprovement(original, alt)) continue;
    const b = normalizeBrand(alt.brand || "");
    if (excludeBrandNorm && b && b === excludeBrandNorm) continue;
    if (origNorm && b === origNorm) continue;
    candidates.push({
      alt,
      url: top[i].link,
      score: scoreAlternative(original, alt)
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return toCard(best.alt, best.url, original);
}

export async function POST(req: NextRequest): Promise<NextResponse<BetterAlternativesPayload | { error: string }>> {
  try {
    const body = await req.json().catch(() => ({}));
    const scan = body?.scan as ScanAnalysis | undefined;
    if (!scan || typeof scan !== "object" || !Array.isArray(scan.materials)) {
      return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });
    }

    const [sameRes, crossFirst] = await Promise.all([
      findSameBrandBetter(scan),
      findCrossBrandBetter(scan, null)
    ]);

    let crossBrand = crossFirst;
    const excludeSameAsCard =
      sameRes.card != null ? normalizeBrand(sameRes.card.brand) : null;
    if (
      excludeSameAsCard &&
      (!crossBrand || normalizeBrand(crossBrand.brand) === excludeSameAsCard)
    ) {
      crossBrand = await findCrossBrandBetter(scan, excludeSameAsCard);
    }

    const payload: BetterAlternativesPayload = {
      sameBrand: sameRes.card,
      sameBrandSkippedMessage: sameRes.card ? null : sameRes.skippedMessage,
      crossBrand: crossBrand ?? null
    };

    const hasAny =
      payload.sameBrand != null ||
      payload.crossBrand != null ||
      (payload.sameBrandSkippedMessage != null && payload.sameBrandSkippedMessage.length > 0);

    if (!hasAny) {
      return NextResponse.json({
        sameBrand: null,
        sameBrandSkippedMessage: null,
        crossBrand: null
      });
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error(LOG, (e as Error).message);
    return NextResponse.json(
      { error: "Better alternatives failed" },
      { status: 500 }
    );
  }
}
