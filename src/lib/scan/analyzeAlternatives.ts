import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { buildAlternativeShoppingQuery } from "./alternativeSearchQuery";
import { getGarmentCategoryLabel } from "./garmentCategories";
import type { ScanAnalysis, AlternativeSuggestion } from "./types";
import { CLAUDE_MINIMAL_MODEL } from "./models";

const TIMEOUT_MS = 15_000;

// ─── Product context inference ────────────────────────────────────────────────

interface ProductContext {
  gender: "women's" | "men's" | "unisex";
  fitStyle: "fitted/sculpting" | "relaxed/oversized" | "standard";
  useCase: "loungewear/intimates" | "activewear" | "workwear" | "casual";
}

const WOMENS_BRANDS = new Set([
  "skims", "aritzia", "free people", "anthropologie", "reformation",
  "spanx", "victoria's secret", "pink", "athleta", "soma", "commando",
  "cuyana", "revolve", "torrid", "lane bryant", "good american",
  "universal standard", "princess polly", "nasty gal", "missguided",
  "prettylittlething", "shein women", "abercrombie women", "cacique",
  "loft", "ann taylor", "j.jill", "chico's", "white house black market",
  "talbots", "coldwater creek", "venus", "eloquii"
]);

const MENS_BRANDS = new Set([
  "bonobos", "suitsupply", "suit supply", "buck mason", "cuts clothing",
  "rhone", "bylt basics", "true classic", "fresh clean threads"
]);

const WOMENS_KEYWORDS = [
  "women", "womens", "woman", "ladies", "feminine", "girls",
  "bra", "bikini top", "dress", "skirt", "blouse", "cami", "camisole",
  "bodysuit", "jumpsuit", "romper", "leggings", "crop top", "bustier"
];

const MENS_KEYWORDS = ["men", "mens", "man", "masculine", "boxer shorts", "briefs men"];

const FITTED_KEYWORDS = [
  "fitted", "bodycon", "body-con", "body con", "sculpting", "sculpt",
  "slim fit", "slim-fit", "tight", "form-fitting", "form fitting",
  "compression", "contour", "seamless", "second skin", "curve-hugging",
  "snug", "stretch", "body hugging", "figure-hugging"
];

const RELAXED_KEYWORDS = [
  "oversized", "relaxed", "boxy", "loose", "wide leg", "slouchy",
  "boyfriend", "drop shoulder", "longline", "flowy", "draped"
];

const LOUNGE_KEYWORDS = [
  "lounge", "loungewear", "intimates", "sleep", "pajama", "pyjama",
  "underwear", "cozy", "comfy", "soft", "modal", "satin slip"
];

const ACTIVE_KEYWORDS = [
  "sport", "active", "activewear", "workout", "gym", "yoga",
  "running", "athletic", "performance", "training", "sweat"
];

const WORK_KEYWORDS = [
  "work", "office", "professional", "business", "formal",
  "blazer", "tailored", "structured", "ponte", "trousers"
];

