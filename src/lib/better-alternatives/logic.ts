import type { ScanAnalysis } from "@/lib/scan/types";
import { getFiberBreakdown } from "@/lib/scan/verdict";

/** Natural-fiber preference fragment for Google Shopping queries (not sponsored). */
export const NATURAL_FIBER_OR_QUERY = "linen OR cotton OR wool OR merino OR silk OR modal OR lyocell";

export function inferGarmentCategory(productName: string): string {
  const n = productName.toLowerCase();
  const phrases = [
    "plunge bra",
    "sports bra",
    "t-shirt",
    "crop top",
    "mesh top",
    "blazer",
    "puffer",
    "windbreaker",
    "rain jacket",
    "jacket",
    "coat",
    "dress",
    "jeans",
    "trousers",
    "pants",
    "shorts",
    "skirt",
    "sweater",
    "hoodie",
    "cardigan",
    "leggings",
    "bodysuit",
    "romper",
    "jumpsuit",
    "polo",
    "cardigan",
    "underwear",
    "thong",
    "bikini",
    "swimwear",
    "activewear",
    "sneakers",
    "boots",
    "bra",
    "lingerie",
    "hosiery",
    "tights",
    "shirt",
    "tank",
    "tee"
  ];
  for (const p of phrases) {
    if (n.includes(p)) return p;
  }
  const words = productName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(-2).join(" ").toLowerCase();
  return words[0]?.toLowerCase() || "clothing";
}

export function getMarkupBounds(scan: ScanAnalysis): { min: number; max: number } {
  if (typeof scan.markupMin === "number" && typeof scan.markupMax === "number") {
    return { min: scan.markupMin, max: scan.markupMax };
  }
  const m = scan.markup ?? 0;
  return { min: m, max: m };
}

export function isClearlyBetterFiberComposition(original: ScanAnalysis, alternative: ScanAnalysis): boolean {
  const o = getFiberBreakdown(original.materials);
  const a = getFiberBreakdown(alternative.materials);
  if (a.naturalPct > o.naturalPct + 3) return true;
  if (o.naturalPct >= 80 && a.premiumNaturalPct > o.premiumNaturalPct + 8) return true;
  if (a.syntheticPct + 5 < o.syntheticPct && a.naturalPct > o.naturalPct) return true;
  return false;
}

export function meetsCrossBrandImprovement(original: ScanAnalysis, alternative: ScanAnalysis): boolean {
  const o = getFiberBreakdown(original.materials);
  const a = getFiberBreakdown(alternative.materials);
  const { min: origMin, max: origMax } = getMarkupBounds(original);
  const { min: altMin, max: altMax } = getMarkupBounds(alternative);
  const fiberBetter =
    a.naturalPct > o.naturalPct + 2 ||
    a.premiumNaturalPct > o.premiumNaturalPct + 5 ||
    a.syntheticPct + 3 < o.syntheticPct;
  const lowerMarkup = origMin > 0 && altMax < origMin;
  const betterCpw =
    original.costPerWear > 0 &&
    alternative.costPerWear > 0 &&
    alternative.costPerWear <= original.costPerWear * 0.8;
  return fiberBetter || lowerMarkup || betterCpw;
}

export type ComparisonBadge = "more_natural" | "lower_markup" | "better_cpw";

export function pickComparisonBadge(original: ScanAnalysis, alternative: ScanAnalysis): ComparisonBadge {
  const o = getFiberBreakdown(original.materials);
  const a = getFiberBreakdown(alternative.materials);
  const { min: origMin } = getMarkupBounds(original);
  const { max: altMax } = getMarkupBounds(alternative);
  const natDelta = a.naturalPct - o.naturalPct;
  const markupDelta = origMin > 0 ? origMin - altMax : 0;
  const cpwRatio =
    original.costPerWear > 0 && alternative.costPerWear > 0
      ? (original.costPerWear - alternative.costPerWear) / original.costPerWear
      : 0;

  const scores: { key: ComparisonBadge; score: number }[] = [
    { key: "more_natural", score: natDelta },
    { key: "lower_markup", score: markupDelta },
    { key: "better_cpw", score: cpwRatio * 100 }
  ];
  scores.sort((x, y) => y.score - x.score);
  return scores[0]?.key ?? "more_natural";
}

export function dominantFiberLine(materials: { fiber: string; percentage: number }[]): string {
  if (!materials.length) return "—";
  const sorted = [...materials].sort((a, b) => b.percentage - a.percentage);
  const top = sorted[0];
  return `${top.fiber} ${Math.round(top.percentage)}%`;
}

export function normalizeBrand(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function titleMatchesBrand(title: string, brand: string): boolean {
  if (!brand.trim()) return false;
  const t = title.toLowerCase();
  const b = brand.toLowerCase();
  return t.includes(b);
}
