import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

// RevenueCat webhook event — only the fields we use
export interface RCEvent {
  type: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  environment?: "PRODUCTION" | "SANDBOX";
  /** TRANSFER events use these instead of app_user_id */
  transferred_from?: string[];
  transferred_to?: string[];
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

function isLifetimeProduct(productId: string | undefined): boolean {
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
  });
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

async function applyRCTransferEvent(event: RCEvent): Promise<void> {
  const toIds = event.transferred_to ?? [];
  // Prefer the Firebase UID (not RevenueCat anonymous IDs like $RCAnonymousID:…)
  const realUid = toIds.find((id) => typeof id === "string" && !id.startsWith("$RC"));
  if (!realUid) {
    console.warn("[rc webhook] TRANSFER has no non-anonymous transferred_to id", toIds);
    return;
  }

  await mergeUserAdmin(realUid, {
    isPro: true,
    subscriptionStatus: "active",
  });
  console.log("[rc webhook] TRANSFER applied isPro to:", realUid);
}

export async function dispatchRCEvent(event: RCEvent): Promise<void> {
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
      await applyRCPurchaseEvent(event);
      return;

    case "TRANSFER":
      await applyRCTransferEvent(event);
      return;

    case "EXPIRATION":
      await applyRCExpirationEvent(event);
      return;

    // CANCELLATION means the user cancelled but still has time left —
    // don't revoke isPro until EXPIRATION fires.
    case "CANCELLATION":
    case "BILLING_ISSUE":
    case "SUBSCRIBER_ALIAS":
    default:
      return;
  }
}
