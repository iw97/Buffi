/** Trailing token in a slug segment that looks like a style / color code (not a garment word). */
const STYLE_CODE_TOKEN = /^[A-Z0-9]{5,12}$/i;

const GARMENT_WORD = new Set([
  "top",
  "shirt",
  "dress",
  "jacket",
  "coat",
  "pants",
  "jeans",
  "shorts",
  "skirt",
  "sweater",
  "hoodie",
  "leggings",
  "swimwear",
  "blouse",
  "blazer",
  "trousers",
  "knitwear",
  "sportswear",
  "womens",
  "mens",
  "women",
  "men",
  "unisex",
  "oversized",
  "track"
]);

const PATH_NOISE = new Set([
  "t",
  "p",
  "product",
  "products",
  "shop",
  "en",
  "us",
  "uk",
  "ca",
  "eu",
  "fr",
  "de",
  "it",
  "es",
  "jp",
  "au",
  "collections",
  "collection",
  "category",
  "categories",
  "item",
  "items"
]);

/** Separate path segment that looks like a SKU (e.g. IO1473-663). */
function isSkuSegment(segment: string): boolean {
  return /^[A-Z]{1,4}\d{3,}[-/]?\d*$/i.test(segment) || /^[A-Z0-9]+-\d{3,}$/i.test(segment);
}

function isStyleCodeToken(token: string): boolean {
  if (GARMENT_WORD.has(token.toLowerCase())) return false;
  return STYLE_CODE_TOKEN.test(token);
}

/** Remove trailing style-code token from a hyphenated slug (e.g. …-jacket-6LX7H0NQ → …-jacket). */
export function stripTrailingStyleCode(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (isStyleCodeToken(last)) {
      parts.pop();
      continue;
    }
    break;
  }
  return parts.join("-");
}

export function slugToProductName(slug: string): string {
  const keepUpper = new Set(["uv", "upf", "spf", "dna", "pro"]);
  const cleaned = stripTrailingStyleCode(slug);
  return cleaned
    .split("-")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (keepUpper.has(lower)) return lower.toUpperCase();
      if (word.length <= 3 && /^[A-Z0-9]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function brandFromHostname(hostname: string): string {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  const skip = new Set(["www", "shop", "store", "m", "mobile", "www2"]);
  const brandPart =
    parts.find((p) => !skip.has(p) && p.length > 2 && !/^[a-z]{2}$/.test(p)) ?? parts[0] ?? "";
  if (!brandPart) return "";
  return brandPart.charAt(0).toUpperCase() + brandPart.slice(1).toLowerCase();
}

/**
 * Best-effort product slug from a retailer URL pathname.
 * Prefers the hyphenated segment before a trailing SKU segment.
 */
export function productSlugFromPathname(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const candidates = segments.filter((s) => {
    const lower = s.toLowerCase();
    if (PATH_NOISE.has(lower)) return false;
    if (isSkuSegment(s)) return false;
    return s.includes("-") && /[a-z]/i.test(s);
  });

  if (candidates.length === 0) {
    const fallback = segments.find((s) => !PATH_NOISE.has(s.toLowerCase()) && !isSkuSegment(s) && s.length > 3);
    return fallback ?? null;
  }

  return candidates.sort((a, b) => b.length - a.length)[0];
}

export function parseProductFromUrl(url: string): { brand: string; name: string } | null {
  try {
    const normalized = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const parsed = new URL(normalized);
    const brand = brandFromHostname(parsed.hostname);
    const slug = productSlugFromPathname(parsed.pathname);
    const name = slug ? slugToProductName(slug) : "";
    if (!brand && !name) return null;
    return {
      brand: brand || "Unknown",
      name: name || "Product"
    };
  } catch {
    return null;
  }
}
