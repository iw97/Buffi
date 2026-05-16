import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { analyzeAlternatives } from "@/lib/scan/analyzeAlternatives";
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

    // Tag scans produce no product name, so garment type is unknown — alternatives
    // would match on fiber only and return wrong garment types. Skip until a
    // product database exists to resolve tag scans to named products.
    const productName = (body.name ?? "").trim();
    if (productName.length < 4) {
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
