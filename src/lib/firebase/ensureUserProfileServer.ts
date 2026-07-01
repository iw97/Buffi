import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { isReturningUserProfile } from "@/lib/auth/profileCreatedAt";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, type UserProfile } from "@/lib/firebase/types";

function userFieldMissing(data: Record<string, unknown>, key: string): boolean {
  return !(key in data) || data[key] === undefined;
}

function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as Timestamp;
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString();
    }
  }
  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }
  if (typeof value === "object" && value !== null && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return value;
}

export function serializeUserProfileDoc(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!data) return null;
  return serializeFirestoreValue(data) as Record<string, unknown>;
}

export type EnsureUserProfileAuthClaims = {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

/**
 * Ensures users/{uid} via Admin SDK (bypasses security rules).
 * Always merges — never replaces the full document.
 */
export async function ensureUserProfileAdmin(
  uid: string,
  claims: EnsureUserProfileAuthClaims,
  body?: {
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  },
  options?: { signInProvider?: string | null }
): Promise<Record<string, unknown>> {
  const adminFirestore = getAdminFirestore();
  if (!adminFirestore) {
    throw new Error("Server Firestore is not configured");
  }

  const ref = adminFirestore.collection(COLLECTIONS.USERS).doc(uid);
  const snap = await ref.get();
  const isNewUser = !snap.exists;
  const existing = (snap.exists ? snap.data() : {}) as Record<string, unknown>;

  const email = body?.email ?? claims.email ?? null;
  const displayName =
    body?.displayName?.trim() || claims.name?.trim() || (existing.displayName as string | undefined)?.trim() || "";
  const photoURL = body?.photoURL ?? claims.picture ?? "";
  const isAppleSignIn = options?.signInProvider === "apple.com";

  const mergePayload: Record<string, unknown> = {
    email,
    displayName,
    photoURL,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (userFieldMissing(existing, "createdAt")) {
    mergePayload.createdAt = FieldValue.serverTimestamp();
  }
  if (userFieldMissing(existing, "isPro")) mergePayload.isPro = false;
  if (userFieldMissing(existing, "completedScans")) mergePayload.completedScans = 0;
  if (isAppleSignIn) {
    mergePayload.onboardingComplete = true;
  } else if (isNewUser) {
    mergePayload.onboardingComplete = false;
  }
  if (userFieldMissing(existing, "scanCount")) mergePayload.scanCount = 0;
  if (userFieldMissing(existing, "scanCountResetAt")) {
    mergePayload.scanCountResetAt = FieldValue.serverTimestamp();
  }
  if (userFieldMissing(existing, "savedCount")) mergePayload.savedCount = 0;
  if (userFieldMissing(existing, "scannedCount")) mergePayload.scannedCount = 0;
  if (userFieldMissing(existing, "trapsAvoided")) mergePayload.trapsAvoided = 0;
  if (userFieldMissing(existing, "estimatedMoneySaved")) mergePayload.estimatedMoneySaved = 0;
  if (userFieldMissing(existing, "hasSeenRatingPrompt")) mergePayload.hasSeenRatingPrompt = false;

  console.log("[ensure-user-profile] set merge:true users/", uid);
  await ref.set(mergePayload, { merge: true });

  const after = await ref.get();
  if (!after.exists) {
    throw new Error("User document missing after ensure");
  }

  const serialized = serializeUserProfileDoc(after.data() as Record<string, unknown>);
  if (!serialized) {
    throw new Error("Failed to read user profile after ensure");
  }

  const profile = serialized as unknown as UserProfile;
  if (isReturningUserProfile(profile) && profile.onboardingComplete !== true) {
    await ref.set(
      { onboardingComplete: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    const final = await ref.get();
    const finalData = serializeUserProfileDoc(final.data() as Record<string, unknown>);
    if (!finalData) {
      throw new Error("Failed to read user profile after returning-user update");
    }
    return finalData;
  }

  return serialized;
}
