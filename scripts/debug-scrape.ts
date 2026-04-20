import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import fetch from "node-fetch";
import { scrapeProductFromUrl } from "../src/lib/scan/scrape";

const REFORMATION_PRODUCT_URL = "https://www.thereformation.com/products/stelliana-silk-dress";
const REFORMATION_JSON_URL = "https://www.thereformation.com/products/stelliana-silk-dress.json";

/** Match scrape.ts desktop Chrome probe + Google referer for Reformation */
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

async function probeReformationJson(): Promise<void> {
  console.log("\n========== direct .json (node-fetch) ==========\n", REFORMATION_JSON_URL, "\n");
  const res = await fetch(REFORMATION_JSON_URL, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const text = await res.text();
  console.log("HTTP status:", res.status);
  console.log("First 500 chars of body:\n", text.slice(0, 500));
}

async function main(): Promise<void> {
  await probeReformationJson();

  console.log("\n\n========== scrapeProductFromUrl ==========\n", REFORMATION_PRODUCT_URL, "\n");
  const result = await scrapeProductFromUrl(REFORMATION_PRODUCT_URL);
  console.log("\n--- scrapeProductFromUrl return ---\n", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
