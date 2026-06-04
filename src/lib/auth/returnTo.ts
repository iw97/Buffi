/** Allowlisted in-app paths after sign-in (blocks open redirects). */
export function safeReturnPath(raw: string | null | undefined, fallback = "/scan"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const t = raw.trim().split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("://")) return fallback;
  return t;
}

/** Query suffix to pass `returnTo` between onboarding steps (empty if no param). */
export function onboardingReturnToQuery(searchParams: { get: (k: string) => string | null }): string {
  const raw = searchParams.get("returnTo");
  if (!raw?.trim()) return "";
  const safe = safeReturnPath(raw, "/scan");
  return `?${new URLSearchParams({ returnTo: safe }).toString()}`;
}
