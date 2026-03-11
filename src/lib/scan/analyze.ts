import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis } from "./types";

const CLAUDE_TIMEOUT_MS = 45000;

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
