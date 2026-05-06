/**
 * Canonical public site origin (metadata, Firebase email-link `continueUrl`, etc.).
 *
 * - **Production:** set `NEXT_PUBLIC_APP_URL=https://buffi.app` in Vercel (Production env).
 * - **Previews:** leave `NEXT_PUBLIC_APP_URL` unset for Preview; in the browser we use
 *   `window.location.origin` so the magic link matches the tab (avoids build-time `VERCEL_URL`
 *   pointing at `*.vercel.app` while the user opened a different host, which triggers
 *   `auth/unauthorized-continue-uri`).
 * - **Server / metadata:** falls back to `VERCEL_URL` (via `NEXT_PUBLIC_VERCEL_URL` in next.config).
 */
/** Server-side origin for Stripe redirects, webhooks, metadata (no `window`). */
export function getServerPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
