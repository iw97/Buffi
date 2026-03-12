import { NextRequest, NextResponse } from "next/server";
import { scrapeProductFromUrl } from "@/lib/scan/scrape";
import { lookupBarcode } from "@/lib/scan/barcode";
import { analyzeWithClaude, analyzeMinimalScan } from "@/lib/scan/analyze";
import type { RawProductData, ScanResult, ScanError } from "@/lib/scan/types";

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
      console.log("[api/scan] scraping URL", url.slice(0, 60));
      const scraped = await scrapeProductFromUrl(url);
      console.log("[api/scan] scrape result", scraped ? { name: !!scraped.name, brand: !!scraped.brand, price: !!scraped.price } : "null");
      if (!scraped || (!scraped.name && !scraped.brand && !scraped.price)) {
        console.log("[api/scan] scrape failed or empty");
        return NextResponse.json(
          { ok: false, code: "url_scrape_failed", message: "Could not extract product data from URL" },
          { status: 422 }
        );
      }
      raw = { ...scraped, url, source: "url" };
      console.log("[api/scan] raw built from URL, calling Claude");
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

    console.log("[api/scan] calling analyzeWithClaude");
    const analysis = await analyzeWithClaude(raw);
    console.log("[api/scan] Claude analysis received, returning 200");
    return NextResponse.json({ ok: true, analysis });
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
