import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { COLLECTIONS } from "./types";
import { getStripe } from "@/lib/stripe/server";

const BATCH_SIZE = 200;

async function deleteQueryBatch(
  db: Firestore,
  collectionName: string,
  userId: string
): Promise<number> {
  const snap = await db
    .collection(collectionName)
    .where("userId", "==", userId)
    .limit(BATCH_SIZE)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}

async function deleteAllDocsForUser(db: Firestore, collectionName: string, userId: string): Promise<void> {
  let total = 0;
  for (;;) {
    const n = await deleteQueryBatch(db, collectionName, userId);
    total += n;
    if (n < BATCH_SIZE) break;
  }
  if (total > 0) {
    console.log(`[delete-account] removed ${total} doc(s) from ${collectionName} for`, userId);
  }
}

async function cancelStripeSubscription(uid: string, db: Firestore): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  if (!userSnap.exists) return;

  const subId = userSnap.data()?.stripeSubscriptionId;
  if (typeof subId !== "string" || !subId.trim()) return;

  try {
    await stripe.subscriptions.cancel(subId.trim());
    console.log("[delete-account] canceled Stripe subscription", subId);
  } catch (e) {
    console.warn("[delete-account] Stripe subscription cancel failed:", (e as Error).message);
  }
}

/**
 * Permanently delete a user's Firestore data and Firebase Auth account.
 * Caller must verify the uid matches the authenticated user.
 */
export async function deleteUserAccountServer(
  db: Firestore,
  adminAuth: Auth,
  uid: string
): Promise<void> {
  await cancelStripeSubscription(uid, db);
  await deleteAllDocsForUser(db, COLLECTIONS.SAVED_ITEMS, uid);
  await deleteAllDocsForUser(db, COLLECTIONS.SCAN_HISTORY, uid);
  await db.collection(COLLECTIONS.USERS).doc(uid).delete();
  await adminAuth.deleteUser(uid);
  console.log("[delete-account] deleted user", uid);
}
