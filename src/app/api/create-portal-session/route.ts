import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { getServerPublicAppUrl } from "@/lib/publicAppUrl";
import { COLLECTIONS } from "@/lib/firebase/types";
import { getStripe } from "@/lib/stripe/server";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<{ url?: string; error?: string }>> {
  const adminAuth = getAdminAuth();
  const db = getAdminFirestore();
  const stripe = getStripe();

  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
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

  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const customerId =
    typeof userSnap.get("stripeCustomerId") === "string"
      ? (userSnap.get("stripeCustomerId") as string).trim()
      : "";

  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer on file" }, { status: 400 });
  }

  try {
    const base = getServerPublicAppUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/profile`
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not create portal session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[create-portal-session] failed for", uid, e);
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}
