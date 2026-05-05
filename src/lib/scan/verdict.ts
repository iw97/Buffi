/**
 * Three-tier verdict: Worth It (teal) | Think Twice (amber) | Retail Trap (red).
 * Fiber taxonomy: only petroleum-based fibers count as “synthetic %”; cellulosic ≠ synthetic.
 */

import type { VerdictTier } from "./types";

export type { VerdictTier } from "./types";

/** Longer / specific phrases first so “organic cotton” wins over “cotton”. */
const PREMIUM_NATURAL = [
  "organic cotton",
  "pima cotton",
  "egyptian cotton",
  "merino wool",
  "merino",
  "cashmere",
  "alpaca",
  "angora",
  "belgian linen",
  "irish linen",
  "premium linen",
  "european linen",
  "silk",
  "linen"
];

const STANDARD_NATURAL = ["cotton", "wool", "hemp", "ramie", "jute", "kapok", "flax"];

const PREMIUM_CELLULOSIC = [
  "naia renew",
  "naia",
  "bamboo lyocell",
  "lenzing",
  "ecovero",
  "tencel",
  "lyocell",
  "cupro",
  "modal"
];

const STANDARD_CELLULOSIC = [
  "bamboo viscose",
  "bamboo rayon",
  "cellulose acetate",
  "triacetate",
  "viscose",
  "rayon",
  "acetate",
  "bamboo"
];

/** Petroleum-based only — never viscose/rayon/modal here. */
const PETROLEUM_SYNTHETIC = [
  "repreve",
  "oceancycle",
  "ocean cycle",
  "recycled polyester",
  "recycled nylon",
  "polyester",
  "polyamide",
  "nylon",
  "microfiber",
  "polyurethane",
  "polypropylene",
  "gore-tex",
  "acrylic",
  "elastane",
  "spandex",
  "lycra",
  "pvc"
];

function normalizeFiber(fiber: string): string {
  return fiber.toLowerCase().trim();
}

function categoryForFiber(fiber: string): "premium" | "standard" | "synthetic" | "other" {
  const n = normalizeFiber(fiber);
  for (const p of PREMIUM_NATURAL) {
    if (n.includes(p)) return "premium";
  }
  for (const p of PREMIUM_CELLULOSIC) {
    if (n.includes(p)) return "premium";
  }
  for (const s of STANDARD_NATURAL) {
    if (n.includes(s)) return "standard";
  }
  for (const s of STANDARD_CELLULOSIC) {
    if (n.includes(s)) return "standard";
  }
  for (const s of PETROLEUM_SYNTHETIC) {
    if (n.includes(s)) return "synthetic";
  }
  return "other";
}

export function getFiberBreakdown(
  materials: { fiber: string; percentage: number }[]
): { premiumNaturalPct: number; naturalPct: number; syntheticPct: number } {
  let premium = 0,
    natural = 0,
    synthetic = 0;
  for (const m of materials) {
    const pct = m.percentage || 0;
    switch (categoryForFiber(m.fiber)) {
      case "premium":
        premium += pct;
        natural += pct;
        break;
      case "standard":
        natural += pct;
        break;
      case "synthetic":
        synthetic += pct;
        break;
      default:
        break;
    }
  }
  return {
    premiumNaturalPct: premium,
    naturalPct: natural,
    syntheticPct: synthetic
  };
}

const PREDOMINANT = 50;

/** Parse fiber strings like "Cotton 100%" or "Polyester 80%, Elastane 20%" into materials array. */
export function parseFibersToMaterials(fibers: string[]): { fiber: string; percentage: number }[] {
  const out: { fiber: string; percentage: number }[] = [];
  for (const s of fibers) {
    const parts = s.split(",").map((p) => p.trim());
    for (const p of parts) {
      const match = p.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%?$/);
      if (match) {
        const fiber = match[1].trim();
        const percentage = parseFloat(match[2]) || 0;
        if (fiber && percentage >= 0) out.push({ fiber, percentage });
      }
    }
  }
  return out;
}

const VERDICT_ORDER: Record<string, number> = { "Worth It": 0, "Think Twice": 1, "Retail Trap": 2 };

function verdictSeverity(tier: VerdictTier): number {
  return VERDICT_ORDER[tier] ?? 0;
}

/** Lenient markup band widening (percentage points added to Worth It / Think Twice ceilings). Only brand + certification flags — not functionalSynthetic. */
export function markupLeniencyPct(flags: {
  isSmallBusiness: boolean;
  isEthicalBrand: boolean;
  hasCertifiedMaterials: boolean;
}): number {
  let n = 0;
  if (flags.isEthicalBrand || flags.isSmallBusiness) n += 100;
  if (flags.hasCertifiedMaterials) n += 50;
  return n;
}

