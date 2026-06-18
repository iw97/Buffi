import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

// RevenueCat webhook event — only the fields we use
export interface RCEvent {
  type: string;
  app_user_id: string;
  product_id: string;
  expiration_at_ms: number | null;
  environment: "PRODUCTION" | "SANDBOX";
}

export interface RCWebhookPayload {
  api_version: string;
  event: RCEvent;
}

async function mergeUserAdmin(uid: string, patch: Record<string, unknown>): Promise<void> {
  const db = getAdminFirestore();
  if (!db) throw new Error("Admin Firestore not configured");
  await db.collection(COLLECTIONS.USERS).doc(uid).set(
    { ...patch, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function isLifetimeProduct(productId: string): boolean {
  return productId === "app.buffi.lifetime";
}

export async function applyRCPurchaseEvent(event: RCEvent): Promise<void> {
  const uid = event.app_user_id?.trim();
  if (!uid) {
    console.error("[rc webhook] event missing app_user_id", event.type);
    return;
  }

  const lifetime = isLifetimeProduct(event.product_id);
  const proExpiresAt =
    lifetime || event.expiration_at_ms == null
      ? null
      : Timestamp.fromMillis(event.expiration_at_ms);

  await mergeUserAdmin(uid, {
    isPro: true,
    subscriptionStatus: lifetime ? "lifetime" : "active",
    proExpiresAt,
    // clear any leftover Stripe subscription id so the profile
    // doesn't try to open the Stripe portal for an RC subscriber
    stripeSubscriptionId: stripeSubscriptionId(event),
  });
}

// Only keep stripeSubscriptionId if it was already set — don't overwrite it
// with undefined from the RC event; just leave whatever's already there.
function stripeSubscriptionId(_event: RCEvent): typeof FieldValue.delete | undefined {
  return undefined;
}

export async function applyRCExpirationEvent(event: RCEvent): Promise<void> {
  const uid = event.app_user_id?.trim();
  if (!uid) return;
  await mergeUserAdmin(uid, {
    isPro: false,
    subscriptionStatus: "expired",
    proExpiresAt: FieldValue.delete(),
  });
}

export async function dispatchRCEvent(event: RCEvent): Promise<void> {
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
      await applyRCPurchaseEvent(event);
      return;

    case "EXPIRATION":
      await applyRCExpirationEvent(event);
      return;

    // CANCELLATION means the user cancelled but still has time left —
    // don't revoke isPro until EXPIRATION fires.
    case "CANCELLATION":
    case "BILLING_ISSUE":
    case "TRANSFER":
    case "SUBSCRIBER_ALIAS":
    default:
      return;
  }
}
