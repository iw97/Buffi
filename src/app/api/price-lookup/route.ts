import { NextRequest, NextResponse } from "next/server";
import { getPriceFromGoogleShopping } from "@/lib/scan/serpapi";

export async function POST(req: NextRequest): Promise<NextResponse<{ price: number | null }>> {
  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ price: null });
    }
    const result = await getPriceFromGoogleShopping(query);
    return NextResponse.json({ price: result?.price ?? null });
  } catch {
    return NextResponse.json({ price: null });
  }
}
