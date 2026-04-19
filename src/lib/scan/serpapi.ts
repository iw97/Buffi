/**
 * SerpAPI Google Shopping lookup — primary price source.
 * Requires SERPAPI_KEY in .env.local.
 */

const LOG_PREFIX = "[serpapi]";

export interface GoogleShoppingFirstResult {
  price: number;
  title: string;
  source: string;
}

export interface GoogleShoppingItem {
  title: string;
  link: string;
  price: number | null;
  source: string;
}

/** Remove currency symbols and non-numeric chars, then parse as float. */
function cleanPriceString(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isNaN(value) || value <= 0 ? null : value;
}

/**
 * Query Google Shopping via SerpAPI and return the first result's price.
 * Uses shopping_results[0].price (string), cleaned to a number.
 * Logs search query and raw price for verification.
 */
export async function getPriceFromGoogleShopping(
  query: string
): Promise<GoogleShoppingFirstResult | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey?.trim()) {
    console.log(LOG_PREFIX, "SERPAPI_KEY not set, skipping Google Shopping lookup");
    return null;
  }

  const trimmed = query.trim();
  if (!trimmed) {
    console.log(LOG_PREFIX, "empty query, skipping");
    return null;
  }

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: trimmed,
    api_key: apiKey
  });
  const url = `https://serpapi.com/search.json?${params.toString()}`;

  console.log(LOG_PREFIX, "search query:", trimmed);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(LOG_PREFIX, "SerpAPI request failed", res.status, res.statusText);
      return null;
    }

    const data = (await res.json()) as {
      shopping_results?: Array<{
        title?: string;
        source?: string;
        price?: string;
      }>;
      error?: string;
    };

    if (data.error) {
      console.warn(LOG_PREFIX, "SerpAPI error:", data.error);
      return null;
    }

    const results = data.shopping_results;
    if (!Array.isArray(results) || results.length === 0) {
      console.log(LOG_PREFIX, "no shopping results for query:", trimmed);
      return null;
    }

    const first = results[0];
    const rawPrice = first.price;
    if (rawPrice == null || typeof rawPrice !== "string" || !rawPrice.trim()) {
      console.log(LOG_PREFIX, "first result has no price", {
        title: first.title?.slice(0, 60),
        source: first.source
      });
      return null;
    }

    console.log(LOG_PREFIX, "raw price returned:", rawPrice);

    const price = cleanPriceString(rawPrice);
    if (price == null) {
      console.log(LOG_PREFIX, "could not parse price from:", rawPrice);
      return null;
    }

    const result: GoogleShoppingFirstResult = {
      price,
      title: first.title ?? "",
      source: first.source ?? ""
    };
    console.log(LOG_PREFIX, "first result:", {
      query: trimmed,
      title: result.title.slice(0, 60),
      source: result.source,
      price: result.price
    });
    return result;
  } catch (e) {
    console.warn(LOG_PREFIX, "fetch failed:", (e as Error).message);
    return null;
  }
}

/**
 * Google Shopping via SerpAPI — multiple results with product links (for better-alternatives).
 */
export async function getGoogleShoppingResults(query: string, limit: number): Promise<GoogleShoppingItem[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey?.trim()) {
    console.log(LOG_PREFIX, "SERPAPI_KEY not set, skipping multi-result Shopping");
    return [];
  }
  const trimmed = query.trim();
  if (!trimmed || limit <= 0) return [];

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: trimmed,
    api_key: apiKey
  });
  const url = `https://serpapi.com/search.json?${params.toString()}`;

  console.log(LOG_PREFIX, "multi search query:", trimmed.slice(0, 120), "limit:", limit);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      console.warn(LOG_PREFIX, "SerpAPI multi request failed", res.status);
      return [];
    }
    const data = (await res.json()) as {
      shopping_results?: Array<{
        title?: string;
        link?: string;
        product_link?: string;
        price?: string;
        source?: string;
      }>;
      error?: string;
    };
    if (data.error) {
      console.warn(LOG_PREFIX, "SerpAPI error:", data.error);
      return [];
    }
    const results = data.shopping_results;
    if (!Array.isArray(results) || results.length === 0) return [];

    const out: GoogleShoppingItem[] = [];
    for (const row of results) {
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const link = (typeof row.link === "string" && row.link.trim()
        ? row.link.trim()
        : typeof row.product_link === "string" && row.product_link.trim()
          ? row.product_link.trim()
          : "") || "";
      if (!title || !link) continue;
      if (!/^https?:\/\//i.test(link)) continue;
      const price =
        row.price != null && typeof row.price === "string" ? cleanPriceString(row.price) : null;
      out.push({
        title,
        link,
        price,
        source: typeof row.source === "string" ? row.source : ""
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.warn(LOG_PREFIX, "multi fetch failed:", (e as Error).message);
    return [];
  }
}

const FIBER_TOKEN_RE =
  /cotton|polyester|silk|wool|nylon|viscose|elastane|spandex|linen|leather|polyamide|modal|cashmere|acetate|acrylic|lyocell|ramie|hemp|cupro|triacetate/i;

/** Composition-like: must include % or a digit+%+fiber pattern (not marketing-only). */
function snippetLooksLikeCompositionText(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 800) return false;
  if (t.includes("%")) return true;
  if (/\d+\s*%\s*[a-zA-Z]/.test(t)) return true;
  return false;
}

/**
 * Google organic search via SerpAPI — used when luxury PDP composition is not in static HTML.
 * Requires SERPAPI_KEY.
 */
export async function getCompositionFromGoogleSearch(params: {
  brand: string;
  productName: string;
}): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey?.trim()) {
    console.log(LOG_PREFIX, "SERPAPI_KEY not set, skipping composition Google search");
    return null;
  }
  const brand = params.brand.trim();
  const productName = params.productName.trim();
  if (!brand || !productName) return null;

  const q = `${brand} ${productName} composition OR material OR fabric content`.trim();
  const url = `https://serpapi.com/search.json?${new URLSearchParams({
    engine: "google",
    q,
    api_key: apiKey,
    num: "10"
  })}`;

  console.log(LOG_PREFIX, "composition search query:", q.slice(0, 160));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      console.warn(LOG_PREFIX, "composition Google search failed", res.status, res.statusText);
      return null;
    }
    const data = (await res.json()) as {
      organic_results?: Array<{ snippet?: string; title?: string }>;
      error?: string;
    };
    if (data.error) {
      console.warn(LOG_PREFIX, "composition search SerpAPI error:", data.error);
      return null;
    }
    const rows = data.organic_results;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(LOG_PREFIX, "composition search: no organic results");
      return null;
    }

    let best = "";
    for (const row of rows) {
      const snippet = typeof row.snippet === "string" ? row.snippet.trim() : "";
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const chunk = snippet || title;
      if (!chunk) continue;
      if (!snippetLooksLikeCompositionText(chunk)) continue;
      if (!FIBER_TOKEN_RE.test(chunk)) continue;
      const candidate = snippet.length >= title.length ? snippet : `${title} ${snippet}`.trim();
      if (candidate.length > best.length) best = candidate;
    }

    if (!best) {
      console.log(LOG_PREFIX, "composition search: no snippet passed % / fiber heuristics");
      return null;
    }
    const out = best.slice(0, 500);
    console.log(LOG_PREFIX, "composition search: using snippet", out.slice(0, 120));
    return out;
  } catch (e) {
    console.warn(LOG_PREFIX, "composition search fetch failed:", (e as Error).message);
    return null;
  }
}
