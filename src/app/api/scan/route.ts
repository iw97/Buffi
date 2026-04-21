import { NextRequest, NextResponse } from "next/server";
import { cleanProductUrl } from "@/lib/scan/cleanProductUrl";
import { scrapeProductFromUrl } from "@/lib/scan/scrape";
import { getPriceFromGoogleShopping } from "@/lib/scan/serpapi";
import { lookupBarcode } from "@/lib/scan/barcode";
import { analyzeWithClaude, analyzeMinimalScan } from "@/lib/scan/analyze";
import type { RawProductData, ScanResult, ScanError, ScanAnalysis } from "@/lib/scan/types";
import { extractGtinAndUpsertMapping } from "@/lib/firebase/productMappingsServer";
import {
  getCacheTtlDays,
  getCachedProductScanIfFresh,
  productScanToScanAnalysis,
  recordProductScan
} from "@/lib/firebase/productScansServer";

/** Allow Bright Data Web Unlocker (~3–8s) plus scrape + Claude without platform timeout. */
export const maxDuration = 30;

function isZaraUrl(url: string | undefined): boolean {
  return typeof url === "string" && /(^|\.)zara\.com$/i.test(new URL(url).hostname);
}

function applyZaraConfidence(analysis: ScanAnalysis, sourceUrl: string): ScanAnalysis {
  if (!isZaraUrl(sourceUrl)) return analysis;
  return { ...analysis, confidenceTier: 2 };
}

