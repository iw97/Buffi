import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { fetchGoogleShoppingSerpPayload, getPriceFromGoogleShopping } from "../src/lib/scan/serpapi";

const QUERIES = [
  "Reformation Stelliana Silk Dress",
  "Miu Miu denim miniskirt GWD329",
  "H&M linen shirt"
] as const;

function firstResultSourceUrl(row: Record<string, unknown> | undefined): string {
  if (!row) return "(none)";
  const link = row.link;
  const productLink = row.product_link;
  if (typeof link === "string" && link.trim()) return link.trim();
  if (typeof productLink === "string" && productLink.trim()) return productLink.trim();
  return "(no link in row)";
}

async function runQuery(query: string): Promise<void> {
  console.log("\n" + "=".repeat(72));
  console.log("QUERY:", JSON.stringify(query));

  const payload = await fetchGoogleShoppingSerpPayload(query);
  if (!payload) {
    console.log("SerpAPI: no payload (missing SERPAPI_KEY or request failed).");
    console.log("Extracted price: (none)");
    console.log("Source URL: (none)");
    return;
  }

  console.log("Exact query sent to SerpAPI (q param):", JSON.stringify(payload.trimmedQuery));
  console.log("SerpAPI request URL (redacted):", payload.serpRequestUrlRedacted);
  if (payload.error) {
    console.log("SerpAPI error field:", payload.error);
  }

  const top3 = Array.isArray(payload.shopping_results) ? payload.shopping_results.slice(0, 3) : [];
  console.log("Raw SerpAPI — first 3 shopping_results:");
  console.log(JSON.stringify(top3, null, 2));

  const extracted = await getPriceFromGoogleShopping(query, { reusePayload: payload });

  if (extracted) {
    console.log("Extracted price:", extracted.price);
    console.log("Merchant/source label (SerpAPI `source` on first row):", extracted.source);
    const firstRow = payload.shopping_results?.[0] as Record<string, unknown> | undefined;
    console.log("Source URL (first row link / product_link):", firstResultSourceUrl(firstRow));
  } else {
    console.log("Extracted price: (none)");
    console.log("Merchant/source label: (none)");
    console.log("Source URL:", firstResultSourceUrl(payload.shopping_results?.[0] as Record<string, unknown>));
  }
}

async function main(): Promise<void> {
  console.log("test-serp: Google Shopping via SerpAPI (SERPAPI_KEY from env)");
  for (const q of QUERIES) {
    await runQuery(q);
  }
  console.log("\n" + "=".repeat(72) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
