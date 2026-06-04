import { BUFFI_SIGNIN_EMAIL_KEY } from "@/lib/firebase";
import { normalizeAuthEmail } from "@/lib/auth/demoAccount";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { getPublicAppUrl } from "@/lib/publicAppUrl";

const LOGIN_EMAIL_COOKIE = "buffi_signin_email";

export type EmailLinkMode = "signup" | "signin";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Continue URL embedded in the magic link email (params preserved by Firebase). */
export function buildEmailLinkCallbackUrl(options: {
  email: string;
  returnTo?: string;
  mode: EmailLinkMode;
}): string {
  const returnTo = safeReturnPath(options.returnTo, "/scan");
  const base = getPublicAppUrl();
  const callback = new URL("/auth/callback", `${base}/`);
  callback.searchParams.set("mode", options.mode);
  callback.searchParams.set("returnTo", returnTo);
  callback.searchParams.set("loginEmail", normalizeAuthEmail(options.email));
  return callback.toString();
}

/** Remember email on the device that requested the link (same-browser fallback). */
export function persistLoginEmailForLink(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAuthEmail(email);
  try {
    window.localStorage.setItem(BUFFI_SIGNIN_EMAIL_KEY, normalized);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOGIN_EMAIL_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=7200; samesite=lax`;
  } catch {
    /* ignore */
  }
}

/** Resolve email when completing the link (mail app / new tab safe). */
export function readLoginEmailForLink(fullUrl: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(fullUrl);
    const fromQuery = url.searchParams.get("loginEmail")?.trim();
    if (fromQuery && isValidEmail(fromQuery)) {
      return normalizeAuthEmail(fromQuery);
    }
  } catch {
    /* ignore */
  }

  try {
    const fromStorage = window.localStorage.getItem(BUFFI_SIGNIN_EMAIL_KEY)?.trim();
    if (fromStorage && isValidEmail(fromStorage)) {
      return normalizeAuthEmail(fromStorage);
    }
  } catch {
    /* ignore */
  }

  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOGIN_EMAIL_COOKIE}=([^;]*)`));
    const fromCookie = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
    if (fromCookie && isValidEmail(fromCookie)) {
      return normalizeAuthEmail(fromCookie);
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function clearPersistedLoginEmailForLink(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BUFFI_SIGNIN_EMAIL_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOGIN_EMAIL_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    /* ignore */
  }
}