export async function POST(req: NextRequest): Promise<NextResponse<ScanResult | ScanError | unknown>> {
  console.log("[api/scan] POST received");
  try {
    const body = await req.json();
    console.log("[api/scan] body parsed", { keys: Object.keys(body || {}), hasUrl: !!body?.url });

    const url = typeof body?.url === "string" ? body.url.trim() : undefined;
    const barcode = typeof body?.barcode === "string" ? body.barcode.trim() : undefined;
    const composition = typeof body?.composition === "string" ? body.composition.trim() : undefined;
    const brand = typeof body?.brand === "string" ? body.brand.trim() || undefined : undefined;
    const price = typeof body?.price === "number" && body.price > 0 ? body.price : undefined;
    const selectedValues = Array.isArray(body?.selectedValues)
      ? (body.selectedValues as string[]).filter((s): s is string => typeof s === "string")
      : [];

    const brandName = typeof body?.brandName === "string" ? body.brandName.trim() : undefined;
    const fibers = Array.isArray(body?.fibers) ? (body.fibers as string[]).filter((f) => typeof f === "string") : undefined;
    const minimalPrice = typeof body?.price === "number" ? body.price : undefined;
    const confidenceTier = typeof body?.confidenceTier === "number" ? body.confidenceTier : undefined;

    const hasUrl = !!url;
    const hasBarcode = !!barcode;
    const hasTag = !!composition;
    const hasMinimal =
      !!brandName &&
      !!fibers?.length &&
      minimalPrice !== undefined &&
      minimalPrice >= 0 &&
      confidenceTier !== undefined;

    console.log("[api/scan] input flags", { hasUrl, hasBarcode, hasTag, hasMinimal, url: url?.slice(0, 50) });

    if (hasMinimal && !hasUrl && !hasBarcode && !hasTag) {
      console.log("[api/scan] using minimal scan path");
      const result = await analyzeMinimalScan({
        brandName,
        fibers,
        price: minimalPrice,
        confidenceTier
      });
      console.log("[api/scan] minimal scan result received");
      return NextResponse.json(result);
    }

    if ([hasUrl, hasBarcode, hasTag].filter(Boolean).length > 1) {
      console.log("[api/scan] invalid: multiple input types");
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide only one of: url, barcode, or composition (tag)" },
        { status: 400 }
      );
    }

    let raw: RawProductData;

    if (url) {
      console.log("[api/scan] URL flow, validating URL");
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        console.log("[api/scan] URL invalid scheme");
        return NextResponse.json(
          { ok: false, code: "invalid_input", message: "Invalid URL" },
          { status: 400 }
        );
      }

      const productUrl = cleanProductUrl(url);

      const ttlDays = getCacheTtlDays();
      try {
        const cached = await getCachedProductScanIfFresh(productUrl, ttlDays);
        if (cached) {
          console.log(`[scan] cache hit for ${productUrl}`);
          const analysis = applyZaraConfidence(productScanToScanAnalysis(cached), productUrl);
          return NextResponse.json({ ok: true, source: "cache", analysis });
        }
      } catch (cacheErr) {
        console.warn("[api/scan] productScans cache lookup failed:", (cacheErr as Error).message);
      }

      console.log(`[scan] fresh scan for ${productUrl}`);
      console.log("[api/scan] scraping URL", productUrl.slice(0, 60));
      const scraped = await scrapeProductFromUrl(productUrl);
      console.log("[api/scan] scrape result", scraped ? { name: !!scraped.name, brand: !!scraped.brand, price: !!scraped.price } : "null");
      if (!scraped || (!scraped.name && !scraped.brand)) {
        console.log("[api/scan] scrape failed or empty (need at least name or brand)");
        return NextResponse.json(
          { ok: false, code: "url_scrape_failed", message: "Could not extract product data from URL" },
          { status: 422 }
        );
      }
      let scrapedWithPrice = { ...scraped };
      const query = [scraped.brand, scraped.name].filter(Boolean).join(" ").trim();
      const isZara = isZaraUrl(productUrl);

      if (isZara && query) {
        const prior = scraped.price;
        const serpResult = await getPriceFromGoogleShopping(query);
        if (serpResult) {
          scrapedWithPrice = { ...scrapedWithPrice, price: serpResult.price };
          console.log(
            "[api/scan] Zara: SerpAPI price lookup succeeded:",
            serpResult.price,
            "query:",
            query.slice(0, 100),
            "priorPriceFromScrape:",
            prior ?? "none"
          );
        } else {
          console.log(
            "[api/scan] Zara: SerpAPI price lookup failed or empty; keeping scrape/API price:",
            prior ?? "none",
            "query:",
            query.slice(0, 100)
          );
        }
      } else if ((scraped.name || scraped.brand) && (scraped.price == null || scraped.price <= 0)) {
        if (query) {
          const serpResult = await getPriceFromGoogleShopping(query);
          if (serpResult) {
            scrapedWithPrice = { ...scraped, price: serpResult.price };
            console.log("[api/scan] price from SerpAPI Google Shopping:", serpResult.price, "query:", query);
          } else {
            console.log("[api/scan] SerpAPI returned no matching result; manual price entry may be used");
          }
        }
      }
      raw = { ...scrapedWithPrice, url: productUrl, source: "url" };
      console.log("[api/scan] raw built from URL", raw.price != null ? `price=${raw.price}` : "no price (manual fallback)");
    } else if (barcode) {
      console.log("[api/scan] barcode flow, looking up", barcode.slice(0, 16));
      const lookedUp = await lookupBarcode(barcode);
      console.log("[api/scan] barcode lookup result", lookedUp ? "found" : "null");
      if (!lookedUp || (!lookedUp.name && !lookedUp.brand)) {
        console.log("[api/scan] product not found for barcode");
        return NextResponse.json(
          { ok: false, code: "product_not_found", message: "Product not found in barcode database" },
          { status: 404 }
        );
      }
      raw = { ...lookedUp, barcode, source: "barcode" };
      console.log("[api/scan] raw built from barcode, calling Claude");
    } else if (composition) {
      console.log("[api/scan] tag/composition flow");
      raw = {
        materials: composition,
        brand,
        price,
        source: "tag"
      };
      console.log("[api/scan] raw built from tag, calling Claude");
    } else {
      console.log("[api/scan] no valid input");
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide url, barcode, or composition in request body" },
        { status: 400 }
      );
    }

    console.log("[api/scan] calling analyzeWithClaude", selectedValues.length ? { selectedValuesCount: selectedValues.length } : "");
    let analysis = await analyzeWithClaude(raw, selectedValues);
    if (raw.source === "url" && typeof raw.url === "string") {
      analysis = applyZaraConfidence(analysis, raw.url);
    }
    if (raw.source === "url" && raw.materialsFromSerpSearch) {
      analysis = { ...analysis, confidenceTier: 2, isEstimated: true };
    }
    if (raw.imageUrl != null) analysis.imageUrl = raw.imageUrl;
    if (raw.source === "url" && typeof raw.url === "string" && raw.url.trim()) {
      const u = raw.url.trim();
      void Promise.all([recordProductScan(u, analysis), extractGtinAndUpsertMapping(u, analysis.brand, analysis.name)]).catch(
        (e) => console.warn("[api/scan] background productScans/productMappings failed:", (e as Error).message)
      );
    }
    console.log("[api/scan] Claude analysis received, returning 200");
    return NextResponse.json({ ok: true, source: "live", analysis });
  } catch (err) {
    const e = err as Error & { code?: string };
    console.error("[api/scan] catch", e?.message, e);
    if (e.code === "claude_timeout") {
      return NextResponse.json(
        { ok: false, code: "claude_timeout", message: "Analysis timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { ok: false, code: "unknown", message: e.message || "Scan failed" },
      { status: 500 }
    );
  }
}
