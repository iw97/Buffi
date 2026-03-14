import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis, MinimalScanResponse, ValuesMatchEntry, ValuesMatchState } from "./types";
import { computeVerdict, parseFibersToMaterials } from "./verdict";

const CLAUDE_TIMEOUT_MS = 45000;

const MINIMAL_SCAN_SYSTEM_PROMPT = `You are a material intelligence analyst for clothing and apparel. You will receive JSON input with: brandName, fibers (array of strings, e.g. "Cotton 100%" or "Polyester 80%, Elastane 20%"), price (retail price in USD), and confidenceTier (number).

Apply these rules:
- Small/indie brand: if brandName suggests an independent or small brand (not a major retailer or fast-fashion chain), set isSmallBusiness: true; higher markups are normal for small-business sustainability.
- Fiber quality: premium natural (cashmere, silk, merino wool, modal, linen, lyocell/Tencel) > standard natural (cotton, wool, hemp) > synthetic (polyester, nylon, acrylic, viscose, elastane). Favor verdict for premium-natural-heavy garments.
- verdictReason must include context (e.g. small-brand markup vs fast-fashion synthetic). Verdict stays "Retail Trap" or "Worth It".
- markupContext: exactly one of "justified" | "partially justified" | "unjustified" based on fiber quality and small-business context.

Respond with only valid JSON and nothing else. No markdown, no code fence, no explanation. The JSON must have exactly these fields:
- estimatedMaterialCost (number, USD)
- markup (number, percentage e.g. 50 for 50%)
- markupBand (string: "low", "medium", or "high" based on markup)
- verdict (string: ignored — we compute verdict from markup and fibers)
- verdictReason (string: one sentence with context)
- tags (array of strings)
- isEstimated (boolean)
- isSmallBusiness (boolean, infer from brand if possible)
- markupContext (string: "justified" | "partially justified" | "unjustified")`;

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
- **Certified sustainable**: pass = known certification in product data (GOTS, OEKO-TEX, Bluesign, B Corp); fail = no certification and brand is known fast fashion; unverified = most cases.
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

**Fiber quality weighting (for verdict and verdictReason)**
Not all natural fibers are equal. Weight fibers in this order for quality assessment:
- Premium natural: cashmere, silk, merino wool, modal, linen, lyocell/Tencel
- Standard natural: cotton, wool, hemp
- Synthetic: polyester, nylon, acrylic, viscose, elastane
A garment that is predominantly premium natural fibers should receive a more favorable verdict than the same markup on synthetic fibers.

**Verdict nuancing**
- Verdict label stays exactly "Retail Trap" or "Worth It".
- verdictReason MUST include context. For small brands with quality fibers, acknowledge both the markup and mitigating factors.
  Example (small brand + quality fibers): "Independent brand markup — quality cotton-modal blend partially justifies the price. You are paying a premium for small-batch production."
  Example (fast fashion synthetic): "Steep markup on low-quality synthetic materials with no justification beyond brand recognition."
- Add a new field markupContext — exactly one of: "justified" | "partially justified" | "unjustified". Use it to reflect whether the markup is justified by fiber quality, small-business context, or neither.

Return a JSON object with exactly these fields (no other fields, no markdown, no explanation):
- brand (string, use provided brand or "Unknown" if missing)
- name (string, use product name or a short description from materials if missing)
- price (number; use provided price, or 0 if not provided)
- materials (array of objects: { fiber: string, percentage: number }; ensure percentages sum to 100)
- estimatedMaterialCost (number, in USD)
- markup (number, as percentage e.g. 20 for 20%; use 0 if no price was provided)
- costPerWear (number, estimated; use 0 if no price)
- verdict (string: any — we overwrite with computed three-tier verdict)
- verdictReason (string, one sentence with context as above)
- tags (array of strings, e.g. "Synthetic Heavy", "High Markup", "Fast Fashion", "Natural Fibers", "Fair Value", "Small Brand"; include confidence flags when relevant)
- isSmallBusiness (boolean: true if independent/small brand, false if major retailer or fast fashion)
- markupContext (string: exactly "justified" | "partially justified" | "unjustified")${selectedValues.length > 0 ? `
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

    // Validate required fields (verdict/verdictReason are overwritten by computeVerdict)
    const validMarkupContext = ["justified", "partially justified", "unjustified"] as const;
    if (
      typeof parsed.brand !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.price !== "number" ||
      !Array.isArray(parsed.materials) ||
      typeof parsed.estimatedMaterialCost !== "number" ||
      typeof parsed.markup !== "number" ||
      typeof parsed.costPerWear !== "number" ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags) ||
      !validMarkupContext.includes(parsed.markupContext as (typeof validMarkupContext)[number])
    ) {
      throw new Error("Invalid Claude response structure");
    }
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

    const { verdict, verdictReason } = computeVerdict({
      markup: parsed.markup,
      materials: parsed.materials,
      isSmallBusiness: parsed.isSmallBusiness,
      costPerWear: parsed.costPerWear
    });
    parsed.verdict = verdict;
    parsed.verdictReason = verdictReason;
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

    const validMarkupContext = ["justified", "partially justified", "unjustified"] as const;
    if (
      typeof parsed.estimatedMaterialCost !== "number" ||
      typeof parsed.markup !== "number" ||
      typeof parsed.markupBand !== "string" ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags) ||
      typeof parsed.isEstimated !== "boolean" ||
      typeof parsed.isSmallBusiness !== "boolean" ||
      !validMarkupContext.includes(parsed.markupContext as (typeof validMarkupContext)[number])
    ) {
      throw new Error("Invalid minimal scan response structure");
    }

    const materials = parseFibersToMaterials(input.fibers);
    const { verdict, verdictReason } = computeVerdict({
      markup: parsed.markup,
      materials,
      isSmallBusiness: parsed.isSmallBusiness,
      costPerWear: 0
    });
    parsed.verdict = verdict;
    parsed.verdictReason = verdictReason;
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
