import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis, MinimalScanResponse, ValuesMatchEntry, ValuesMatchState } from "./types";
import { computeVerdict, computeVerdictFromRange, parseFibersToMaterials } from "./verdict";

const CLAUDE_TIMEOUT_MS = 45000;

const MATERIAL_COST_RULES = `
Material cost estimation: Use these fabric costs per yard (USD): Basic cotton $2–4, Premium cotton (combed, pima) $5–9. Polyester $1–3, Nylon $3–6. Basic linen $5–8, Premium linen $9–15. Viscose/Rayon $2–5, Modal $6–10, Lyocell/Tencel $7–12. Acrylic $1–3. Basic wool $8–15, Merino wool $15–30, Cashmere $50–100, Silk $20–40.
Yardage by category: T-shirt 1.5–2, Dress (simple) 2.5–3.5, Blazer/Jacket 2.5–3.5 plus lining, Trousers/Pants 2–3, Skirt (midi) 2–3, Outerwear coat 3.5–5.
Add 15–25% for thread, labels, packaging, trimmings. Add 30–50% for labor on top of materials.
Certified/recycled material premiums (apply when detected in product description, composition notes, or known brand context): recycled polyester 1.4x base polyester cost; REPREVE or OceanCycle recycled polyester 1.8x base polyester cost; recycled nylon 1.5x base nylon cost; GOTS certified organic cotton 1.6x base cotton cost; Bluesign-certified materials 1.3x relevant base cost. Fair Trade certified manufacturing adds an additional $8–$15 to total estimated production cost regardless of fiber type.
**Cellulose acetate / acetate (fiber classification):** Wood-pulp-derived **cellulosic / semi-natural** — **not** a petroleum synthetic. Use a **baseline cellulose acetate** fabric cost of **~$4–6/yard** (USD) for generic acetate / cellulose acetate / triacetate when estimating materials (do not price like polyester).
**Naia (Eastman):** Premium cellulose acetate from sustainably sourced wood pulp — **1.6×** the baseline cellulose acetate yard cost. Treat as **natural/cellulosic** in quality weighting; **never** as plastic or petroleum-based synthetic; do **not** flag as synthetic.
**Naia Renew:** Premium certified sustainable cellulosic — **60%** sustainably sourced wood pulp, **40%** GRS-certified recycled content; OEKO-TEX Class I; biodegradable and compostable; TUV Austria certified — **1.9×** the baseline cellulose acetate yard cost. Set **hasCertifiedMaterials: true** and include **"Naia Renew"** in the **certifications** array (and **"OEKO-TEX"** when the label or context states it). **Never** classify as synthetic or frame as petroleum-based / plastic; do **not** penalize “synthetic %” for this fiber — it is cellulosic.
When certified/recycled materials are detected, set hasCertifiedMaterials: true, return certifications as an array of strings (e.g. ["REPREVE", "OceanCycle", "Fair Trade", "Naia Renew", "OEKO-TEX"]), and acknowledge this context in verdictReason.
Return estimatedMaterialCostMin and estimatedMaterialCostMax (USD): total cost to produce including materials and basic labor. The range should reflect genuine uncertainty — typically ±30–40% around the midpoint for standard garments, wider for complex construction or specialty fibers.
markupMin = (price / costMax - 1) * 100, markupMax = (price / costMin - 1) * 100 (so markupMin is the conservative/low markup, markupMax is the high markup).
`;

