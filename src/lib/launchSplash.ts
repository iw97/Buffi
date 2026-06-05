import { onboardingIntroPath } from "@/lib/auth/onboardingStatus";

/**
 * First-install splash flag (localStorage). Shown once per device/browser profile.
 * Not used for user profile data — install UX only.
 */
export const LAUNCH_SPLASH_STORAGE_KEY = "buffi_launch_splash_seen";

/** After first-install splash: start onboarding at the name step. */
export const POST_SPLASH_PATH = onboardingIntroPath("/scan");

const SKIP_PREFIXES = [
  "/splash",
  "/auth/",
  "/onboarding",
  "/privacy",
  "/terms",
  "/about",
  "/faq",
  "/waitlist"
];

export function hasSeenLaunchSplash(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LAUNCH_SPLASH_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLaunchSplashSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAUNCH_SPLASH_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowLaunchSplash(pathname: string): boolean {
  if (pathname === "/") return false;
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return false;
  return true;
}
