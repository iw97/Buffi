import type { Timestamp } from "firebase/firestore";
import type { UserProfile } from "@/lib/firebase/types";

/** Account created within this window is treated as a new magic-link signup session. */
export const NEW_USER_SESSION_MS = 60_000;

export function getProfileCreatedAtMs(profile: UserProfile): number | null {
  const createdAt = profile.createdAt;
  if (!createdAt) return null;
  if (typeof createdAt === "string") {
    const ms = Date.parse(createdAt);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof (createdAt as Timestamp).toDate === "function") {
    return (createdAt as Timestamp).toDate().getTime();
  }
  return null;
}

/** True when the Firestore user doc was created in the last 60 seconds (new account this session). */
export function isProfileNewThisSession(profile: UserProfile | null | undefined): boolean {
  if (!profile) return true;
  const ms = getProfileCreatedAtMs(profile);
  if (ms === null) return true;
  return Date.now() - ms < NEW_USER_SESSION_MS;
}

/** Existing user: document exists and was not created in the last 60 seconds. */
export function isReturningUserProfile(profile: UserProfile | null | undefined): boolean {
  return profile !== null && !isProfileNewThisSession(profile);
}
