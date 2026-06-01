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

/**
 * Where to send the user immediately after auth completes.
 * Sign-in: incomplete profiles go to the quiz. Sign-up (account step after quiz): go to app.
 */
export function resolvePostAuthPath(options: {
  returnTo?: string | null;
  profile?: UserProfile | null;
  /** `signup` = auth from /onboarding/account after the quiz. */
  authMode?: "signup" | "signin";
}): string {
  const returnTo = safeReturnPath(options.returnTo, "/scan");

  if (options.authMode === "signup") {
    return returnTo;
  }

  if (profileHasCompletedOnboarding(options.profile)) {
    return returnTo;
  }

  if (hasLocalOnboardingAnswers()) {
    return returnTo;
  }

  return onboardingIntroPath(returnTo);
}
