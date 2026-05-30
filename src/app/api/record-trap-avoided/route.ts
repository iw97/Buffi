import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

type RecordTrapResponse = {
  ok: true;
  trapsAvoided: number;
  estimatedMoneySaved: number;
};

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function readNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<RecordTrapResponse | { error: string }>> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const price = readNonNegativeNumber((body as { price?: unknown })?.price);
  if (price == null) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists || snap.get("isPro") !== true) {
        return { forbidden: true as const };
      }

      tx.set(
        userRef,
        {
          trapsAvoided: FieldValue.increment(1),
          estimatedMoneySaved: FieldValue.increment(price),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      const trapsRaw = snap.get("trapsAvoided");
      const savingsRaw = snap.get("estimatedMoneySaved");
      const trapsAvoided =
        (typeof trapsRaw === "number" && Number.isFinite(trapsRaw) ? Math.max(0, Math.floor(trapsRaw)) : 0) + 1;
      const estimatedMoneySaved =
        (typeof savingsRaw === "number" && Number.isFinite(savingsRaw) ? Math.max(0, savingsRaw) : 0) + price;

      return { forbidden: false as const, trapsAvoided, estimatedMoneySaved };
    });

    if (result.forbidden) {
      return NextResponse.json({ error: "Buffi Pro required" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      trapsAvoided: result.trapsAvoided,
      estimatedMoneySaved: result.estimatedMoneySaved
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record trap avoided";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
