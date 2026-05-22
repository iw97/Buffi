import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { getServerPublicAppUrl } from "@/lib/publicAppUrl";
import { COLLECTIONS } from "@/lib/firebase/types";
import type { PaywallPlanId } from "@/lib/paywall/planIds";
import { getStripePriceIdForPlan } from "@/lib/stripe/priceIds";
import { getStripe } from "@/lib/stripe/server";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function isPaywallPlanId(v: unknown): v is PaywallPlanId {
  return v === "weekly" || v === "monthly" || v === "yearly" || v === "lifetime";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = (body as { plan?: unknown })?.plan;
  if (!isPaywallPlanId(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = getStripePriceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured for this plan" }, { status: 500 });
  }

  const base = getServerPublicAppUrl();
  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const existingCustomerId =
    typeof userSnap.get("stripeCustomerId") === "string" ? (userSnap.get("stripeCustomerId") as string) : undefined;

  const email = typeof userSnap.get("email") === "string" ? (userSnap.get("email") as string) : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === "lifetime" ? "payment" : "subscription",
      ...(existingCustomerId ? { customer: existingCustomerId } : email ? { customer_email: email } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/upgrade`,
      metadata: { firebaseUid: uid },
      ...(plan === "lifetime"
        ? {}
        : {
            subscription_data: {
              metadata: { firebaseUid: uid }
            }
          })
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    console.error("[create-checkout-session]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
