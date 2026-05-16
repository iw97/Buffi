import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
process.env.DEBUG_SCRAPE_MATERIALS = "1";

const PRODUCT_URL =
  "https://skims.com/products/fits-everybody-t-shirt-bodysuit-onyx";

async function main(): Promise<void> {
  const { fetchShopifyProductJson, scrapeProductFromUrl, isGussetFalsePositive } = await import(
    "../src/lib/scan/scrape"
  );

  console.log("========== debug-scrape ==========");
  console.log("URL:", PRODUCT_URL);
  console.log("DEBUG_SCRAPE_MATERIALS:", process.env.DEBUG_SCRAPE_MATERIALS);
  console.log(
    "BRIGHT_DATA_TOKEN:",
    process.env.BRIGHT_DATA_TOKEN ? `set (${process.env.BRIGHT_DATA_TOKEN.length} chars)` : "NOT SET"
  );
  console.log("BRIGHT_DATA_ZONE:", process.env.BRIGHT_DATA_ZONE ?? "(default: buffi_unlocker)");
  console.log("");

  // Reference: SKIMS gusset false positive
  const gussetSample = "100% Cotton gusset";
  console.log("--- isGussetFalsePositive sanity check ---");
  console.log("sample:", gussetSample);
  console.log("returned:", isGussetFalsePositive(gussetSample));
  console.log("");

  console.log("========== step 1: Shopify .json ==========\n");
  const shopifyResult = await fetchShopifyProductJson(PRODUCT_URL);
  console.log("Shopify .json materials (raw):", shopifyResult?.materials ?? null);
  console.log("Shopify .json full result:", JSON.stringify(shopifyResult, null, 2));
  console.log("");

  console.log("========== scrapeProductFromUrl (full pipeline) ==========\n");
  const scrapeResult = await scrapeProductFromUrl(PRODUCT_URL);

  console.log("\n========== summary ==========\n");
  console.log("1) Raw materials per step: see [debug-scrape/materials] lines above");
  console.log("2) isGussetFalsePositive: see [debug-scrape/materials] isGussetFalsePositive entries");
  console.log("3) Bright Data triggered: see bright-data-decision entry");
  console.log("4) Bright Data materials: see step3-bright-data entry");
  console.log("5) Final materials (before Claude / scan API):", scrapeResult?.materials ?? null);
  console.log("\n--- scrapeProductFromUrl return ---\n", JSON.stringify(scrapeResult, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
