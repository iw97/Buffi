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
import { firestore } from "./client";
import { COLLECTIONS, type UserProfile, type SavedItem } from "./types";

function getDb() {
  if (!firestore) throw new Error("Firestore not initialized");
  return firestore;
}

/** Get user profile doc */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
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

/** Saved items: top-level collection with userId */
export async function getSavedItems(uid: string): Promise<SavedItem[]> {
  const db = getDb();
  const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
  const q = query(
    ref,
    where("userId", "==", uid),
    orderBy("savedAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedItem));
}

/** Subscribe to saved items for real-time list */
export function subscribeSavedItems(
  uid: string,
  onItems: (items: SavedItem[]) => void
): Unsubscribe {
  const db = getDb();
  const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
  const q = query(
    ref,
    where("userId", "==", uid),
    orderBy("savedAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedItem));
    onItems(items);
  });
}

/** Add a saved item */
export async function addSavedItem(
  uid: string,
  item: Omit<SavedItem, "id" | "userId" | "savedAt">
): Promise<string> {
  const db = getDb();
  const ref = collection(db, COLLECTIONS.SAVED_ITEMS);
  const docRef = await addDoc(ref, {
    ...item,
    userId: uid,
    savedAt: new Date().toISOString()
  });
  return docRef.id;
}

/** Remove a saved item */
export async function removeSavedItem(itemId: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.SAVED_ITEMS, itemId);
  await deleteDoc(ref);
}
