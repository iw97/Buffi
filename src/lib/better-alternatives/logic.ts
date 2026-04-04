import type { ScanAnalysis } from "@/lib/scan/types";
import { getFiberBreakdown } from "@/lib/scan/verdict";

/** Cross-brand “better natural fiber” target — listings rarely use branded names (Naia, Tencel, etc.). */
export const CROSS_BRAND_NATURAL_OR_QUERY = "linen OR cotton OR silk";

/** @deprecated Use CROSS_BRAND_NATURAL_OR_QUERY or getCrossBrandShoppingQueries. */
export const NATURAL_FIBER_OR_QUERY = CROSS_BRAND_NATURAL_OR_QUERY;

const MIN_SERP_RESULTS_BEFORE_RETRY = 3;

export { MIN_SERP_RESULTS_BEFORE_RETRY };

/** How to qualify a same-brand Shopping query from the dominant fiber label. */
export type SameBrandFiberQualifier =
  | { kind: "none" }
  | { kind: "exact"; term: string }
  | { kind: "polyester" };

/**
 * Map label fiber strings to Shopping query terms. Branded / regenerated cellulosics → no qualifier
 * (those words rarely appear in product titles). Recycled / REPREVE → "polyester". Standard naturals → exact name.
 */
export function dominantFiberSearchQualifier(
  materials: { fiber: string; percentage: number }[]
): SameBrandFiberQualifier {
  if (!materials.length) return { kind: "none" };
  const sorted = [...materials].sort((a, b) => b.percentage - a.percentage);
  const f = sorted[0].fiber.toLowerCase();

  if (f.includes("repreve") || (f.includes("recycled") && f.includes("polyester"))) {
    return { kind: "polyester" };
  }
  if (f.includes("nylon") || f.includes("polyamide")) {
    return { kind: "exact", term: "nylon" };
  }
  if (f.includes("polyester")) {
    return { kind: "exact", term: "polyester" };
  }

  if (
    f.includes("naia renew") ||
    f.includes("naia") ||
    f.includes("cellulose acetate") ||
    f.includes("triacetate") ||
    f.includes("acetate")
  ) {
    return { kind: "none" };
  }
  if (f.includes("lyocell") || f.includes("tencel") || f.includes("modal")) {
    return { kind: "none" };
  }
  if (f.includes("viscose") || f.includes("rayon")) {
    return { kind: "none" };
  }

  const naturals: { needle: string; term: string }[] = [
    { needle: "cashmere", term: "cashmere" },
    { needle: "merino", term: "merino wool" },
    { needle: "wool", term: "wool" },
    { needle: "silk", term: "silk" },
    { needle: "linen", term: "linen" },
    { needle: "cotton", term: "cotton" },
    { needle: "hemp", term: "hemp" }
  ];
  for (const { needle, term } of naturals) {
    if (f.includes(needle)) return { kind: "exact", term };
  }

  return { kind: "none" };
}

export function shoppingPriceCapUsd(scan: ScanAnalysis): number {
  const basePrice = typeof scan.price === "number" && scan.price > 0 ? scan.price : 50;
  return Math.ceil(basePrice * 1.2);
}

/**
 * Same-brand Shopping: `[brand] [category] [optional fiber] under $cap`.
 * Fiber phrase omitted for branded/obscure materials; simplified fallback drops any fiber qualifier.
 */
export function getSameBrandShoppingQueries(scan: ScanAnalysis): { primary: string; simplified: string } | null {
  const brand = (scan.brand || "").trim();
  if (!brand || /^unknown$/i.test(brand)) return null;

  const category = inferGarmentCategory(scan.name);
  const cap = shoppingPriceCapUsd(scan);
  const pricePart = `under $${cap}`;

  const simplified = `${brand} ${category} ${pricePart}`.replace(/\s+/g, " ").trim();
  const qual = dominantFiberSearchQualifier(scan.materials);

  if (qual.kind === "none") {
    return { primary: simplified, simplified };
  }
  if (qual.kind === "polyester") {
    const primary = `${brand} ${category} polyester ${pricePart}`.replace(/\s+/g, " ").trim();
    return { primary, simplified };
  }
  const primary = `${brand} ${category} ${qual.term} ${pricePart}`.replace(/\s+/g, " ").trim();
  return { primary, simplified };
}

/** Cross-brand: genuinely natural fibers as improvement target; simplified = category + price only. */
export function getCrossBrandShoppingQueries(scan: ScanAnalysis): { primary: string; simplified: string } {
  const category = inferGarmentCategory(scan.name);
  const cap = shoppingPriceCapUsd(scan);
  const primary = `${category} ${CROSS_BRAND_NATURAL_OR_QUERY} under $${cap}`.replace(/\s+/g, " ").trim();
  const simplified = `${category} under $${cap}`.replace(/\s+/g, " ").trim();
  return { primary, simplified };
}

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
