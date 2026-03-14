"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { firestore, firebaseAuth } from "./client";
import { COLLECTIONS, type UserProfile, type SavedItem, type ScanHistoryEntry, type ProductMapping } from "./types";

function timestampToIso(t: unknown): string {
  if (t && typeof (t as Timestamp).toDate === "function") return (t as Timestamp).toDate().toISOString();
  if (typeof t === "string") return t;
  return "";
}

function getDb() {
  if (!firestore) throw new Error("Firestore not initialized");
  return firestore;
}

function requireAuth(operation: string): boolean {
  if (typeof window === "undefined") return false;
  if (!firebaseAuth?.currentUser) {
    console.warn("[Firestore] skipped (not authenticated):", operation);
    return false;
  }
  return true;
}

async function withFirestoreLog<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[Firestore] error on operation:", operation, e);
    throw e;
  }
}

/** Get user profile doc */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const op = "getUserProfile(users/" + uid + ")";
  if (!requireAuth(op)) return null;
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = doc(db, COLLECTIONS.USERS, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  });
}

/**
 * Ensure a user document exists in users/{uid}. If it exists, do nothing.
 * If not (new signup or first time), create it with email, displayName, and default fields.
 * Call from onAuthStateChanged to handle both new signups and returning users.
 */
export async function ensureUserDocument(
  uid: string,
  email: string | null,
  displayName: string | null,
  photoURL?: string | null
): Promise<void> {
  const op = "ensureUserDocument(users/" + uid + ")";
  if (!requireAuth(op)) return;
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = doc(db, COLLECTIONS.USERS, uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      email: email ?? null,
      displayName: displayName ?? "",
      photoURL: photoURL ?? null,
      createdAt: serverTimestamp(),
      isPro: false,
      scanCount: 0,
      scanCountResetAt: serverTimestamp(),
      saveCount: 0,
      savedCount: 0,
      scannedCount: 0
    });
  });
}

/** Set/update user profile (merge) */
export async function setUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.USERS, uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** Normalize saved item from Firestore (timestamps → ISO string) */
function toSavedItem(docId: string, data: Record<string, unknown>): SavedItem {
  return {
    id: docId,
    userId: (data.userId as string) ?? "",
    brandName: (data.brandName as string) ?? "",
    itemName: (data.itemName as string) ?? "",
    price: (data.price as number) ?? 0,
    estimatedMaterialCost: (data.estimatedMaterialCost as number) ?? 0,
    markup: (data.markup as number) ?? 0,
    markupBand: (data.markupBand as string) ?? "",
    fibers: Array.isArray(data.fibers) ? (data.fibers as string[]) : [],
    verdict: (data.verdict as "trap" | "win" | "think_twice") ?? "win",
    verdictReason: (data.verdictReason as string) ?? "",
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    isEstimated: (data.isEstimated as boolean) ?? true,
    confidenceTier: (data.confidenceTier as number) ?? 0,
    savedAt: timestampToIso(data.savedAt)
  };
}

/** Saved items: top-level collection with userId */
export async function getSavedItems(uid: string): Promise<SavedItem[]> {
  const op = "getSavedItems(savedItems?userId=" + uid + ")";
  if (!requireAuth(op)) return [];
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
    const q = query(
      ref,
      where("userId", "==", uid),
      orderBy("savedAt", "desc"),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toSavedItem(d.id, d.data()));
  });
}

/** Subscribe to saved items for real-time list */
export function subscribeSavedItems(
  uid: string,
  onItems: (items: SavedItem[]) => void
): Unsubscribe {
  const op = "subscribeSavedItems(savedItems?userId=" + uid + ")";
  if (!requireAuth(op)) return () => {};
  const db = getDb();
  const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
  const q = query(
    ref,
    where("userId", "==", uid),
    orderBy("savedAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => toSavedItem(d.id, d.data()));
      onItems(items);
    },
    (err) => console.error("[Firestore] error on operation:", op, err)
  );
}

/** Add a saved item */
export async function addSavedItem(
  uid: string,
  item: Omit<SavedItem, "id" | "userId" | "savedAt">
): Promise<string> {
  const op = "addSavedItem(savedItems)";
  if (!requireAuth(op)) return "";
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
    const docRef = await addDoc(ref, {
      ...item,
      userId: uid,
      savedAt: serverTimestamp()
    });
    return docRef.id;
  });
}

/** Remove a saved item */
export async function removeSavedItem(itemId: string): Promise<void> {
  const op = "removeSavedItem(savedItems/" + itemId + ")";
  if (!requireAuth(op)) return;
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = doc(db, COLLECTIONS.SAVED_ITEMS, itemId);
    await deleteDoc(ref);
  });
}

/** Add a scan history entry (e.g. after a scan). expiresAt is set to 90 days from now. */
export async function addScanHistoryEntry(
  uid: string,
  entry: Omit<ScanHistoryEntry, "id" | "userId" | "scannedAt" | "expiresAt">
): Promise<string> {
  const op = "addScanHistoryEntry(scanHistory)";
  if (!requireAuth(op)) return "";
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = collection(db, COLLECTIONS.SCAN_HISTORY);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const docRef = await addDoc(ref, {
      ...entry,
      userId: uid,
      scannedAt: serverTimestamp(),
      expiresAt: expiresAt.toISOString()
    });
    return docRef.id;
  });
}

/** Get product mappings (read-only). For write, use server-side API with Firebase Admin SDK. */
export async function getProductMappings(gtin?: string): Promise<ProductMapping[]> {
  const op = "getProductMappings(productMappings" + (gtin ? "?gtin=" + gtin : "") + ")";
  if (!requireAuth(op)) return [];
  return withFirestoreLog(op, async () => {
    const db = getDb();
    const ref = collection(db, COLLECTIONS.PRODUCT_MAPPINGS);
    const q = gtin
      ? query(ref, where("gtin", "==", gtin), limit(20))
      : query(ref, limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        gtin: (data.gtin as string) ?? "",
        productUrl: (data.productUrl as string) ?? "",
        brand: (data.brand as string) ?? "",
        confirmedAt: timestampToIso(data.confirmedAt),
        confirmedByUserId: (data.confirmedByUserId as string) ?? ""
      } as ProductMapping;
    });
  });
}
