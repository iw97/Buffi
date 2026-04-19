import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis, MinimalScanResponse, ValuesMatchEntry, ValuesMatchState } from "./types";
import { ETHICAL_BRANDS_CLAUSE, MATERIAL_COST_AND_TAXONOMY_PROMPT } from "./materialCostPrompt";
import { isZaraProductPageUrl } from "./zaraHints";
import { computeVerdict, computeVerdictFromRange, parseFibersToMaterials } from "./verdict";

const MATERIALS_NOT_DETECTED_TAG = "Materials not detected";

const CLAUDE_TIMEOUT_MS = 45000;
const ZARA_TITLE_COMPOSITION_TIMEOUT_MS = 15000;

const MINIMAL_SCAN_SYSTEM_PROMPT = `You are a material intelligence analyst for clothing and apparel. You will receive JSON input with: brandName, fibers (array of strings, e.g. "Cotton 100%" or "Polyester 80%, Elastane 20%"), price (retail price in USD), and confidenceTier (number).

Apply these rules:
- Small/indie brand: if brandName suggests an independent or small brand (not a major retailer or fast-fashion chain), set isSmallBusiness: true; higher markups are normal for small-business sustainability.
- Classify every fiber using **PART 1** taxonomy below. **Never** count cellulosic fibers (viscose, rayon, modal, Tencel, Naia, acetate, etc.) toward petroleum “synthetic %” / plastic framing — only Part 1 **SYNTHETIC / PETROLEUM-BASED** fibers count.
- verdictReason must include context (fiber class, markup, brand). Verdict label is advisory only (app uses three tiers: Worth It | Think Twice | Retail Trap).
- markupContext: exactly one of "justified" | "partially justified" | "unjustified" based on fiber quality and small-business context.
- functionalSynthetic: true when garment category makes synthetics appropriate (rainwear, activewear, swimwear, lingerie, hosiery, tights); false for formal/everyday/casual.
- isEthicalBrand: true when brand is a known ethical/sustainable brand: ${ETHICAL_BRANDS_CLAUSE}. Apply Part 5 markup interpretation; acknowledge in verdictReason.

${MATERIAL_COST_AND_TAXONOMY_PROMPT}

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

- **Natural fibers only**: pass = no **petroleum-based** synthetics (Part 1 SYNTHETIC list: polyester, nylon, acrylic, etc.); **natural + cellulosic** (cotton, viscose, Tencel, modal, Naia, etc.) all count toward pass; fail = meaningful petroleum synthetic content; unverified = never.
- **No virgin plastic**: pass = no polyester, nylon, or acrylic present; fail = any of those present; unverified = never.
- **Cost-per-wear thinker**: pass = cost per wear under $2.00; fail = cost per wear over $5.00; unverified = if price was not available.
- **Avoid fast fashion**: pass = brand is not a known fast fashion retailer; fail = brand is a known fast fashion retailer (Shein, Zara, H&M, Primark, Fashion Nova, Boohoo, PrettyLittleThing, ASOS own brand); unverified = brand unknown or ambiguous.
- **No animal products**: pass = no wool, silk, cashmere, leather, fur, down; fail = any animal-derived fiber present; unverified = never.
- **Fair labor**: pass = brand has known fair labor certification (Fair Trade, B Corp, SA8000); fail = brand has known labor violations on record; unverified = most cases — be honest that this cannot be confirmed from label data alone.
- **Made in USA**: pass = country of manufacture confirmed USA; fail = country confirmed not USA; unverified = country not available.
- **Secondhand first**: always return unverified with note: "Check secondhand options in Buffi Pro".
- **Capsule wardrobe**: pass = natural and/or cellulosic fibers (not petroleum-heavy), neutral category, versatile construction; fail = very trend-specific or low durability; unverified = insufficient data.
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

  const zaraUrl =
    raw.source === "url" && typeof raw.url === "string" && isZaraProductPageUrl(raw.url);
  const nonZaraUrlMissingPageComposition =
    raw.source === "url" && typeof raw.url === "string" && !zaraUrl && !raw.materials?.trim();

  const rawForPrompt: RawProductData = nonZaraUrlMissingPageComposition
    ? { ...raw, url: undefined, description: undefined, materials: undefined }
    : raw;

  let dataSourceInstructions: string;
  if (isTagSource && !runFullAnalysis) {
    dataSourceInstructions = `This is a TAG/CARE-LABEL input: we have composition (materials) but NO retail price. Do a PARTIAL analysis:
- Focus on material quality only: parse materials using Part 1 taxonomy; estimate material cost from Part 2–3; judge value using **petroleum synthetic %** vs natural/cellulosic (cellulosic is not plastic).
- Set markup to 0 and costPerWear to 0 (markup analysis requires a price).
- Include in tags: "Partial analysis", "Markup requires price". If brand was not provided, also add "Brand unknown".
- Set isSmallBusiness and markupContext using the rules below where applicable.`;
  } else if (isTagSource) {
    dataSourceInstructions = `This is a TAG/CARE-LABEL input with composition and optional brand/price. If brand or price was not provided, still produce a full analysis using what you have, and add to tags any missing data (e.g. "Brand unknown" or "Price estimated") so the user knows the confidence level. Apply the small-brand, fiber-quality, and markup-context rules below.`;
  } else if (raw.source === "url") {
    if (zaraUrl) {
      dataSourceInstructions = `This is a Zara product URL. If raw data is sparse, you may use naming context — Zara often states fiber content in product titles. Apply the rules below.`;
    } else if (raw.materialsFromSerpSearch && raw.materials?.trim()) {
      dataSourceInstructions = `This is a non-Zara luxury retailer URL. Fiber composition was retrieved from web search snippets (SerpAPI Google organic), not the product page, because composition is often rendered only in client-side JavaScript. Treat raw.materials as a best-effort excerpt; parse percentages conservatively and reflect uncertainty in tags where appropriate. Apply the rules below.`;
    } else if (raw.materials?.trim()) {
      dataSourceInstructions = `This is a non-Zara retailer URL. Treat raw.materials as the only page-derived fiber composition. Do not invent or adjust fiber percentages from product name, URL path, or marketing description. Apply the rules below.`;
    } else {
      dataSourceInstructions = `This is a non-Zara retailer URL without page-extracted composition. Follow the CRITICAL block below exactly. Apply the rules below.`;
    }
  } else {
    dataSourceInstructions = `If the raw data is sparse, make reasonable inferences for clothing/apparel. Apply the rules below.`;
  }

  const criticalNonZaraNoComposition = nonZaraUrlMissingPageComposition
    ? `

**CRITICAL (non-Zara URL, no composition from page):** The scraper did not extract a care-label-style composition string. Do NOT infer fibers from product title, URL, slug, or description. Return materials as exactly one entry: { "fiber": "Unknown", "percentage": 100 }. Use broad conservative estimatedMaterialCostMin/Max for unknown generic apparel. Include tag "${MATERIALS_NOT_DETECTED_TAG}".`
    : "";

  const prompt = `You are a material intelligence analyst for clothing and apparel. Given the following raw product data, produce a structured analysis.

Raw product data:
${JSON.stringify(rawForPrompt, null, 2)}
${selectedValues.length > 0 ? `\nUser selected values to evaluate (return one entry per value in valuesMatch):\n${JSON.stringify(selectedValues)}\n${VALUES_EVALUATION_RULES}` : ""}

${dataSourceInstructions}${criticalNonZaraNoComposition}

**Small / indie brand detection**
- If the brand appears to be an independent or small brand (not a major retailer or fast-fashion chain), treat higher markups as normal and necessary for small-business sustainability. Set isSmallBusiness: true in that case.
- Major retailers and fast-fashion chains: set isSmallBusiness: false.

