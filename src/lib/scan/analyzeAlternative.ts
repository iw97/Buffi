import Anthropic from "@anthropic-ai/sdk";
import type { AlternativeAnalysisResult, AlternativeCandidateProduct, ScanAnalysis } from "./types";
import { CLAUDE_MINIMAL_MODEL } from "./models";

const ALT_ANALYSIS_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT = `You evaluate one candidate retail product as a potential "better alternative" to an original item the user already scanned.

You receive JSON with:
- originalScan: full prior analysis (materials, costs, markup range, cost per wear, verdict, etc.)
- candidateProduct: { name, brand, price (USD), rawCompositionText } — composition may be messy; infer fibers and percentages.

Your job:
1. Parse rawCompositionText into fibers: array of { "fiber", "percentage" } (percentages should sum to ~100; round sensibly).
2. Estimate estimatedMaterialCostMin and estimatedMaterialCostMax (USD) for the candidate using typical fabric $/yard, yardage for the garment type, trim/labor — same spirit as a bill-of-materials for apparel.
3. Compute markupMin = (price / estimatedMaterialCostMax - 1) * 100 and markupMax = (price / estimatedMaterialCostMin - 1) * 100 (retail markup % range).
4. Estimate costPerWear: USD retail price divided by a realistic lifetime wear count for this category (e.g. 40–60 for basics; fewer for delicate items). Must be a positive number.
5. isGenuinelyBetter: set true ONLY if this candidate is meaningfully better than the original on at least one of: fiber quality (more natural/premium vs synthetic-heavy), retail markup burden (materially lower for comparable or better materials), or cost per wear (materially lower). Do NOT set true for tiny margins, ambiguous tradeoffs, missing data guesses, or "slightly" better — apply real judgment. When in doubt, false.
6. primaryImprovement: if isGenuinelyBetter, exactly one of "fiber" | "markup" | "costPerWear" for the strongest improvement; otherwise null.
7. improvementSummary: at most 6 words, no punctuation beyond optional hyphen. If isGenuinelyBetter is true, state the main upside vs the original. If false, briefly why not (e.g. "Similar markup and fibers").

Respond with ONLY valid JSON — no markdown, no code fences, no commentary. Required shape:
{
  "fibers": [ { "fiber": string, "percentage": number } ],
  "estimatedMaterialCostMin": number,
  "estimatedMaterialCostMax": number,
  "markupMin": number,
  "markupMax": number,
  "costPerWear": number,
  "isGenuinelyBetter": boolean,
  "primaryImprovement": "fiber" | "markup" | "costPerWear" | null,
  "improvementSummary": string
}`;

function clampImprovementSummary(s: string, maxWords: number): string {
  const w = s.trim().split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return w.join(" ");
  return w.slice(0, maxWords).join(" ");
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fence) return fence[1] ?? null;
  const brace = trimmed.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : null;
}

/**
 * Lightweight Claude call: compare a candidate product (name, brand, price, raw composition)
 * to the original scan. Uses claude-sonnet-4-5, max_tokens 400.
 */
export async function analyzeAlternative(
  originalScan: ScanAnalysis,
  candidateProduct: AlternativeCandidateProduct
): Promise<AlternativeAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const userPayload = {
    originalScan,
    candidateProduct: {
      name: candidateProduct.name,
      brand: candidateProduct.brand,
      price: candidateProduct.price,
      rawCompositionText: candidateProduct.rawCompositionText
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALT_ANALYSIS_TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: CLAUDE_MINIMAL_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(userPayload, null, 2)
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

    const jsonRaw = extractJsonObject(text);
    if (!jsonRaw) {
      throw new Error("No JSON object in Claude alternative analysis response");
    }

    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;

    const fibersRaw = parsed.fibers;
    if (!Array.isArray(fibersRaw)) {
      throw new Error("Invalid alternative analysis: fibers must be an array");
    }

    const fibers: { fiber: string; percentage: number }[] = [];
    for (const row of fibersRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const fiber = typeof r.fiber === "string" ? r.fiber.trim() : "";
      const pct = typeof r.percentage === "number" ? r.percentage : Number(r.percentage);
      if (!fiber || Number.isNaN(pct)) continue;
      fibers.push({ fiber, percentage: pct });
    }
    if (fibers.length === 0) {
      throw new Error("Invalid alternative analysis: fibers array must not be empty");
    }

    const nums = [
      "estimatedMaterialCostMin",
      "estimatedMaterialCostMax",
      "markupMin",
      "markupMax",
      "costPerWear"
    ] as const;
    for (const k of nums) {
      const v = parsed[k];
      if (typeof v !== "number" || Number.isNaN(v)) {
        throw new Error(`Invalid alternative analysis: ${k} must be a number`);
      }
    }

    if (typeof parsed.isGenuinelyBetter !== "boolean") {
      throw new Error("Invalid alternative analysis: isGenuinelyBetter must be boolean");
    }

    const allowedPrimary = new Set(["fiber", "markup", "costPerWear"]);
    let primaryImprovement: AlternativeAnalysisResult["primaryImprovement"] = null;
    const pi = parsed.primaryImprovement;
    if (pi === null || pi === undefined) {
      primaryImprovement = null;
    } else if (typeof pi === "string" && allowedPrimary.has(pi)) {
      primaryImprovement = pi as AlternativeAnalysisResult["primaryImprovement"];
    } else {
      throw new Error("Invalid alternative analysis: primaryImprovement");
    }

    const summaryRaw = typeof parsed.improvementSummary === "string" ? parsed.improvementSummary.trim() : "";
    if (!summaryRaw) {
      throw new Error("Invalid alternative analysis: improvementSummary required");
    }

    const result: AlternativeAnalysisResult = {
      fibers,
      estimatedMaterialCostMin: parsed.estimatedMaterialCostMin as number,
      estimatedMaterialCostMax: parsed.estimatedMaterialCostMax as number,
      markupMin: parsed.markupMin as number,
      markupMax: parsed.markupMax as number,
      costPerWear: parsed.costPerWear as number,
      isGenuinelyBetter: parsed.isGenuinelyBetter,
      primaryImprovement,
      improvementSummary: clampImprovementSummary(summaryRaw, 6)
    };

    if (!result.isGenuinelyBetter) {
      result.primaryImprovement = null;
    } else if (result.primaryImprovement === null) {
      throw new Error("Invalid alternative analysis: primaryImprovement required when isGenuinelyBetter is true");
    }

    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new Error("Claude API timeout (alternative analysis)") as Error & { code?: string };
      timeoutErr.code = "claude_timeout";
      throw timeoutErr;
    }
    throw err;
  }
}
