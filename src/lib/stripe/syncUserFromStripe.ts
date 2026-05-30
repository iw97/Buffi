import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

function subscriptionGrantsPro(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

async function mergeUserAdmin(uid: string, patch: Record<string, unknown>): Promise<void> {
  const db = getAdminFirestore();
  if (!db) throw new Error("Admin Firestore not configured");
  await db.collection(COLLECTIONS.USERS).doc(uid).set(
    {
      ...patch,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function resolveUidFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const metaUid = sub.metadata?.firebaseUid?.trim();
  if (metaUid) return metaUid;

  const db = getAdminFirestore();
  if (!db) return null;

  const bySub = await db.collection(COLLECTIONS.USERS).where("stripeSubscriptionId", "==", sub.id).limit(1).get();
  if (!bySub.empty) return bySub.docs[0].id;

  const custId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!custId) return null;
  const byCust = await db.collection(COLLECTIONS.USERS).where("stripeCustomerId", "==", custId).limit(1).get();
  if (!byCust.empty) return byCust.docs[0].id;

  return null;
}

export async function applyStripeSubscriptionToUser(
  uid: string,
  customerId: string,
  sub: Stripe.Subscription
): Promise<void> {
  const periodEnd =
    sub.current_period_end != null ? Timestamp.fromMillis(sub.current_period_end * 1000) : null;
  await mergeUserAdmin(uid, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    isPro: subscriptionGrantsPro(sub.status),
    proExpiresAt: periodEnd
  });
}

export async function applyLifetimePurchase(uid: string, customerId: string): Promise<void> {
  await mergeUserAdmin(uid, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: FieldValue.delete(),
    subscriptionStatus: "lifetime",
    isPro: true,
    proExpiresAt: null
  });
}

export async function applySubscriptionDeleted(uid: string): Promise<void> {
  await mergeUserAdmin(uid, {
    isPro: false,
    subscriptionStatus: "canceled",
    proExpiresAt: FieldValue.delete()
  });
}
