import type { ScanAnalysis } from "./types";

export function isZaraProductPageUrl(url: string): boolean {
  try {
    return /(^|\.)zara\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True when we do not have a usable fiber breakdown (e.g. only "Unknown"). */
export function isZaraCompositionInsufficient(analysis: ScanAnalysis): boolean {
  const mats = analysis.materials;
  if (!Array.isArray(mats) || mats.length === 0) return true;
  const weak = new Set(["unknown", "unspecified", "not specified", "n/a", "na"]);
  if (mats.length === 1) {
    const f = mats[0].fiber.trim().toLowerCase();
    if (weak.has(f) || f === "unknown fiber") return true;
  }
  return false;
}