function inferProductContext(brand: string, name: string, tags: string[]): ProductContext {
  const combined = `${brand} ${name} ${tags.join(" ")}`.toLowerCase();

  let gender: ProductContext["gender"] = "unisex";
  if (WOMENS_BRANDS.has(brand.toLowerCase()) || WOMENS_KEYWORDS.some((kw) => combined.includes(kw))) {
    gender = "women's";
  } else if (MENS_BRANDS.has(brand.toLowerCase()) || MENS_KEYWORDS.some((kw) => combined.includes(kw))) {
    gender = "men's";
  }

  let fitStyle: ProductContext["fitStyle"] = "standard";
  if (FITTED_KEYWORDS.some((kw) => combined.includes(kw))) {
    fitStyle = "fitted/sculpting";
  } else if (RELAXED_KEYWORDS.some((kw) => combined.includes(kw))) {
    fitStyle = "relaxed/oversized";
  }

  let useCase: ProductContext["useCase"] = "casual";
  if (LOUNGE_KEYWORDS.some((kw) => combined.includes(kw))) {
    useCase = "loungewear/intimates";
  } else if (ACTIVE_KEYWORDS.some((kw) => combined.includes(kw))) {
    useCase = "activewear";
  } else if (WORK_KEYWORDS.some((kw) => combined.includes(kw))) {
    useCase = "workwear";
  }

  return { gender, fitStyle, useCase };
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You suggest specific real alternative products for shoppers who scanned a clothing item with poor fabric-to-price value.

You receive JSON with:
- The scanned item's analysis (brand, name, price, verdict, materials, markup range, tags)
- inferredContext: { gender, fitStyle, useCase } — pre-analyzed audience and style signals

STEP 1 — Understand purchase intent before suggesting anything:
Who is this item for? What body experience does it deliver (sculpting, cozy, structured, etc.)? What would make this specific buyer happy with an alternative — not just a cheaper shirt, but the right shirt for their actual need.

STEP 2 — Suggest 0–2 alternatives that satisfy ALL of these criteria:
1. Same target audience and gender — if the original is women's, every suggestion must be women's. Never suggest unisex or men's cuts as alternatives to women's items.
2. Same fit intention — if the original is body-con or sculpting, only suggest fitted/sculpting alternatives. If relaxed, suggest relaxed. A different silhouette is not a real alternative.
3. Same use case — loungewear stays loungewear, activewear stays activewear, workwear stays workwear.
4. Better fiber story — more natural fibers (cotton, wool, linen, cashmere, silk) vs synthetics (polyester, nylon, acrylic, viscose) at a similar price (within ~50% above or below).
5. Different brand than the original.
6. Products you are highly confident actually exist based on your training knowledge — no fabrication.

If you cannot find alternatives that genuinely satisfy all criteria, return an empty array. A well-matched empty result is far better than a mismatched suggestion.

Field rules:
- whyBetter: max 8 words, specific about the fiber improvement AND fit match (e.g. "Higher cotton, same sculpting fit")
- keyMaterial: short dominant-fiber label (e.g. "95% Cotton stretch", "Modal blend")
- estimatedPrice: rough range (e.g. "$40–60")
- searchQuery: specific enough to find on Google Shopping — include the gender and fit descriptor

Respond with ONLY a valid JSON array — no markdown, no code fences, no commentary:
[{ "brand": string, "productName": string, "estimatedPrice": string, "keyMaterial": string, "whyBetter": string, "searchQuery": string }]`;

// ─── Response parsing ─────────────────────────────────────────────────────────

function extractArray(message: Anthropic.Message): unknown[] {
  const text = (message.content as Array<{ type?: string; text?: string }>)
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("")
    .trim();

  const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
  const jsonStr = fenced ? fenced[1] : text.match(/\[[\s\S]*\]/)?.[0];
  if (!jsonStr) return [];

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeAlternatives(analysis: ScanAnalysis): Promise<AlternativeSuggestion[]> {
  const client = getAnthropicClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const inferredContext = inferProductContext(
    analysis.brand ?? "",
    analysis.name ?? "",
    analysis.tags ?? []
  );

  const userGarmentCategory = analysis.garmentCategory ?? null;

  try {
    const message = await client.messages.create(
      {
        model: CLAUDE_MINIMAL_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              brand: analysis.brand,
              name: analysis.name,
              price: analysis.price,
              verdict: analysis.verdict,
              materials: analysis.materials,
              markupMin: analysis.markupMin,
              markupMax: analysis.markupMax,
              tags: analysis.tags,
              inferredContext,
              ...(userGarmentCategory && {
                userGarmentCategory,
                userGarmentCategoryLabel: getGarmentCategoryLabel(userGarmentCategory),
                note: "Shopper confirmed garment type — match alternatives to this category, not fiber-inferred type."
              })
            })
          }
        ]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const raw = extractArray(message);
    const results: AlternativeSuggestion[] = [];

    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (
        typeof r.brand === "string" && r.brand.trim() &&
        typeof r.productName === "string" && r.productName.trim() &&
        typeof r.estimatedPrice === "string" && r.estimatedPrice.trim() &&
        typeof r.keyMaterial === "string" && r.keyMaterial.trim() &&
        typeof r.whyBetter === "string" && r.whyBetter.trim() &&
        typeof r.searchQuery === "string" && r.searchQuery.trim()
      ) {
        const claudeSearchQuery = r.searchQuery.trim();
        results.push({
          brand: r.brand.trim(),
          productName: r.productName.trim(),
          estimatedPrice: r.estimatedPrice.trim(),
          keyMaterial: r.keyMaterial.trim(),
          whyBetter: r.whyBetter.trim(),
          searchQuery: buildAlternativeShoppingQuery({
            brand: r.brand.trim(),
            garmentCategory: userGarmentCategory,
            price: analysis.price,
            claudeSearchQuery
          })
        });
      }
      if (results.length >= 2) break;
    }

    return results;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}
