import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import fetch from "node-fetch";
import { fetchShopifyProductJson, scrapeProductFromUrl } from "../src/lib/scan/scrape";

const SKIMS_PRODUCT_URL = "https://skims.com/products/cotton-jersey-t-shirt-soot";
const SKIMS_JSON_URL = "https://skims.com/products/cotton-jersey-t-shirt-soot.json";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Referer: "https://www.google.com/"
};

async function probeJsonEndpoint(): Promise<{ status: number; bodySnippet: string }> {
  console.log("\n========== direct Shopify .json endpoint ==========\n", SKIMS_JSON_URL, "\n");
  const res = await fetch(SKIMS_JSON_URL, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const text = await res.text();
  const bodySnippet = text.slice(0, 1000);
  console.log("1) HTTP status of .json endpoint:", res.status);
  console.log("2) First 1000 chars of .json response:\n", bodySnippet);
  return { status: res.status, bodySnippet };
}

function logPriceAndSource(
  shopifyResult: Awaited<ReturnType<typeof fetchShopifyProductJson>>,
  scrapeResult: Awaited<ReturnType<typeof scrapeProductFromUrl>>
): void {
  const shopifyPrice = shopifyResult?.price;
  const scrapedPrice = scrapeResult?.price;

  if (shopifyPrice != null) {
    console.log("4) Price found/source:", {
      price: shopifyPrice,
      source: "fetchShopifyProductJson -> product.variants[].price"
    });
    return;
  }

  if (scrapedPrice != null) {
    console.log("4) Price found/source:", {
      price: scrapedPrice,
      source: "scrapeProductFromUrl (fallback path output)"
    });
    return;
  }

  console.log("4) Price found/source:", {
    price: null,
    source: "none"
  });
}

function logMaterialsAndPath(
  shopifyResult: Awaited<ReturnType<typeof fetchShopifyProductJson>>,
  scrapeResult: Awaited<ReturnType<typeof scrapeProductFromUrl>>
): void {
  const materials = scrapeResult?.materials ?? shopifyResult?.materials ?? null;
  const pathTaken =
    shopifyResult && (shopifyResult.name || shopifyResult.brand || shopifyResult.price != null)
      ? "Shopify.json"
      : scrapeResult
        ? "generic HTML / non-Shopify fallback"
        : "no successful scrape path";

  console.log("5) Materials/composition found:", materials);
  console.log("6) Scraping path taken:", pathTaken);
}

async function main(): Promise<void> {
  await probeJsonEndpoint();

  console.log("\n========== fetchShopifyProductJson ==========\n", SKIMS_PRODUCT_URL, "\n");
  const shopifyResult = await fetchShopifyProductJson(SKIMS_PRODUCT_URL);
  console.log("3) fetchShopifyProductJson return:\n", JSON.stringify(shopifyResult, null, 2));

  console.log("\n========== scrapeProductFromUrl ==========\n", SKIMS_PRODUCT_URL, "\n");
  const scrapeResult = await scrapeProductFromUrl(SKIMS_PRODUCT_URL);
  console.log("\n--- scrapeProductFromUrl return ---\n", JSON.stringify(scrapeResult, null, 2));

  logPriceAndSource(shopifyResult, scrapeResult);
  logMaterialsAndPath(shopifyResult, scrapeResult);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