/** Compute verdict from markup range: use worst-case (markupMax). If min and max fall in different tiers, return the worse verdict and a span note. */
export function computeVerdictFromRange(analysis: {
  markupMin: number;
  markupMax: number;
  materials: { fiber: string; percentage: number }[];
  isSmallBusiness?: boolean;
  isEthicalBrand?: boolean;
  hasCertifiedMaterials?: boolean;
  /** When true, omit fiber-quality pejoratives in reasons only; does not change tier thresholds. */
  functionalSynthetic?: boolean;
}): { verdict: VerdictTier; verdictReason: string; verdictSpanNote: string | null } {
  const resMin = computeVerdict({
    markup: analysis.markupMin,
    materials: analysis.materials,
    isSmallBusiness: analysis.isSmallBusiness,
    isEthicalBrand: analysis.isEthicalBrand,
    hasCertifiedMaterials: analysis.hasCertifiedMaterials,
    functionalSynthetic: analysis.functionalSynthetic
  });
  const resMax = computeVerdict({
    markup: analysis.markupMax,
    materials: analysis.materials,
    isSmallBusiness: analysis.isSmallBusiness,
    isEthicalBrand: analysis.isEthicalBrand,
    hasCertifiedMaterials: analysis.hasCertifiedMaterials,
    functionalSynthetic: analysis.functionalSynthetic
  });
  const worse = verdictSeverity(resMax.verdict) >= verdictSeverity(resMin.verdict) ? resMax : resMin;
  const spansTiers = resMin.verdict !== resMax.verdict;
  return {
    verdict: worse.verdict,
    verdictReason: worse.verdictReason,
    verdictSpanNote: spansTiers ? "Markup range spans two categories — verdict reflects worst case." : null
  };
}

/**
 * Verdict tier from markup bands only (Retail Trap = “Not worth it” in product copy).
 * Baseline: Worth It &lt; 500%, Think Twice 500–1000%, Retail Trap &gt; 1000%.
 * Leniency widens both ceilings together: +100 for indie/ethical, +50 for certified materials.
 * functionalSynthetic affects reason wording only, never thresholds.
 */
export function computeVerdict(analysis: {
  markup: number;
  materials: { fiber: string; percentage: number }[];
  isSmallBusiness?: boolean;
  isEthicalBrand?: boolean;
  hasCertifiedMaterials?: boolean;
  functionalSynthetic?: boolean;
}): { verdict: VerdictTier; verdictReason: string } {
  const {
    markup,
    materials,
    isSmallBusiness = false,
    isEthicalBrand = false,
    hasCertifiedMaterials = false,
    functionalSynthetic = false
  } = analysis;

  const leniency = markupLeniencyPct({ isSmallBusiness, isEthicalBrand, hasCertifiedMaterials });
  const worthItCeil = 500 + leniency;
  const thinkTwiceCeil = 1000 + leniency;

  const { naturalPct, syntheticPct } = getFiberBreakdown(materials);
  const naturalForward = naturalPct >= PREDOMINANT;
  const syntheticHeavy = syntheticPct >= PREDOMINANT;

  if (markup > 1500) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "Markup over 1,500% — an extreme multiple on estimated materials regardless of fiber mix or brand story."
    };
  }

  if (markup < worthItCeil) {
    if (leniency === 0) {
      return {
        verdict: "Worth It",
        verdictReason: "Markup under 500% — strong value relative to estimated materials."
      };
    }
    const bits: string[] = [];
    if (isEthicalBrand || isSmallBusiness) bits.push("independent or known ethical brand");
    if (hasCertifiedMaterials) bits.push("certified materials");
    return {
      verdict: "Worth It",
      verdictReason: `Markup under ${worthItCeil}% — within the fair-value band given ${bits.join(" and ")}.`
    };
  }

  if (markup <= thinkTwiceCeil) {
    const fiberTail =
      functionalSynthetic || !naturalForward
        ? ""
        : " Natural or cellulosic-forward fibers help, but the multiple is still high.";
    const syntheticTail =
      functionalSynthetic || !syntheticHeavy || naturalForward
        ? ""
        : " Mostly petroleum-based synthetics — the bill of materials still does not justify this multiple.";
    const base =
      leniency > 0
        ? `Markup between ${worthItCeil}% and ${thinkTwiceCeil}% — a steep multiple; brand or certification context keeps this in “consider carefully” territory rather than an automatic trap.`
        : "Markup between 500% and 1,000% — a steep multiple versus estimated materials; weigh brand, construction, and how much you’ll wear it.";
    return {
      verdict: "Think Twice",
      verdictReason: base + fiberTail + syntheticTail
    };
  }

  const syntheticTail =
    functionalSynthetic || !syntheticHeavy
      ? ""
      : " Predominantly petroleum-based synthetics add little materials-side justification.";
  const base =
    leniency > 0
      ? `Markup over ${thinkTwiceCeil}% — beyond the adjusted fair-value band for this scan.`
      : "Markup over 1,000% versus estimated materials — the price is hard to justify on bill-of-materials value alone.";
  return {
    verdict: "Retail Trap",
    verdictReason: base + syntheticTail
  };
}
