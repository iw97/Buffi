import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis, MinimalScanResponse } from "./types";

const CLAUDE_TIMEOUT_MS = 45000;

const MINIMAL_SCAN_SYSTEM_PROMPT = `You are a material intelligence analyst for clothing and apparel. You will receive JSON input with: brandName, fibers (array of strings, e.g. "Cotton 100%" or "Polyester 80%, Elastane 20%"), price (retail price in USD), and confidenceTier (number).

Respond with only valid JSON and nothing else. No markdown, no code fence, no explanation. The JSON must have exactly these fields:
- estimatedMaterialCost (number, USD)
- markup (number, percentage e.g. 50 for 50%)
- markupBand (string: "low", "medium", or "high" based on markup)
- verdict (string: "Retail Trap" or "Worth It")
- verdictReason (string, one sentence)
- tags (array of strings, e.g. "Synthetic Heavy", "High Markup", "Natural Fibers", "Fair Value")
- isEstimated (boolean)
- isSmallBusiness (boolean, infer from brand if possible)`;

export async function analyzeWithClaude(raw: RawProductData): Promise<ScanAnalysis> {
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

${
  isTagSource && !runFullAnalysis
    ? `This is a TAG/CARE-LABEL input: we have composition (materials) but NO retail price. Do a PARTIAL analysis:
- Focus on material quality only: parse materials from the composition text, estimate material cost, and give a verdict based purely on whether the materials are good value for typical apparel (synthetic-heavy vs natural, durability, etc.).
- Set markup to 0 and costPerWear to 0 (markup analysis requires a price).
- Include in tags: "Partial analysis", "Markup requires price". If brand was not provided, also add "Brand unknown".`
    : isTagSource
      ? `This is a TAG/CARE-LABEL input with composition and optional brand/price. If brand or price was not provided, still produce a full analysis using what you have, and add to tags any missing data (e.g. "Brand unknown" or "Price estimated") so the user knows the confidence level.`
      : `If the raw data is sparse, make reasonable inferences for clothing/apparel.`
}

Return a JSON object with exactly these fields (no other fields, no markdown, no explanation):
- brand (string, use provided brand or "Unknown" if missing)
- name (string, use product name or a short description from materials if missing)
- price (number; use provided price, or 0 if not provided)
- materials (array of objects: { fiber: string, percentage: number }; ensure percentages sum to 100)
- estimatedMaterialCost (number, in USD)
- markup (number, as percentage e.g. 20 for 20%; use 0 if no price was provided)
- costPerWear (number, estimated; use 0 if no price)
- verdict ("Retail Trap" or "Worth It")
- verdictReason (string, one sentence)
- tags (array of strings, e.g. "Synthetic Heavy", "High Markup", "Fast Fashion", "Natural Fibers", "Fair Value"; include confidence flags like "Brand unknown" or "Markup requires price" when relevant)`;

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

    // Validate required fields
    if (
      typeof parsed.brand !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.price !== "number" ||
      !Array.isArray(parsed.materials) ||
      typeof parsed.estimatedMaterialCost !== "number" ||
      typeof parsed.markup !== "number" ||
      typeof parsed.costPerWear !== "number" ||
      !["Retail Trap", "Worth It"].includes(parsed.verdict) ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags)
    ) {
      throw new Error("Invalid Claude response structure");
    }

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

    if (
      typeof parsed.estimatedMaterialCost !== "number" ||
      typeof parsed.markup !== "number" ||
      typeof parsed.markupBand !== "string" ||
      !["Retail Trap", "Worth It"].includes(parsed.verdict) ||
      typeof parsed.verdictReason !== "string" ||
      !Array.isArray(parsed.tags) ||
      typeof parsed.isEstimated !== "boolean" ||
      typeof parsed.isSmallBusiness !== "boolean"
    ) {
      throw new Error("Invalid minimal scan response structure");
    }

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
