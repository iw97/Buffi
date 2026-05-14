import { NextRequest, NextResponse } from "next/server";
import { getPriceFromGoogleShopping } from "@/lib/scan/serpapi";
import { getAdminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest): Promise<NextResponse<{ price: number | null } | { error: string }>> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: "Server auth not configured" }, { status: 500 });
  }

  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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
