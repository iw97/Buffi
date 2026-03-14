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
