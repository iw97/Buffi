import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import type { PaywallPlanId } from "@/lib/paywall/planIds";
import { switchSubscriptionPlanForUser } from "@/lib/stripe/switchSubscriptionPlan";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function isSwitchablePlan(v: unknown): v is PaywallPlanId {
  return v === "weekly" || v === "monthly" || v === "yearly";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = (body as { plan?: unknown })?.plan;
  const source =
    typeof (body as { source?: unknown })?.source === "string"
      ? (body as { source: string }).source
      : "subscription_switch";

  if (!isSwitchablePlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const customerId = userSnap.get("stripeCustomerId");
  const subId = userSnap.get("stripeSubscriptionId");

  if (typeof customerId !== "string" || !customerId || typeof subId !== "string" || !subId) {
    return NextResponse.json({ error: "No active subscription to update" }, { status: 400 });
  }

  try {
    await switchSubscriptionPlanForUser(uid, customerId, subId, plan, source);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not switch plan";
    console.error("[subscription/switch-plan]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