**Known ethical/sustainable brands**
Set isEthicalBrand: true when the brand matches: ${ETHICAL_BRANDS_CLAUSE}. Note sustainability reputation in verdictReason; apply Part 5 markup thresholds.

**Fiber taxonomy, costs, certifications, verdict thresholds**
Follow the block below exactly for classification, $/yard estimates, yardage, certified materials, and how markup interacts with fiber class. **Materials** in JSON must list fibers with **correct taxonomy**: cellulosic fibers are never “synthetic plastic” in tags or reasoning.

${MATERIAL_COST_AND_TAXONOMY_PROMPT}

**Functional synthetic (garment category)**
Petroleum synthetics that are appropriate for the garment type should not be penalized. Set functionalSynthetic: true when synthetics are expected for the category; false when they are a quality compromise.
- Rain jackets, waterproof outerwear, windbreakers: nylon, polyester, polyurethane expected — high petroleum synthetic % is normal; judge mainly on markup and brand.
- Activewear, swimwear, athletic wear: nylon, polyester, spandex/elastane are functional.
- Lingerie, hosiery, tights: nylon is standard.
- Formal wear, everyday clothing, casualwear: prefer natural/cellulosic; penalize unnecessary petroleum synthetics.
When functionalSynthetic is true: do not treat petroleum synthetic % as a negative in verdict framing; base judgment on markup and brand. In verdictReason you may note: "Synthetic materials are appropriate for this garment type."

**Verdict nuancing (for verdictReason and tags; app recomputes tier)**
- verdictReason MUST include fiber class (natural vs cellulosic vs petroleum synthetic), markup context, and brand where relevant.
- markupContext — exactly one of: "justified" | "partially justified" | "unjustified".

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
- isEthicalBrand (boolean: true if brand matches Part 6 / ethical list: ${ETHICAL_BRANDS_CLAUSE})
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

    if (nonZaraUrlMissingPageComposition) {
      parsed.materials = [{ fiber: "Unknown", percentage: 100 }];
      parsed.confidenceTier = 3;
      const tagSet = new Set(parsed.tags);
      tagSet.add(MATERIALS_NOT_DETECTED_TAG);
      parsed.tags = [...tagSet];
      parsed.hasCertifiedMaterials = false;
      parsed.certifications = [];
    }

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

/**
 * Infer composition from Zara-style title + optional shopping snippet.
 * Callers must only invoke this for zara.com URLs — see scrapeZaraFromUrl.
 * Name inference is Zara-only because Zara consistently includes fiber content in product titles.
 * For other brands this causes incorrect readings.
 */
export async function parseFiberCompositionFromZaraContext(input: {
  productName: string;
  searchDescription?: string;
}): Promise<string | undefined> {
  const key = process.env.ANTHROPIC_API_KEY;
  const productName = input.productName.trim();
  const searchDescription = input.searchDescription?.trim();
  if (!key?.trim() || !productName) return undefined;

  const client = new Anthropic({ apiKey: key });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZARA_TITLE_COMPOSITION_TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Extract fiber composition from this Zara product name and description. Zara often includes fiber content in the product name itself (e.g. 100% LINEN, WOOL BLEND, FAUX LEATHER). Return your best estimate with confidence tier 2 if inferred from name only.

Product name:
"${productName}"

Search/description context:
"${searchDescription || "(none)"}"

Respond ONLY as valid JSON:
{"composition":"<single string suitable for a care label>","confidenceTier":2}
If no fiber/material clue is inferable, return:
{"composition":null,"confidenceTier":2}
No markdown. No explanation.`
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
      .trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return undefined;
    const parsed = JSON.parse(jsonMatch[0]) as { composition?: string | null; confidenceTier?: number };
    const c = parsed.composition;
    if (typeof c !== "string" || !c.trim()) return undefined;
    return c.trim().slice(0, 500);
  } catch (e) {
    clearTimeout(timeout);
    console.warn("[analyze] parseFiberCompositionFromZaraContext failed:", (e as Error).message);
    return undefined;
  }
}
