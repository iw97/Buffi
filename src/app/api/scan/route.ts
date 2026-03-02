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

    if (url && barcode) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide either url or barcode, not both" },
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
    } else {
      return NextResponse.json(
        { ok: false, code: "invalid_input", message: "Provide url or barcode in request body" },
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
