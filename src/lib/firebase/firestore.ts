"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { isFirestorePermissionDenied } from "@/lib/firebase/firestoreErrors";
import { COLLECTIONS, type UserProfile, type SavedItem, type ScanHistoryEntry } from "./types";

export { getFirestoreErrorCode, isFirestorePermissionDenied } from "@/lib/firebase/firestoreErrors";

const PROFILE_READ_MAX_ATTEMPTS = 3;
const PROFILE_READ_RETRY_BASE_MS = 500;

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
  if (!auth?.currentUser) {
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

/** Get user profile doc (retries on permission-denied while auth token propagates). */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const op = "getUserProfile(users/" + uid + ")";
  if (!requireAuth(op)) return null;

  let lastError: unknown;
  for (let attempt = 0; attempt < PROFILE_READ_MAX_ATTEMPTS; attempt++) {
    try {
      return await withFirestoreLog(op, async () => {
        const db = getDb();
        const ref = doc(db, COLLECTIONS.USERS, uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return snap.data() as UserProfile;
      });
    } catch (error) {
      if (!isFirestorePermissionDenied(error) || attempt === PROFILE_READ_MAX_ATTEMPTS - 1) {
        throw error;
      }
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, PROFILE_READ_RETRY_BASE_MS * (attempt + 1))
      );
    }
  }

  throw lastError;
}

function userFieldMissing(data: Record<string, unknown>, key: string): boolean {
  return !(key in data) || data[key] === undefined;
}

/**
 * @deprecated Login uses POST /api/ensure-user-profile (Admin SDK). Client writes can fail with permission-denied.
 * Ensures users/{uid} has required profile + counter fields.
 * Uses setDoc(merge: true) so existing values are kept; only fills keys that are missing or undefined.
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
    const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (userFieldMissing(data, "email")) patch.email = email ?? null;
    if (userFieldMissing(data, "displayName")) patch.displayName = displayName ?? "";
    if (userFieldMissing(data, "photoURL")) patch.photoURL = photoURL ?? "";
    if (userFieldMissing(data, "createdAt")) patch.createdAt = serverTimestamp();
    if (userFieldMissing(data, "updatedAt")) patch.updatedAt = serverTimestamp();
    if (userFieldMissing(data, "isPro")) patch.isPro = false;
    if (userFieldMissing(data, "scanCount")) patch.scanCount = 0;
    if (userFieldMissing(data, "completedScans")) patch.completedScans = 0;
    if (userFieldMissing(data, "scanCountResetAt")) patch.scanCountResetAt = serverTimestamp();
    if (userFieldMissing(data, "savedCount")) patch.savedCount = 0;
    if (userFieldMissing(data, "scannedCount")) patch.scannedCount = 0;
    if (userFieldMissing(data, "trapsAvoided")) patch.trapsAvoided = 0;
    if (userFieldMissing(data, "estimatedMoneySaved")) patch.estimatedMoneySaved = 0;

    if (Object.keys(patch).length === 0) return;

    await setDoc(ref, patch, { merge: true });
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

/** Atomically increment scannedCount on the user document. */
export async function incrementScannedCount(uid: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(ref, { scannedCount: increment(1), updatedAt: serverTimestamp() });
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
    firstScan: (data.firstScan as boolean) ?? false,
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

