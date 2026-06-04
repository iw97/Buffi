import type { EmailLinkMode } from "@/lib/auth/emailLinkCallback";
import { safeReturnPath } from "@/lib/auth/returnTo";

const PENDING_KEY = "buffi_magic_link_pending";
const SKIP_GATE_KEY = "buffi_skip_onboarding_gate";

type PendingMagicLink = {
  mode: EmailLinkMode;
  returnTo: string;
};

/** Saved when sending a link; used if Firebase strips query params from the callback URL. */
export function savePendingMagicLink(options: { mode: EmailLinkMode; returnTo?: string }): void {
  if (typeof window === "undefined") return;
  const payload: PendingMagicLink = {
    mode: options.mode,
    returnTo: safeReturnPath(options.returnTo, "/scan")
  };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readPendingMagicLink(): PendingMagicLink | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMagicLink;
    if (parsed.mode !== "signin" && parsed.mode !== "signup") return null;
    return {
      mode: parsed.mode,
      returnTo: safeReturnPath(parsed.returnTo, "/scan")
    };
  } catch {
    return null;
  }
}

export function clearPendingMagicLink(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** After email-link sign-in, land on /scan once without OnboardingGate redirect. */
export function markSkipOnboardingGateOnce(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SKIP_GATE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeSkipOnboardingGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(SKIP_GATE_KEY) !== "1") return false;
    sessionStorage.removeItem(SKIP_GATE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign-in magic link → always /scan.
 * Sign-up (after onboarding quiz) → saved returnTo.
 */
export function destinationAfterMagicLink(fullUrl: string): string {
  const url = new URL(fullUrl);
  const pending = readPendingMagicLink();
  const mode = url.searchParams.get("mode") === "signup" || url.searchParams.get("mode") === "signin"
    ? (url.searchParams.get("mode") as EmailLinkMode)
    : pending?.mode ?? "signin";

  clearPendingMagicLink();

  if (mode === "signup") {
    const returnTo = safeReturnPath(
      url.searchParams.get("returnTo") ?? pending?.returnTo,
      "/scan"
    );
    return returnTo;
  }

  return "/scan";
}
