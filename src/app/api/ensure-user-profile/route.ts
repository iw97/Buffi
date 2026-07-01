import { NextRequest, NextResponse } from "next/server";
import { ensureUserProfileAdmin } from "@/lib/firebase/ensureUserProfileServer";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

type EnsureUserProfileBody = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest) {
  const adminAuth = getAdminAuth();
  const adminFirestore = getAdminFirestore();
  if (!adminAuth || !adminFirestore) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let body: EnsureUserProfileBody = {};
  try {
    const text = await req.text();
    const trimmed = text.trim();
    if (trimmed) {
      body = JSON.parse(trimmed) as EnsureUserProfileBody;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    console.log("[ensure-user-profile] token uid:", decoded.uid);

    const profile = await ensureUserProfileAdmin(
      decoded.uid,
      {
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null
      },
      {
        email: body.email,
        displayName: body.displayName,
        photoURL: body.photoURL
      },
      {
        signInProvider: decoded.firebase?.sign_in_provider ?? null
      }
    );

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to ensure user profile";
    const status =
      message.toLowerCase().includes("token") || message.toLowerCase().includes("unauthorized")
        ? 401
        : 500;
    console.error("[ensure-user-profile]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
