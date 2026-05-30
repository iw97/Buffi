import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import { currentPlanFromSubscription, retentionOfferForDeleteAccount } from "@/lib/stripe/subscriptionPlan";
import { getStripe } from "@/lib/stripe/server";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminAuth = getAdminAuth();
  const db = getAdminFirestore();
  const stripe = getStripe();

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

  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const data = userSnap.data();
  const subscriptionStatus = typeof data?.subscriptionStatus === "string" ? data.subscriptionStatus : null;
  const subId = typeof data?.stripeSubscriptionId === "string" ? data.stripeSubscriptionId : null;

  if (!stripe || !subId || subscriptionStatus === "lifetime" || subscriptionStatus === "canceled") {
    return NextResponse.json({ retentionOffer: null });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.status !== "active" && sub.status !== "trialing") {
      return NextResponse.json({ retentionOffer: null });
    }
    const currentPlan = currentPlanFromSubscription(sub);
    const retentionOffer = retentionOfferForDeleteAccount(currentPlan);
    return NextResponse.json({ retentionOffer, currentPlan });
  } catch (e) {
    console.error("[delete-account/preflight]", e);
    return NextResponse.json({ retentionOffer: null });
  }
}
