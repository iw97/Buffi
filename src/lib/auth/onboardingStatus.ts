import { getObAnswer } from "@/lib/auth/onboardingAnswers";
import type { UserProfile } from "@/lib/firebase/types";
import { safeReturnPath } from "@/lib/auth/returnTo";

/** Quiz done, explicit flag, or legacy profiles with shopper type only. */
export function profileHasCompletedOnboarding(profile: UserProfile | null | undefined): boolean {
  if (profile?.onboardingComplete === true) return true;
  return Boolean(profile?.shopperType?.trim());
}

/** Answers saved in localStorage during the quiz, before account step. */
export function hasLocalOnboardingAnswers(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getObAnswer("buffi_ob_shopper")?.trim());
}

/** Gate may redirect only after profile loaded successfully (not API error / still loading). */
export function shouldGateRedirectToOnboarding(options: {
  profileReady: boolean;
  profileError: string | null;
  profile: UserProfile | null;
}): boolean {
  if (options.profileError) return false;
  if (!options.profileReady) return false;
  return !profileHasCompletedOnboarding(options.profile);
}

export function onboardingIntroPath(returnTo = "/scan"): string {
  const safe = safeReturnPath(returnTo, "/scan");
  return `/onboarding/intro?${new URLSearchParams({ returnTo: safe }).toString()}`;
}

/**
 * Where to send the user immediately after auth completes.
 * Sign-in (/signin): always return to the app — returning users should not redo onboarding.
 * Sign-up (account step after quiz): go to app.
 */
export function resolvePostAuthPath(options: {
  returnTo?: string | null;
  profile?: UserProfile | null;
  /** `signup` = auth from /onboarding/account after the quiz. */
  authMode?: "signup" | "signin";
}): string {
  const returnTo = safeReturnPath(options.returnTo, "/scan");

  if (options.authMode === "signup" || options.authMode === "signin") {
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
