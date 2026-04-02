/** Allowlisted in-app paths after sign-in (blocks open redirects). */
export function safeReturnPath(raw: string | null | undefined, fallback = "/scan"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("://")) return fallback;
  return t;
}
