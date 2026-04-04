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
  const predominantlyPremium = premiumNaturalPct >= PREDOMINANT;
  const predominantlyNaturalOrCellulosic = naturalPct >= PREDOMINANT;
  const syntheticHeavy = syntheticPct >= PREDOMINANT;
  const penalizeSynthetic = syntheticHeavy && !functionalSynthetic;
  const indieOrEthical = isSmallBusiness || isEthicalBrand;

  if (markup > 1500) {
    return {
      verdict: "Retail Trap",
      verdictReason: "Markup over 1,500% — we can’t justify this premium regardless of materials or brand."
    };
  }

  if (markup < 500) {
    return {
      verdict: "Worth It",
      verdictReason: "Markup under 500% — strong value relative to estimated materials."
    };
  }

  if (markup < 700 && predominantlyPremium) {
    return {
      verdict: "Worth It",
      verdictReason:
        "Markup under 700% with predominantly premium natural or certified cellulosic fibers — materials support the price."
    };
  }

  if (markup < 600 && indieOrEthical) {
    return {
      verdict: "Worth It",
      verdictReason:
        "Markup under 600% for an independent or known ethical brand — sustainability and small-batch context partially justify the premium."
    };
  }

  if (costPerWear > 0 && costPerWear < 2) {
    return {
      verdict: "Think Twice",
      verdictReason: `Markup is high but cost per wear is under $2 — you’re paying more upfront for something you’ll wear often.`
    };
  }

  if (penalizeSynthetic && markup > 1000 && !indieOrEthical) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "Markup over 1,000% on predominantly petroleum-based synthetics with no strong brand or fiber-quality justification."
    };
  }

  if (indieOrEthical && predominantlyNaturalOrCellulosic && markup <= 1500) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Independent or ethical brand with natural or cellulosic-forward composition — markup is high but partially justified."
    };
  }

  if (markup >= 500 && markup <= 1000) {
    if (predominantlyNaturalOrCellulosic) {
      return {
        verdict: "Think Twice",
        verdictReason:
          "Markup between 500% and 1,000% with natural or cellulosic fibers — weigh fiber quality and use against the price."
      };
    }
    return {
      verdict: "Think Twice",
      verdictReason:
        "Markup between 500% and 1,000% — consider whether construction, brand, and fibers justify the premium."
    };
  }

  if (markup > 1000 && markup <= 1500 && predominantlyPremium) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "Markup over 1,000% but premium natural or cellulosic fibers offer partial justification — not an automatic trap."
    };
  }

  if (markup > 1000 && predominantlyNaturalOrCellulosic && !syntheticHeavy) {
    return {
      verdict: "Think Twice",
      verdictReason:
        "High markup with mostly natural or cellulosic (non-petroleum) fibers — quality helps, but the multiple is still steep."
    };
  }

  if (penalizeSynthetic && markup > 600) {
    return {
      verdict: "Retail Trap",
      verdictReason:
        "High markup on predominantly petroleum-based synthetics — you’re paying a premium without the fiber quality to back it up."
    };
  }

  return {
    verdict: "Retail Trap",
    verdictReason: "Markup is high relative to estimated material cost with limited mitigating factors."
  };
}
