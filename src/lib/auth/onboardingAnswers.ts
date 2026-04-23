/**
 * Utilities for persisting onboarding answers across the flow and flushing
 * them to Firestore after the user signs up.
 *
 * localStorage is used (not sessionStorage) so answers survive tab switches —
 * magic-link sign-in opens in a new tab, which would otherwise lose answers.
 */

import { setUserProfile } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/firebase/types";

export const OB_KEYS = [
  "buffi_ob_name",
  "buffi_ob_regret",
  "buffi_ob_quality",
  "buffi_ob_awareness",
  "buffi_ob_values",    // JSON: string[]
  "buffi_ob_priorities", // JSON: Record<string, number>
  "buffi_ob_shopper",
] as const;

export type ObKey = (typeof OB_KEYS)[number];

export function saveObAnswer(key: ObKey, value: string): void {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

export function getObAnswer(key: ObKey): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function clearObAnswers(): void {
  OB_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * Read all onboarding answers from localStorage, write them to Firestore
 * on the user's profile, then clear the local keys.
 *
 * Safe to call even when Firebase isn't configured (no-op) or when
 * sessionStorage is empty (nothing to flush).
 *
 * @param uid - Firebase UID of the newly signed-in user
 * @param googleDisplayName - displayName already set by the auth provider (Google).
 *   If provided and truthy, we skip overwriting it with the onboarding name.
 */
export async function flushOnboardingAnswers(
  uid: string,
  googleDisplayName?: string | null
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isFirebaseConfigured()) return;

  const name = localStorage.getItem("buffi_ob_name")?.trim() || null;
  const regret = localStorage.getItem("buffi_ob_regret") || null;
  const quality = localStorage.getItem("buffi_ob_quality") || null;
  const awareness = localStorage.getItem("buffi_ob_awareness") || null;
  const shopperType = localStorage.getItem("buffi_ob_shopper") || null;

  let valuesSelected: string[] | undefined;
  try {
    const raw = localStorage.getItem("buffi_ob_values");
    if (raw) valuesSelected = JSON.parse(raw) as string[];
  } catch {
    // malformed — ignore
  }

  let priorities: Record<string, number> | undefined;
  try {
    const raw = localStorage.getItem("buffi_ob_priorities");
    if (raw) priorities = JSON.parse(raw) as Record<string, number>;
  } catch {
    // malformed — ignore
  }

  // Always clear local answers after reading, regardless of whether there's
  // anything to write, so stale data doesn't bleed into future sign-ins.
  clearObAnswers();

  const patch: Partial<UserProfile> = {};
  if (regret) patch.onboardingRegret = regret;
  if (quality) patch.onboardingQuality = quality;
  if (awareness) patch.onboardingAwareness = awareness;
  if (shopperType) patch.shopperType = shopperType;
  if (valuesSelected?.length) patch.valuesSelected = valuesSelected;
  if (priorities && Object.keys(priorities).length > 0) patch.priorities = priorities;
  // Only set displayName from onboarding name if the auth provider didn't supply one
  if (name && !googleDisplayName) patch.displayName = name;

  if (Object.keys(patch).length === 0) return;

  await setUserProfile(uid, patch);
}
