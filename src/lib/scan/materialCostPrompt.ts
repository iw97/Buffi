/**
 * Single source for Claude material cost + fiber taxonomy (analyzeWithClaude + minimal scan).
 */

import { WORTH_IT_MARKUP_CEILING, THINK_TWICE_MARKUP_CEILING, ABSOLUTE_TRAP_CEILING } from "./verdict";

export const ETHICAL_BRANDS_CLAUSE =
  "Patagonia, Everlane, Reformation, Kotn, Eileen Fisher, Pact, Thought Clothing, Amour Vert, Girlfriend Collective, Mara Hoffman, Whimsy and Row, Colorful Standard, Organic Basics, tentree, prAna, Veja, Allbirds, Stella McCartney, People Tree, Nudie Jeans, Outerknown, Finisterre, Rapanui, Honest By (or the same company under another name)";

export const MATERIAL_COST_AND_TAXONOMY_PROMPT = `
**PART 1 — FIBER TAXONOMY (classify every fiber before cost or verdict logic)**

**NATURAL** (plants or animals, no petroleum): cotton, organic cotton, pima cotton, Egyptian cotton, linen, flax, silk, wool, merino wool, cashmere, angora, alpaca, hemp, ramie, jute, kapok.

**CELLULOSIC / SEMI-NATURAL** (wood pulp or plant cellulose — NOT petroleum, NOT “synthetic plastic” for % purposes): viscose, rayon, modal, lyocell, Tencel, cupro, acetate, cellulose acetate, triacetate, bamboo viscose, bamboo lyocell, bamboo rayon, Naia, Naia Renew, EcoVero, ECOVERO, Lenzing Modal, Lenzing Viscose.

**SYNTHETIC / PETROLEUM-BASED** (fossil fuels — count toward % synthetic / plastic): polyester, recycled polyester, REPREVE polyester, nylon, recycled nylon, acrylic, elastane, spandex, Lycra, polypropylene, polyurethane, PU, PVC, microfiber (when polyester-based).

**CRITICAL RULE:** Never count cellulosic fibers toward the % synthetic (plastic) metric. Only petroleum-based synthetics count as plastic. Example: 88% Naia Renew + 12% polyester = **12% synthetic**, not 100%.

**PART 2 — FIBER COST REFERENCE (USD per yard, 2025 ranges)**

NATURAL: Basic cotton $5–12; Organic cotton (GOTS) $12–15; Pima $8–15; Egyptian $15–25; Basic linen $12–25; Premium/European linen (Belgian, Irish) $25–60; Silk charmeuse $20–50; dupioni $30–40; crepe de chine $25–45; Basic wool $15–30; Merino $25–50; Cashmere $80–150; Alpaca $40–80; Hemp $15–25.

CELLULOSIC: Viscose/Rayon basic $8–16; premium $15–25; Modal standard $12–20; Lenzing-certified modal $15–25; Lyocell/Tencel $12–30; Acetate standard $12–25; Naia (Eastman) $18–30; Naia Renew $22–35; EcoVero $14–22; Cupro $15–28; Bamboo viscose $10–30; Triacetate $15–35.

SYNTHETIC: Basic polyester $3–10; Recycled polyester $5–12; REPREVE/OceanCycle certified recycled polyester $8–18; Basic nylon $5–15; Recycled nylon $8–18; Acrylic $4–15; Elastane/spandex as blend: add $2–5/yd to base fabric; Polyurethane coating: add $3–8/yd.

**CERTIFIED MATERIAL PREMIUMS** (add when present): GOTS +$1–3/yd; OEKO-TEX Standard 100 +$0.50–1.50/yd; Fair Trade manufacturing +$8–15 flat to total garment cost; GRS +$1–2/yd; Bluesign +$1–2/yd; B Corp brand → treat as ethical brand context.

**PART 3 — GARMENT YARDAGE**
T-shirt/tank 1.5–2 yd; Blouse/shirt 2–2.5; Dress simple/mini 2.5–3; Dress midi/maxi 3–4.5; Blazer/jacket 2.5–3.5 + lining 1.5–2 yd; Trousers 2–3; Jeans 2–2.5; Skirt mini 1.5–2, midi 2–3, maxi 2.5–4; Outerwear coat 3.5–5 + lining; Swimsuit/bikini 1–1.5; Activewear legging 1.5–2; Hoodie/sweatshirt 2.5–3.

Add **15–25%** for thread, labels, packaging, buttons, zippers, basic trimmings. Add **30–50% for labor** on top of materials (standard production countries).

Return **estimatedMaterialCostMin** and **estimatedMaterialCostMax** (USD) for fabric + trimmings + labor. **markupMin** = (price / costMax − 1) × 100, **markupMax** = (price / costMin − 1) × 100.

**PART 4 — CERTIFIED MATERIAL RECOGNITION**
When description or fiber name indicates these, set **hasCertifiedMaterials: true** and merge into **certifications** (dedupe):
- Naia Renew → include "Naia Renew", "OEKO-TEX Class 1", "GRS Certified", "Biodegradable" when context supports.
- REPREVE → "REPREVE", "GRS Certified"; OceanCycle → "OceanCycle"; Tencel/Lyocell → "Tencel"; EcoVero → "EcoVero", "Lenzing Certified"; GOTS → "GOTS Organic"; Fair Trade → "Fair Trade Certified"; B Corp brand → "B Corp"; Bluesign → "Bluesign".

**PART 5 — VERDICT THRESHOLDS (the app recomputes tier from markup; do not rely on fiber class for tier)**
- **Default bands:** **Worth It** = markup **under ${WORTH_IT_MARKUP_CEILING}%**; **Think Twice** = **${WORTH_IT_MARKUP_CEILING}–${THINK_TWICE_MARKUP_CEILING}%**; **Retail Trap** = **over ${THINK_TWICE_MARKUP_CEILING}%** (same bands for athletic synthetics — **functionalSynthetic** does not widen these in code).
- **Leniency (only these widen the ceilings):** **isEthicalBrand** or **isSmallBusiness** → more forgiving; **hasCertifiedMaterials** → slightly more forgiving. Nothing else (not functional synthetic, not “premium fiber” alone) changes markup thresholds in the app.
- **Over ${ABSOLUTE_TRAP_CEILING}%** markup stays **Retail Trap** in the app regardless of leniency.

**PART 6 — ETHICAL / SUSTAINABLE BRANDS**
Set **isEthicalBrand: true** when brand matches: ${ETHICAL_BRANDS_CLAUSE}. Acknowledge in **verdictReason**; the app applies Part 5 leniency only when this flag is true (or small-business), never from functional synthetic alone.
Known ethical brand note: Girlfriend Collective — RPET recycled polyester, SA8000 Fair Trade certified, transparent supply chain, recycled materials program (ReGirlfriend).
`.trim();
