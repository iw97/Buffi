import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import { deleteUserAccountServer } from "@/lib/firebase/deleteUserAccountServer";
import { sendAccountDeletedEmail } from "@/lib/email/sendAccountDeletedEmail";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<{ ok?: boolean; error?: string }>> {
  const adminAuth = getAdminAuth();
  const db = getAdminFirestore();

  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    const profile = userSnap.data() ?? {};
    let email =
      typeof profile.email === "string" && profile.email.trim()
        ? profile.email.trim()
        : "";
    if (!email) {
      try {
        const authUser = await adminAuth.getUser(uid);
        email = authUser.email?.trim() || "(unknown)";
      } catch {
        email = "(unknown)";
      }
    }
    const isPro = profile.isPro === true;
    const stripeCustomerId =
      typeof profile.stripeCustomerId === "string" && profile.stripeCustomerId.trim()
        ? profile.stripeCustomerId.trim()
        : "(none)";
    const deletedAt = new Date().toISOString();

    await deleteUserAccountServer(db, adminAuth, uid);

    void sendAccountDeletedEmail({
      uid,
      email,
      isPro,
      stripeCustomerId,
      deletedAt
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete-account] failed for", uid, e);
    return NextResponse.json(
      { error: "Could not delete account. Please try again or contact support." },
      { status: 500 }
    );
  }
}
