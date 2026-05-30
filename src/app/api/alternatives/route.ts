import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { analyzeAlternatives } from "@/lib/scan/analyzeAlternatives";
import { isGarmentCategoryId } from "@/lib/scan/garmentCategories";
import { getThumbnailForQuery } from "@/lib/scan/serpapi";
import type { ScanAnalysis, AlternativeSuggestion } from "@/lib/scan/types";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<AlternativeSuggestion[] | { error: string }>> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: "Server auth not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<ScanAnalysis>;

    const productName = (body.name ?? "").trim();
    const hasUserGarmentCategory = isGarmentCategoryId(body.garmentCategory);
    // Tag scans without a product name need a user-confirmed garment type for alternatives.
    if (productName.length < 4 && !hasUserGarmentCategory) {
      return NextResponse.json([]);
    }

    const alternatives = await analyzeAlternatives(body as ScanAnalysis);
    const enriched = await Promise.all(
      alternatives.map(async (alt) => ({
        ...alt,
        imageUrl: await getThumbnailForQuery(alt.searchQuery).catch(() => null)
      }))
    );
    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json([]);
  }
}
