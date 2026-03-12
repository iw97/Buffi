import type { ScanAnalysis } from "@/lib/scan/types";

/** Infer a short product category from analysis name or tags (e.g. "sweater", "dress"). */
function inferCategory(a: ScanAnalysis): string {
  const name = (a.name || "").toLowerCase();
  const tags = (a.tags || []).map((t) => t.toLowerCase());
  const combined = `${name} ${tags.join(" ")}`;
  const categories = ["sweater", "dress", "jacket", "coat", "shirt", "pants", "jeans", "skirt", "shorts", "blazer", "cardigan", "hoodie", "top", "blouse", "jumper"];
  for (const cat of categories) {
    if (combined.includes(cat)) return cat;
  }
  return "item";
}

/** Dominant fiber from materials (highest percentage). */
function dominantFiber(a: ScanAnalysis): string {
  const materials = a.materials || [];
  if (materials.length === 0) return "";
  const sorted = [...materials].sort((x, y) => (y.percentage ?? 0) - (x.percentage ?? 0));
  return (sorted[0]?.fiber || "").trim();
}

/**
 * Build secondhand search query from scan analysis.
 * - If product name is available: "[brand] [product name]"
 * - If only composition: "[brand] [inferred category] [dominant fiber]"
 */
export function buildSecondhandSearchQuery(analysis: ScanAnalysis | null): string {
  if (!analysis) return "";
  const brand = (analysis.brand || "").trim() || "Unknown";
  const name = (analysis.name || "").trim();
  if (name) return `${brand} ${name}`.trim();
  const category = inferCategory(analysis);
  const fiber = dominantFiber(analysis);
  const parts = [brand, category, fiber].filter(Boolean);
  return parts.join(" ").trim() || brand;
}
