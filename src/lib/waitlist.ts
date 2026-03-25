/**
 * Marketing waitlist.
 *
 * Set `NEXT_PUBLIC_WAITLIST_URL` to your Google Form "view" URL (or any form URL).
 * CTAs navigate to `/waitlist`, which embeds the form in-page so users stay on Buffi.
 */

export function getWaitlistFormUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_WAITLIST_URL?.trim();
  return url && url.length > 0 ? url : null;
}

/**
 * Iframe `src` for the waitlist form. Google Forms need `?embedded=true`.
 */
export function getWaitlistEmbedSrc(): string | null {
  const raw = getWaitlistFormUrl();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const isGoogleForm =
      u.hostname === "docs.google.com" && u.pathname.includes("/forms/");

    if (isGoogleForm) {
      // Editor links like .../edit don't embed well — use viewform.
      u.pathname = u.pathname.replace(/\/edit\/?$/, "/viewform");
      u.hash = "";
      u.searchParams.set("embedded", "true");
      return u.toString();
    }

    return raw;
  } catch {
    return raw;
  }
}

/** In-app path for all “Join the waitlist” CTAs */
export const WAITLIST_PAGE_PATH = "/waitlist";
