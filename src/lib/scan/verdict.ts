/**
 * Three-tier verdict: Worth It (teal) | Think Twice (amber) | Retail Trap (red).
 * Rules apply deterministic overrides from markup, fibers, and brand context.
 */

import type { VerdictTier } from "./types";

export type { VerdictTier } from "./types";

const PREMIUM_NATURAL = ["modal", "cashmere", "silk", "merino", "linen", "lyocell", "tencel"];
const STANDARD_NATURAL = ["cotton", "wool", "hemp"];
/** These fibers are always synthetic; never classify as natural. */
const SYNTHETIC = [
  "polyurethane",
  "polyester",
  "nylon",
  "polyamide",
  "acrylic",
  "spandex",
  "elastane",
  "lycra",
  "gore-tex",
  "viscose",
  "rayon"
];

function normalizeFiber(fiber: string): string {
  return fiber.toLowerCase().trim();
}

function categoryForFiber(fiber: string): "premium" | "standard" | "synthetic" | "other" {
  const n = normalizeFiber(fiber);
  if (PREMIUM_NATURAL.some((p) => n.includes(p))) return "premium";
  if (STANDARD_NATURAL.some((s) => n.includes(s))) return "standard";
  if (SYNTHETIC.some((s) => n.includes(s))) return "synthetic";
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

/** Compute verdict from markup range: use worst-case (markupMax). If min and max fall in different tiers, return the worse verdict and a span note. */
export function computeVerdictFromRange(analysis: {
  markupMin: number;
  markupMax: number;
  materials: { fiber: string; percentage: number }[];
  isSmallBusiness?: boolean;
  isEthicalBrand?: boolean;
  costPerWear?: number;
  functionalSynthetic?: boolean;
}): { verdict: VerdictTier; verdictReason: string; verdictSpanNote: string | null } {
  const resMin = computeVerdict({
    markup: analysis.markupMin,
    materials: analysis.materials,
    isSmallBusiness: analysis.isSmallBusiness,
    isEthicalBrand: analysis.isEthicalBrand,
    costPerWear: analysis.costPerWear,
    functionalSynthetic: analysis.functionalSynthetic
  });
  const resMax = computeVerdict({
    markup: analysis.markupMax,
    materials: analysis.materials,
    isSmallBusiness: analysis.isSmallBusiness,
    isEthicalBrand: analysis.isEthicalBrand,
    costPerWear: analysis.costPerWear,
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

export function computeVerdict(analysis: {
  markup: number;
  materials: { fiber: string; percentage: number }[];
  isSmallBusiness?: boolean;
  isEthicalBrand?: boolean;
  costPerWear?: number;
  functionalSynthetic?: boolean;
}): { verdict: VerdictTier; verdictReason: string } {
  const {
    markup,
    materials,
    isSmallBusiness = false,
    isEthicalBrand = false,
    costPerWear = 0,
    functionalSynthetic = false
  } = analysis;
  const { premiumNaturalPct, naturalPct, syntheticPct } = getFiberBreakdown(materials);
  const predominantlyPremiumNatural = premiumNaturalPct >= PREDOMINANT;
  const predominantlyNatural = naturalPct >= PREDOMINANT;
  const syntheticHeavy = syntheticPct >= PREDOMINANT;
  const penalizeSynthetic = syntheticHeavy && !functionalSynthetic;
  const indieOrEthical = isSmallBusiness || isEthicalBrand;

  // ——— Always Retail Trap (no override) ———
  if (markup > 1300) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "Markup over 1,300% — we can’t justify this premium regardless of materials or brand."
    };
  }
  if (penalizeSynthetic && markup > 600 && !indieOrEthical) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "Steep markup on predominantly synthetic materials with no small-brand or quality-fiber justification."
    };
  }

  // ——— Worth It (teal) ———
  if (markup < 300) {
    return {
      verdict: "Worth It",
      verdictReason: "Markup under 300% — fair value for what you’re getting."
    };
  }
  if (markup < 600 && predominantlyPremiumNatural) {
    return {
      verdict: "Worth It",
      verdictReason:
        "Markup under 600% with predominantly premium natural fibers — the price reflects better materials."
    };
  }
  if (markup < 400 && isSmallBusiness && predominantlyNatural) {
    return {
      verdict: "Worth It",
      verdictReason:
        "Independent brand with quality natural fibers and modest markup — reasonable for small-batch production."
    };
  }
  if (markup < 400 && isEthicalBrand && predominantlyNatural) {
    return {
      verdict: "Worth It",
      verdictReason:
        "Known sustainable brand with quality natural fibers and modest markup — the price reflects their sustainability and ethics."
    };
  }

  // ——— Think Twice (amber): low cost per wear ———
  if (costPerWear > 0 && costPerWear < 2) {
    return {
      verdict: "Think Twice",
      verdictReason: `Markup is high but cost per wear is under $2 — you’re paying more upfront for something you’ll wear often.`
    };
  }

  // ——— Think Twice: 300–800% with quality natural ———
  if (markup >= 300 && markup <= 800 && predominantlyNatural) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Markup in the 300–800% range with predominantly natural fibers — consider whether the quality and ethics justify the premium."
    };
  }

  // ——— Override UP to Think Twice: indie + natural, markup up to 1,300% ———
  if (isSmallBusiness && predominantlyNatural && markup <= 1300) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Independent brand with natural fibers — markup is high but partially justified by small-batch production and material quality."
    };
  }
  // ——— Override UP to Think Twice: known ethical/sustainable brand + natural, markup up to 1,300% ———
  if (isEthicalBrand && predominantlyNatural && markup <= 1300) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Known sustainable brand with natural fibers — markup is high but partially justified by the brand’s sustainability reputation and ethics."
    };
  }

  // ——— Override UP to Think Twice: premium natural, markup up to 1,200% ———
  if (predominantlyPremiumNatural && markup <= 1200) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Predominantly premium natural fibers — markup is high but materials partly justify the price."
    };
  }

  // ——— Default: Retail Trap ———
  if (penalizeSynthetic && markup > 600) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "High markup on predominantly synthetic materials — you’re paying a premium without the fiber quality to back it up."
    };
  }
  return {
    verdict: "Retail Trap",
    verdictReason: "Markup is high relative to estimated material cost with limited mitigating factors."
  };
}