const MINIMAL_SCAN_SYSTEM_PROMPT = `You are a material intelligence analyst for clothing and apparel. You will receive JSON input with: brandName, fibers (array of strings, e.g. "Cotton 100%" or "Polyester 80%, Elastane 20%"), price (retail price in USD), and confidenceTier (number).

Apply these rules:
- Small/indie brand: if brandName suggests an independent or small brand (not a major retailer or fast-fashion chain), set isSmallBusiness: true; higher markups are normal for small-business sustainability.
- Fiber quality: premium natural (cashmere, silk, merino wool, modal, linen, lyocell/Tencel, **Naia**, **Naia Renew**) > standard / semi-natural cellulosic (cotton, wool, hemp, **cellulose acetate**, **acetate**, **triacetate**) > petroleum synthetics. **Acetate / cellulose acetate / triacetate** are cellulosic (wood pulp), not synthetics. **Naia:** premium cellulosic (Eastman), not plastic — use 1.6× baseline acetate cost. **Naia Renew:** set hasCertifiedMaterials true, certifications includes "Naia Renew"; 1.9× baseline acetate cost; never synthetic. **Synthetics (never tag as natural):** polyurethane, polyester, nylon, acrylic, spandex, elastane, lycra, Gore-Tex, viscose, rayon. Favor verdict for premium-natural or premium-cellulosic-heavy garments.
- verdictReason must include context (e.g. small-brand markup vs fast-fashion synthetic). Verdict stays "Retail Trap" or "Worth It".
- markupContext: exactly one of "justified" | "partially justified" | "unjustified" based on fiber quality and small-business context.
- functionalSynthetic: true when garment category makes synthetics appropriate (rainwear, activewear, swimwear, lingerie, hosiery, tights); false for formal/everyday/casual.
- isEthicalBrand: true when brand is a known ethical/sustainable brand (Patagonia, Eileen Fisher, Reformation, Kotn, Pact, Thought Clothing, Amour Vert, Girlfriend Collective, Whimsy and Row, Colorful Standard, Organic Basics, tentree, prAna, Stella McCartney, Veja, Allbirds, Mara Hoffman). Apply same higher markup threshold as indie brands; verdictReason should acknowledge sustainability reputation and supply-chain transparency.
${MATERIAL_COST_RULES}

Respond with only valid JSON and nothing else. No markdown, no code fence, no explanation. The JSON must have exactly these fields:
- estimatedMaterialCostMin (number, USD)
- estimatedMaterialCostMax (number, USD)
- markupMin (number, percentage — from costMax/price: (price/costMax - 1)*100)
- markupMax (number, percentage — from costMin/price: (price/costMin - 1)*100)
- markupBand (string: "low", "medium", or "high" based on midpoint of markup range)
- verdict (string: ignored — we compute verdict from markup and fibers)
- verdictReason (string: one sentence with context)
- tags (array of strings)
- isEstimated (boolean)
- isSmallBusiness (boolean, infer from brand if possible)
- markupContext (string: "justified" | "partially justified" | "unjustified")
- functionalSynthetic (boolean)
- isEthicalBrand (boolean)
- hasCertifiedMaterials (boolean)
- certifications (array of strings)`;

const VALUES_EVALUATION_RULES = `
**Values evaluation (only for values in the selectedValues array)**
For each value in selectedValues, evaluate the product and return exactly one of: pass, fail, or unverified. Use a short note (one phrase) explaining why.

- **Natural fibers only**: pass = 100% natural fibers; fail = any synthetic content; unverified = never (fiber data is always available).
- **No virgin plastic**: pass = no polyester, nylon, or acrylic present; fail = any of those present; unverified = never.
- **Cost-per-wear thinker**: pass = cost per wear under $2.00; fail = cost per wear over $5.00; unverified = if price was not available.
- **Avoid fast fashion**: pass = brand is not a known fast fashion retailer; fail = brand is a known fast fashion retailer (Shein, Zara, H&M, Primark, Fashion Nova, Boohoo, PrettyLittleThing, ASOS own brand); unverified = brand unknown or ambiguous.
- **No animal products**: pass = no wool, silk, cashmere, leather, fur, down; fail = any animal-derived fiber present; unverified = never.
- **Fair labor**: pass = brand has known fair labor certification (Fair Trade, B Corp, SA8000); fail = brand has known labor violations on record; unverified = most cases — be honest that this cannot be confirmed from label data alone.
- **Made in USA**: pass = country of manufacture confirmed USA; fail = country confirmed not USA; unverified = country not available.
- **Secondhand first**: always return unverified with note: "Check secondhand options in Buffi Pro".
- **Capsule wardrobe**: pass = natural fibers, neutral category, versatile construction; fail = very trend-specific or low durability; unverified = insufficient data.
- **Certified sustainable**: pass = known certification in product data (GOTS, OEKO-TEX, Bluesign, B Corp, **Naia Renew** with stated OEKO-TEX / GRS / TUV Austria context); fail = no certification and brand is known fast fashion; unverified = most cases.
- **Union-made**: pass = union-made indicated; fail = known non-union; unverified = most cases.
`;

