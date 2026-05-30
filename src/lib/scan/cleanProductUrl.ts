/**
 * Strip tracking query params and canonicalize known retailer URLs before fetch / storage.
 */

const TRACKING_EXACT = new Set([
  "gclid",
  "gbraid",
  "ds_agid",
  "kwid",
  "tid",
  "ap",
  "gclsrc",
  "fbclid",
  "ttclid",
  "msclkid"
]);

export function isGapFamilyHost(hostLower: string): boolean {
  const h = hostLower.toLowerCase();
  return h === "gap.com" || h.endsWith(".gap.com");
}

function isTrackingParam(key: string, gapHost: boolean): boolean {
  const lower = key.toLowerCase();
  if (lower.startsWith("utm_")) return true;
  if (lower.startsWith("gad_")) return true;
  if (TRACKING_EXACT.has(lower)) return true;
  if (lower === "vid" && !gapHost) return true;
  return false;
}

function stripTrackingSearchParams(u: URL, gapHost: boolean): void {
  const keys = [...u.searchParams.keys()];
  for (const key of keys) {
    if (isTrackingParam(key, gapHost)) u.searchParams.delete(key);
  }
}

/**
 * Gap / Old Navy / Banana Republic (gap.com family): when `pid` is present, canonicalize to
 * `https://{host}/browse/product.do?pid=...` (tracking and other params dropped).
 * If `pid` is missing, strip tracking only and keep params like `vid` (color variant).
 */
export function cleanProductUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    u.hash = "";
    const hostLower = u.hostname.toLowerCase();
    const gap = isGapFamilyHost(hostLower);

    if (gap) {
      const pid = u.searchParams.get("pid")?.trim();
      if (pid) {
        const canon = new URL(`https://${hostLower}/browse/product.do`);
        canon.searchParams.set("pid", pid);
        return canon.toString();
      }
    }

    const out = new URL(u.toString());
    out.hash = "";
    /** Shein mobile serves a different shell than desktop; canonicalize for scrape + cache. */
    if (out.hostname.toLowerCase() === "m.shein.com") {
      out.hostname = "www.shein.com";
    }
    stripTrackingSearchParams(out, gap);
    const q = out.searchParams.toString();
    out.search = q ? `?${q}` : "";
    return out.toString();
  } catch {
    return trimmed;
  }
}
