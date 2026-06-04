import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  DEMO_REVIEW_EMAIL,
  isDemoReviewCode,
  isDemoReviewEmail,
  normalizeAuthEmail
} from "@/lib/auth/demoAccount";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo-sign-in — App Store review bypass.
 * Issues a Firebase custom token for review@buffi.app when the static code matches.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown }).email === "string"
      ? normalizeAuthEmail((body as { email: string }).email)
      : "";
  const code =
    typeof (body as { code?: unknown }).code === "string"
      ? (body as { code: string }).code.trim()
      : "";

  if (!isDemoReviewEmail(email) || !isDemoReviewCode(code)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(DEMO_REVIEW_EMAIL);
    uid = existing.uid;
  } catch {
    const created = await adminAuth.createUser({
      email: DEMO_REVIEW_EMAIL,
      emailVerified: true,
      displayName: "App Review"
    });
    uid = created.uid;
  }

  const db = getAdminFirestore();
  if (db) {
    await db.collection("users").doc(uid).set(
      {
        email: DEMO_REVIEW_EMAIL,
        displayName: "App Review",
        shopperType: "All three — I'm done settling",
        isPro: false,
        scanCount: 0,
        completedScans: 0,
        savedCount: 0,
        scannedCount: 0,
        trapsAvoided: 0,
        estimatedMoneySaved: 0,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const token = await adminAuth.createCustomToken(uid);
  return NextResponse.json({ token });
}
