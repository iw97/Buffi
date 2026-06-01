import { getObAnswer } from "@/lib/auth/onboardingAnswers";
import type { UserProfile } from "@/lib/firebase/types";
import { safeReturnPath } from "@/lib/auth/returnTo";

/** Quiz answers are flushed at account creation; shopper type is the last required step. */
export function profileHasCompletedOnboarding(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.shopperType?.trim());
}

/** Answers saved in localStorage during the quiz, before account step. */
export function hasLocalOnboardingAnswers(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getObAnswer("buffi_ob_shopper")?.trim());
}

export function onboardingIntroPath(returnTo = "/scan"): string {
  const safe = safeReturnPath(returnTo, "/scan");
  return `/onboarding/intro?${new URLSearchParams({ returnTo: safe }).toString()}`;
}

export function isBrandNewFirebaseUser(user: {
  metadata: { creationTime?: string | null; lastSignInTime?: string | null };
}): boolean {
  const created = user.metadata.creationTime ?? null;
  const last = user.metadata.lastSignInTime ?? null;
  return Boolean(created && last && created === last);
}

/**
 * Where to send the user immediately after auth completes.
 * New accounts skip onboarding only when quiz answers are already in localStorage
 * (account step right after reflection).
 */
export function resolvePostAuthPath(options: {
  returnTo?: string | null;
  profile?: UserProfile | null;
  user?: { metadata: { creationTime?: string | null; lastSignInTime?: string | null } } | null;
}): string {
  const returnTo = safeReturnPath(options.returnTo, "/scan");

  if (profileHasCompletedOnboarding(options.profile)) {
    return returnTo;
  }

  if (hasLocalOnboardingAnswers()) {
    return returnTo;
  }

  if (options.user && isBrandNewFirebaseUser(options.user)) {
    return onboardingIntroPath(returnTo);
  }

  return returnTo;
}
