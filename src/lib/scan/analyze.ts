import Anthropic from "@anthropic-ai/sdk";
import type { RawProductData } from "./types";
import type { ScanAnalysis } from "./types";

const CLAUDE_TIMEOUT_MS = 45000;

export async function analyzeWithClaude(raw: RawProductData): Promise<ScanAnalysis> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are a material intelligence analyst for clothing and apparel. Given the following raw product data (from a URL scrape or barcode lookup), produce a structured analysis.

Raw product data:
${JSON.stringify(raw, null, 2)}

Return a JSON object with exactly these fields (no other fields, no markdown, no explanation):
- brand (string)
- name (string)
- price (number, use the provided price or estimate from context)
- materials (array of objects: { fiber: string, percentage: number })
- estimatedMaterialCost (number, in USD)
- markup (number, as percentage, e.g. 2019 for 2019%)
- costPerWear (number, estimated)
- verdict ("Retail Trap" or "Worth It")
- verdictReason (string, one sentence)
- tags (array of strings, e.g. "Synthetic Heavy", "High Markup", "Fast Fashion", "Natural Fibers", "Fair Value")

If the raw data is sparse, make reasonable inferences for clothing/apparel. Ensure materials percentages sum to 100.`;

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
