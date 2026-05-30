/**
 * Debug scrape pipeline for one or more product URLs.
 *
 * Usage:
 *   npx tsx scripts/debug-scrape.ts
 *   npx tsx scripts/debug-scrape.ts "https://example.com/product"
 *   DEBUG_SCRAPE_URLS="url1,url2" npx tsx scripts/debug-scrape.ts
 *
 * Default URLs: Aritzia Generation Blazer + Gap product (override via args/env).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { format } from "util";

config({ path: resolve(process.cwd(), ".env.local") });
process.env.DEBUG_SCRAPE_MATERIALS = "1";

const DEFAULT_URLS: string[] = [
  "https://www.aritzia.com/us/en/product/generation-blazer/116425127.html",
  "https://www.gap.com/browse/product.do?pid=709193002&vid=1&pcid=6998&cid=6998"
];

function resolveUrlsToTest(): string[] {
  const fromEnv = process.env.DEBUG_SCRAPE_URLS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  const fromArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (fromArgs.length > 0) return fromArgs;
  return DEFAULT_URLS;
}

type CapturedRun = {
  logs: string[];
  warns: string[];
  errors: string[];
};

function captureConsole<T>(fn: () => Promise<T>): Promise<{ run: CapturedRun; value?: T; thrown?: unknown }> {
  const run: CapturedRun = { logs: [], warns: [], errors: [] };
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    run.logs.push(format(...args));
    origLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    run.warns.push(format(...args));
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    run.errors.push(format(...args));
    origError(...args);
  };

  return fn()
    .then((value) => ({ run, value }))
    .catch((thrown) => ({ run, thrown }))
    .finally(() => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    });
}

function pickPathTaken(lines: string[]): string[] {
  return lines.filter((l) => l.includes("[scrape] scrape path taken"));
}

function pickHttpStatusEvents(lines: string[]): string[] {
  return lines.filter((l) => {
    return (
      /status/i.test(l) ||
      /HTTP\s+\d{3}/i.test(l) ||
      l.includes("non-OK") ||
      l.includes("fetch retry after HTTP")
    );
  });
}

function pickBrightDataParse(lines: string[]): string[] {
  return lines.filter((l) => l.startsWith("[BD]"));
}

function brightDataSummary(lines: string[]): { fired: boolean; responseStatus: string } {
  const fired =
    lines.some((l) => l.includes("auto-triggering Bright Data")) ||
    lines.some((l) => l.includes("using Bright Data fallback")) ||
    lines.some((l) => l.includes("Bright Data success")) ||
    lines.some((l) => l.includes("Bright Data returned non-OK"));

  const nonOk = lines.find((l) => l.includes("Bright Data returned non-OK"));
  if (nonOk) return { fired, responseStatus: nonOk };
  const success = lines.find((l) => l.includes("Bright Data success"));
  if (success) return { fired, responseStatus: success };
  const skipped = lines.find((l) => l.includes("Bright Data token not set, skipping fallback"));
  if (skipped) return { fired, responseStatus: skipped };
  const err = lines.find((l) => l.includes("Bright Data error:"));
  if (err) return { fired, responseStatus: err };
  return { fired, responseStatus: "(no Bright Data status line captured)" };
}

async function main(): Promise<void> {
  const urls = resolveUrlsToTest();
  const { fetchShopifyProductJson, scrapeProductFromUrl } = await import("../src/lib/scan/scrape");

  console.log("========== debug-scrape ==========");
  console.log("URLs:", urls);
  console.log("DEBUG_SCRAPE_MATERIALS:", process.env.DEBUG_SCRAPE_MATERIALS);
  console.log(
    "BRIGHT_DATA_TOKEN:",
    process.env.BRIGHT_DATA_TOKEN ? `set (${process.env.BRIGHT_DATA_TOKEN.length} chars)` : "NOT SET"
  );
  console.log("BRIGHT_DATA_ZONE:", process.env.BRIGHT_DATA_ZONE ?? "(default: buffi_unlocker)");
  console.log("");

  for (const [idx, url] of urls.entries()) {
    console.log(`\n================ URL ${idx + 1} ================`);
    console.log("URL:", url);

    const result = await captureConsole(async () => {
      const shopifyResult = await fetchShopifyProductJson(url);
      const scrapeResult = await scrapeProductFromUrl(url);
      return { shopifyResult, scrapeResult };
    });

    const allLines = [...result.run.logs, ...result.run.warns, ...result.run.errors];
    const pathTaken = pickPathTaken(allLines);
    const httpStatusEvents = pickHttpStatusEvents(allLines);
    const bdParse = pickBrightDataParse(allLines);
    const bright = brightDataSummary(allLines);

    console.log("\n--- summary ---");
    console.log("Scraping path taken:");
    if (pathTaken.length === 0) console.log("  (none captured)");
    for (const line of pathTaken) console.log(" ", line);

    console.log("\nHTTP status at each step:");
    if (httpStatusEvents.length === 0) console.log("  (no explicit status lines captured)");
    for (const line of httpStatusEvents) console.log(" ", line);

    console.log("\nBright Data fired:", bright.fired ? "yes" : "no");
    console.log("Bright Data response status:", bright.responseStatus);

    if (bdParse.length > 0) {
      console.log("\nBright Data parse:");
      for (const line of bdParse) console.log(" ", line);
    }

    if (result.value) {
      console.log("\nFinal materials:", result.value.scrapeResult?.materials ?? null);
      console.log("Final price:", result.value.scrapeResult?.price ?? null);
      console.log("Final brand:", result.value.scrapeResult?.brand ?? null);
      console.log("Final name:", result.value.scrapeResult?.name ?? null);
    } else {
      console.log("\nFinal materials: (none)");
      console.log("Final price: (none)");
    }

    const foundErrors = [...result.run.warns, ...result.run.errors];
    if (result.thrown) foundErrors.push(format(result.thrown));
    console.log("\nErrors:");
    if (foundErrors.length === 0) {
      console.log("  (none)");
    } else {
      for (const err of foundErrors) console.log(" ", err);
    }

    if (result.value) {
      console.log("\n--- scrapeProductFromUrl return ---");
      console.log(JSON.stringify(result.value.scrapeResult, null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
