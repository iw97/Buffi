import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

type IncrementResponse = {
  ok: true;
  completedScans: number;
  previousCompletedScans: number;
};

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<IncrementResponse | { error: string }>> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const currentRaw = snap.exists ? snap.get("completedScans") : 0;
      const previousCompletedScans =
        typeof currentRaw === "number" && Number.isFinite(currentRaw) ? Math.max(0, Math.floor(currentRaw)) : 0;
      const completedScans = previousCompletedScans + 1;

      tx.set(
        userRef,
        {
          completedScans,
          scannedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return { previousCompletedScans, completedScans };
    });

    return NextResponse.json({
      ok: true,
      completedScans: result.completedScans,
      previousCompletedScans: result.previousCompletedScans
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Increment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