export async function analyzeWithClaude(raw: RawProductData, selectedValues: string[] = []): Promise<ScanAnalysis> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const isTagSource = raw.source === "tag";
  const hasPrice = typeof raw.price === "number" && raw.price > 0;
  const hasBrand = !!raw.brand?.trim();
  const runFullAnalysis = isTagSource ? hasPrice : true;

  const prompt = `You are a material intelligence analyst for clothing and apparel. Given the following raw product data, produce a structured analysis.

Raw product data:
${JSON.stringify(raw, null, 2)}
${selectedValues.length > 0 ? `\nUser selected values to evaluate (return one entry per value in valuesMatch):\n${JSON.stringify(selectedValues)}\n${VALUES_EVALUATION_RULES}` : ""}

${
  isTagSource && !runFullAnalysis
    ? `This is a TAG/CARE-LABEL input: we have composition (materials) but NO retail price. Do a PARTIAL analysis:
- Focus on material quality only: parse materials from the composition text, estimate material cost, and give a verdict based purely on whether the materials are good value for typical apparel (synthetic-heavy vs natural, durability, etc.).
- Set markup to 0 and costPerWear to 0 (markup analysis requires a price).
- Include in tags: "Partial analysis", "Markup requires price". If brand was not provided, also add "Brand unknown".
- Set isSmallBusiness and markupContext using the rules below where applicable.`
    : isTagSource
      ? `This is a TAG/CARE-LABEL input with composition and optional brand/price. If brand or price was not provided, still produce a full analysis using what you have, and add to tags any missing data (e.g. "Brand unknown" or "Price estimated") so the user knows the confidence level. Apply the small-brand, fiber-quality, and markup-context rules below.`
      : `If the raw data is sparse, make reasonable inferences for clothing/apparel. Apply the rules below.`
}

**Small / indie brand detection**
- If the brand appears to be an independent or small brand (not a major retailer or fast-fashion chain), treat higher markups as normal and necessary for small-business sustainability. Set isSmallBusiness: true in that case.
- Major retailers and fast-fashion chains: set isSmallBusiness: false.

**Known ethical/sustainable brands**
These brands have a strong sustainability/ethics reputation; higher markup is expected and partially justified. Set isEthicalBrand: true when the brand is one of: Patagonia, Eileen Fisher, Reformation, Kotn, Pact, Thought Clothing, Amour Vert, Girlfriend Collective, Whimsy and Row, Colorful Standard, Organic Basics, tentree, prAna, Stella McCartney, Veja, Allbirds, Mara Hoffman (or the same company under another name). For these brands: note the brand's sustainability reputation and supply-chain transparency in verdictReason; apply the same higher markup threshold as indie brands before Retail Trap; return isEthicalBrand: true in the JSON response.

**Fiber quality weighting (for verdict and verdictReason)**
Not all natural fibers are equal. Classify carefully:

**Cellulosic acetates (not petroleum synthetics)**  
**Cellulose acetate**, **acetate**, and **triacetate** are **semi-natural / cellulosic** (derived from wood pulp, not petroleum). Do **not** describe them as plastic or petroleum-based synthetics; do **not** use “synthetic-heavy” framing for blends dominated by these fibers.

**Naia (Eastman)**  
Premium cellulose acetate from sustainably sourced wood pulp. Treat as **natural/cellulosic**, **premium** tier for quality weighting. **Do not** flag as plastic or petroleum synthetic. Apply **1.6×** baseline cellulose acetate yard cost (see material cost rules).

**Naia Renew**  
Premium certified sustainable cellulosic: **60%** sustainably sourced wood pulp, **40%** GRS-certified recycled; OEKO-TEX Class I; biodegradable, compostable; TUV Austria certified. Apply **1.9×** baseline cellulose acetate yard cost. Set **hasCertifiedMaterials: true** and include **"Naia Renew"** in **certifications** when present (add **"OEKO-TEX"** when stated on label or copy). **Never** classify as synthetic or count toward negative “synthetic %” messaging — it is cellulosic.

**Premium natural / premium cellulosic:** cashmere, silk, merino wool, modal, linen, lyocell/Tencel, **Naia**, **Naia Renew**.

**Standard natural / semi-natural cellulosic:** cotton, wool, hemp; generic **cellulose acetate**, **acetate**, **triacetate** (without Naia branding).

**Synthetic (petroleum-based; must never be tagged as natural):** polyurethane, polyester, nylon, acrylic, spandex, elastane, lycra, Gore-Tex, viscose, rayon.

A garment that is predominantly premium natural or premium cellulosic fibers should receive a more favorable verdict than the same markup on petroleum synthetics.

**Functional synthetic (garment category)**
Synthetic fibers that are appropriate or necessary for the garment type should not be penalized. Set functionalSynthetic: true when synthetics are expected for the category; set false when synthetics are a quality compromise.
- Rain jackets, waterproof outerwear, windbreakers: nylon, polyester, polyurethane are expected and appropriate — do not penalize. High synthetic % is normal. Evaluate verdict primarily on markup and brand context only.
- Activewear, swimwear, athletic wear: nylon, polyester, spandex/elastane are functional requirements — do not penalize synthetic content.
- Lingerie, hosiery, tights: nylon is standard and appropriate — do not penalize.
- Formal wear, everyday clothing, casualwear: apply normal fiber quality weighting; natural fibers preferred, synthetics penalized.
When functionalSynthetic is true: do not factor synthetic % into verdict; base verdict on markup range and brand context only. In verdictReason acknowledge: "Synthetic materials are appropriate for this garment type."

**Verdict nuancing**
- Verdict label stays exactly "Retail Trap" or "Worth It".
- verdictReason MUST include context. For small brands with quality fibers, acknowledge both the markup and mitigating factors.
  Example (small brand + quality fibers): "Independent brand markup — quality cotton-modal blend partially justifies the price. You are paying a premium for small-batch production."
  Example (fast fashion synthetic): "Steep markup on low-quality synthetic materials with no justification beyond brand recognition."
- Add a new field markupContext — exactly one of: "justified" | "partially justified" | "unjustified". Use it to reflect whether the markup is justified by fiber quality, small-business context, or neither.

**Material cost estimation (use these figures when calculating estimatedMaterialCost)**
Fabric cost per yard (USD):
- Basic cotton: $2–4/yard. Premium cotton (combed, pima): $5–9/yard.
- Polyester: $1–3/yard. Nylon: $3–6/yard.
- Basic linen: $5–8/yard. Premium linen: $9–15/yard.
- Viscose/Rayon: $2–5/yard. Modal: $6–10/yard. Lyocell/Tencel: $7–12/yard.
- Cellulose acetate / generic acetate / triacetate: $4–6/yard baseline (cellulosic, not polyester); Naia ≈ 1.6× that baseline; Naia Renew ≈ 1.9× that baseline.
- Acrylic: $1–3/yard.
- Basic wool: $8–15/yard. Merino wool: $15–30/yard. Cashmere: $50–100/yard. Silk: $20–40/yard.
- Elastane/spandex: treat as a small blend share; use blended yard cost for the main fabric and add a small amount for stretch content.

Fabric usage by garment category (approximate yards):
- T-shirt: 1.5–2 yards. Dress (simple): 2.5–3.5 yards. Blazer/Jacket: 2.5–3.5 yards plus lining. Trousers/Pants: 2–3 yards. Skirt (midi): 2–3 yards. Outerwear coat: 3.5–5 yards.
Infer category from product name/description when possible; otherwise use a reasonable default (e.g. top 1.5–2, bottom 2–2.5, dress 2.5–3).

On top of fabric cost:
- Add 15–25% for thread, labels, packaging, and basic trimmings.
- Add 30–50% for labor cost on top of materials (manufacturing in standard production countries).
Return a range for total cost to produce (fabric + trimmings + labor), in USD. The range should reflect genuine uncertainty — typically ±30–40% around the midpoint for standard garments, wider for complex construction or specialty fibers.
- estimatedMaterialCostMin, estimatedMaterialCostMax (numbers, USD).
- markupMin = (price / estimatedMaterialCostMax - 1) * 100, markupMax = (price / estimatedMaterialCostMin - 1) * 100 (use 0 for both if no price).

Return a JSON object with exactly these fields (no other fields, no markdown, no explanation):
- brand (string, use provided brand or "Unknown" if missing)
- name (string, use product name or a short description from materials if missing)
- price (number; use provided price, or 0 if not provided)
- materials (array of objects: { fiber: string, percentage: number }; ensure percentages sum to 100)
- estimatedMaterialCostMin (number, USD)
- estimatedMaterialCostMax (number, USD)
- markupMin (number, percentage — from costMax/price; use 0 if no price)
- markupMax (number, percentage — from costMin/price; use 0 if no price)
- costPerWear (number, estimated; use 0 if no price)
- verdict (string: any — we overwrite with computed three-tier verdict)
- verdictReason (string, one sentence with context as above)
- tags (array of strings, e.g. "Synthetic Heavy", "High Markup", "Fast Fashion", "Natural Fibers", "Fair Value", "Small Brand"; include confidence flags when relevant)
- isSmallBusiness (boolean: true if independent/small brand, false if major retailer or fast fashion)
- markupContext (string: exactly "justified" | "partially justified" | "unjustified")
- functionalSynthetic (boolean: true if synthetic fibers are appropriate for the garment category, false if synthetics are a quality compromise)
- isEthicalBrand (boolean: true if brand is a known ethical/sustainable brand from the list above — Patagonia, Eileen Fisher, Reformation, Kotn, Pact, Thought Clothing, Amour Vert, Girlfriend Collective, Whimsy and Row, Colorful Standard, Organic Basics, tentree, prAna, Stella McCartney, Veja, Allbirds, Mara Hoffman)
- hasCertifiedMaterials (boolean: true when recycled/certified materials or certifications are detected from product text, composition notes, or known brand context)
- certifications (array of strings: include detected labels, e.g. "REPREVE", "OceanCycle", "GOTS", "Fair Trade", "Bluesign", "Naia Renew", "OEKO-TEX"; empty array if none)${selectedValues.length > 0 ? `
- valuesMatch (array of objects, one per value in selectedValues: { value: string (the value label), state: "pass" | "fail" | "unverified", note: string (one short phrase) })` : ""}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text = (message.content as Array<{ type?: string; text?: string }>)
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("") || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    const parsed = JSON.parse(jsonMatch[0]) as ScanAnalysis;
    const pre = parsed as unknown as Record<string, unknown>;

    // Validate required fields (verdict/verdictReason are overwritten by computeVerdictFromRange)
    const validMarkupContext = ["justified", "partially justified", "unjustified"] as const;
    if (
      typeof parsed.brand !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.price !== "number" ||
      !Array.isArray(parsed.materials) ||
      typeof pre.estimatedMaterialCostMin !== "number" ||
      typeof pre.estimatedMaterialCostMax !== "number" ||
      typeof pre.markupMin !== "number" ||
      typeof pre.markupMax !== "number" ||
      typeof parsed.costPerWear !== "number" ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags) ||
      !validMarkupContext.includes(parsed.markupContext as (typeof validMarkupContext)[number])
    ) {
      throw new Error("Invalid Claude response structure");
    }
    const costMin = pre.estimatedMaterialCostMin as number;
    const costMax = pre.estimatedMaterialCostMax as number;
    let markupMin = pre.markupMin as number;
    let markupMax = pre.markupMax as number;
    if (parsed.price > 0 && costMax > 0 && costMin > 0) {
      markupMin = (parsed.price / costMax - 1) * 100;
      markupMax = (parsed.price / costMin - 1) * 100;
    }
    parsed.estimatedMaterialCostMin = costMin;
    parsed.estimatedMaterialCostMax = costMax;
    parsed.markupMin = markupMin;
    parsed.markupMax = markupMax;
    if (parsed.isSmallBusiness === undefined) parsed.isSmallBusiness = false;

    const validState: ValuesMatchState[] = ["pass", "fail", "unverified"];
    if (selectedValues.length > 0 && Array.isArray(parsed.valuesMatch)) {
      parsed.valuesMatch = (parsed.valuesMatch as ValuesMatchEntry[]).filter(
        (e) =>
          typeof e?.value === "string" &&
          typeof e?.note === "string" &&
          validState.includes(e.state as ValuesMatchState)
      ) as ValuesMatchEntry[];
    } else {
      parsed.valuesMatch = [];
    }

    parsed.functionalSynthetic =
      typeof pre.functionalSynthetic === "boolean" ? pre.functionalSynthetic : false;
    parsed.isEthicalBrand =
      typeof pre.isEthicalBrand === "boolean" ? (pre.isEthicalBrand as boolean) : false;
    parsed.hasCertifiedMaterials =
      typeof pre.hasCertifiedMaterials === "boolean"
        ? (pre.hasCertifiedMaterials as boolean)
        : false;
    parsed.certifications = Array.isArray(pre.certifications)
      ? (pre.certifications as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [];

    const { verdict, verdictReason, verdictSpanNote } = computeVerdictFromRange({
      markupMin: parsed.markupMin,
      markupMax: parsed.markupMax,
      materials: parsed.materials,
      isSmallBusiness: parsed.isSmallBusiness,
      isEthicalBrand: parsed.isEthicalBrand,
      costPerWear: parsed.costPerWear,
      functionalSynthetic: parsed.functionalSynthetic
    });
    parsed.verdict = verdict;
    parsed.verdictReason =
      parsed.functionalSynthetic && !verdictReason.includes("appropriate for this garment type")
        ? `${verdictReason} Synthetic materials are appropriate for this garment type.`
        : verdictReason;
    if (parsed.hasCertifiedMaterials && (parsed.certifications?.length ?? 0) > 0) {
      const certText = parsed.certifications!.slice(0, 3).join(", ");
      if (!parsed.verdictReason.toLowerCase().includes("certif")) {
        parsed.verdictReason = `${parsed.verdictReason} Certified materials (${certText}) are factored into this assessment.`;
      }
    }
    parsed.verdictSpanNote = verdictSpanNote ?? undefined;
    parsed.markupContext =
      verdict === "Worth It" ? "justified" : verdict === "Think Twice" ? "partially justified" : "unjustified";

    return parsed;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new Error("Claude API timeout") as Error & { code?: string };
      timeoutErr.code = "claude_timeout";
      throw timeoutErr;
    }
    throw err;
  }
}

/** Minimal scan: brandName + fibers + price + confidenceTier → Claude Sonnet 4.5 → structured JSON response. */
export async function analyzeMinimalScan(input: {
  brandName: string;
  fibers: string[];
  price: number;
  confidenceTier: number;
}): Promise<MinimalScanResponse> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: MINIMAL_SCAN_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              brandName: input.brandName,
              fibers: input.fibers,
              price: input.price,
              confidenceTier: input.confidenceTier
            })
          }
        ]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text = (message.content as Array<{ type?: string; text?: string }>)
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("")
      .trim() || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    const parsed = JSON.parse(jsonMatch[0]) as MinimalScanResponse;
    const preM = parsed as unknown as Record<string, unknown>;

    const validMarkupContext = ["justified", "partially justified", "unjustified"] as const;
    if (
      typeof parsed.estimatedMaterialCostMin !== "number" ||
      typeof parsed.estimatedMaterialCostMax !== "number" ||
      typeof parsed.markupMin !== "number" ||
      typeof parsed.markupMax !== "number" ||
      typeof parsed.markupBand !== "string" ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags) ||
      typeof parsed.isEstimated !== "boolean" ||
      typeof parsed.isSmallBusiness !== "boolean" ||
      !validMarkupContext.includes(parsed.markupContext as (typeof validMarkupContext)[number])
    ) {
      throw new Error("Invalid minimal scan response structure");
    }

    let { markupMin, markupMax } = parsed;
    if (input.price > 0 && parsed.estimatedMaterialCostMax > 0 && parsed.estimatedMaterialCostMin > 0) {
      markupMin = (input.price / parsed.estimatedMaterialCostMax - 1) * 100;
      markupMax = (input.price / parsed.estimatedMaterialCostMin - 1) * 100;
      parsed.markupMin = markupMin;
      parsed.markupMax = markupMax;
    }

    parsed.functionalSynthetic =
      typeof preM.functionalSynthetic === "boolean" ? (preM.functionalSynthetic as boolean) : false;
    parsed.isEthicalBrand =
      typeof preM.isEthicalBrand === "boolean" ? (preM.isEthicalBrand as boolean) : false;
    parsed.hasCertifiedMaterials =
      typeof preM.hasCertifiedMaterials === "boolean"
        ? (preM.hasCertifiedMaterials as boolean)
        : false;
    parsed.certifications = Array.isArray(preM.certifications)
      ? (preM.certifications as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [];

    const materials = parseFibersToMaterials(input.fibers);
    const { verdict, verdictReason, verdictSpanNote } = computeVerdictFromRange({
      markupMin: parsed.markupMin,
      markupMax: parsed.markupMax,
      materials,
      isSmallBusiness: parsed.isSmallBusiness,
      isEthicalBrand: parsed.isEthicalBrand,
      costPerWear: 0,
      functionalSynthetic: parsed.functionalSynthetic
    });
    parsed.verdict = verdict;
    parsed.verdictReason =
      parsed.functionalSynthetic && !verdictReason.includes("appropriate for this garment type")
        ? `${verdictReason} Synthetic materials are appropriate for this garment type.`
        : verdictReason;
    if (parsed.hasCertifiedMaterials && (parsed.certifications?.length ?? 0) > 0) {
      const certText = parsed.certifications!.slice(0, 3).join(", ");
      if (!parsed.verdictReason.toLowerCase().includes("certif")) {
        parsed.verdictReason = `${parsed.verdictReason} Certified materials (${certText}) are factored into this assessment.`;
      }
    }
    parsed.verdictSpanNote = verdictSpanNote ?? undefined;
    parsed.markupContext =
      verdict === "Worth It" ? "justified" : verdict === "Think Twice" ? "partially justified" : "unjustified";

    return parsed;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new Error("Claude API timeout") as Error & { code?: string };
      timeoutErr.code = "claude_timeout";
      throw timeoutErr;
    }
    throw err;
  }
}
