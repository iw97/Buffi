/**
 * Canonical public site origin (metadata, Firebase email-link `continueUrl`, etc.).
 *
 * Vercel production: set `NEXT_PUBLIC_APP_URL=https://buffi.app`.
 * Vercel previews: `VERCEL_URL` is set per deployment; Next injects it into the client
 * bundle as `NEXT_PUBLIC_VERCEL_URL` via `next.config.js` so magic links use the preview host.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
