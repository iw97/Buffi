import { NextRequest, NextResponse } from "next/server";
import { scrapeProductFromUrl } from "@/lib/scan/scrape";
import { lookupBarcode } from "@/lib/scan/barcode";
import { analyzeWithClaude } from "@/lib/scan/analyze";
import type { RawProductData, ScanResult, ScanError } from "@/lib/scan/types";

export async function POST(req: NextRequest): Promise<NextResponse<ScanResult | ScanError>> {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : undefined;
    const barcode = typeof body?.barcode === "string" ? body.barcode.trim() : undefined;
    const composition = typeof body?.composition === "string" ? body.composition.trim() : undefined;
    const brand = typeof body?.brand === "string" ? body.brand.trim() || undefined : undefined;
    const price = typeof body?.price === "number" && body.price > 0 ? body.price : undefined;

    const hasUrl = !!url;
    const hasBarcode = !!barcode;
    const hasTag = !!composition;

    if ([hasUrl, hasBarcode, hasTag].filter(Boolean).length > 1) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide only one of: url, barcode, or composition (tag)" },
        { status: 400 }
      );
    }

    let raw: RawProductData;

    if (url) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return NextResponse.json(
          { ok: false, code: "invalid_input", message: "Invalid URL" },
          { status: 400 }
        );
      }
      const scraped = await scrapeProductFromUrl(url);
      if (!scraped || (!scraped.name && !scraped.brand && !scraped.price)) {
        return NextResponse.json(
          { ok: false, code: "url_scrape_failed", message: "Could not extract product data from URL" },
          { status: 422 }
        );
      }
      raw = { ...scraped, url, source: "url" };
    } else if (barcode) {
      const lookedUp = await lookupBarcode(barcode);
      if (!lookedUp || (!lookedUp.name && !lookedUp.brand)) {
        return NextResponse.json(
          { ok: false, code: "product_not_found", message: "Product not found in barcode database" },
          { status: 404 }
        );
      }
      raw = { ...lookedUp, barcode, source: "barcode" };
    } else if (composition) {
      raw = {
        materials: composition,
        brand,
        price,
        source: "tag"
      };
    } else {
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide url, barcode, or composition in request body" },
        { status: 400 }
      );
    }

    const analysis = await analyzeWithClaude(raw);
    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === "claude_timeout") {
      return NextResponse.json(
        { ok: false, code: "claude_timeout", message: "Analysis timed out" },
        { status: 504 }
      );
    }
    console.error("[api/scan]", e);
    return NextResponse.json(
      { ok: false, code: "unknown", message: e.message || "Scan failed" },
      { status: 500 }
    );
  }
}
