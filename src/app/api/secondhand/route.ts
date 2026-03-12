import { NextRequest, NextResponse } from "next/server";
import type { SecondhandResult, SecondhandResponse } from "@/lib/secondhand/types";

const LOG = "[api/secondhand]";

function sortByPriceAsc(a: SecondhandResult, b: SecondhandResult): number {
  const pa = a.price ?? Infinity;
  const pb = b.price ?? Infinity;
  return pa - pb;
}

/** ThredUp: no public API; return search link as one "result" so user can open it. */
function thredUpSearchUrl(query: string): string {
  return `https://www.thredup.com/search?q=${encodeURIComponent(query)}`;
}

/** Depop: no public search API; return search link. */
function depopSearchUrl(query: string): string {
  return `https://www.depop.com/search/?q=${encodeURIComponent(query)}`;
}

/** eBay Finding API (REST). Returns items with title, price, viewItemURL. */
async function searchEbay(query: string): Promise<SecondhandResult[]> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId?.trim()) {
    console.log(LOG, "EBAY_APP_ID not set, skipping eBay");
    return [];
  }
  const base = "https://svcs.ebay.com/services/search/FindingService/v1";
  const params = new URLSearchParams({
    "OPERATION-NAME": "findItemsByKeywords",
    "SECURITY-APPNAME": appId.trim(),
    keywords: query,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    "paginationInput.entriesPerPage": "10"
  });
  const url = `${base}?${params.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      findItemsByKeywordsResponse?: Array<{
        searchResult?: Array<{
          item?: Array<{
            title?: string[];
            viewItemURL?: string[];
            sellingStatus?: Array<{ currentPrice?: Array<{ __value__?: string }> }>;
          }>;
        }>;
      }>;
    };
    const items =
      data.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item ?? [];
    return items
      .map((it) => {
        const title = Array.isArray(it.title) ? it.title[0] : it.title;
        const viewItemURL = Array.isArray(it.viewItemURL) ? it.viewItemURL[0] : it.viewItemURL;
        const priceStr =
          it.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ??
          (it.sellingStatus?.[0]?.currentPrice?.[0] as unknown as { value?: string })?.value;
        const price = priceStr != null ? parseFloat(String(priceStr)) : null;
        if (!title || !viewItemURL) return null;
        return {
          title: String(title).slice(0, 120),
          price: typeof price === "number" && !Number.isNaN(price) ? price : null,
          platform: "eBay",
          url: String(viewItemURL)
        } as SecondhandResult;
      })
      .filter((r): r is SecondhandResult => r != null);
  } catch (e) {
    console.warn(LOG, "eBay search failed", (e as Error).message);
    return [];
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SecondhandResponse | { error: string }>> {
  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const isPro = body?.isPro === true;

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const [ebayItems] = await Promise.all([
      searchEbay(query)
    ]);

    const thredUpLink: SecondhandResult = {
      title: `Search ThredUp for "${query.slice(0, 50)}${query.length > 50 ? "…" : ""}"`,
      price: null,
      platform: "ThredUp",
      url: thredUpSearchUrl(query)
    };
    const depopLink: SecondhandResult = {
      title: `Search Depop for "${query.slice(0, 50)}${query.length > 50 ? "…" : ""}"`,
      price: null,
      platform: "Depop",
      url: depopSearchUrl(query)
    };

    const all: SecondhandResult[] = [...ebayItems, thredUpLink, depopLink].sort(sortByPriceAsc);
    const limit = isPro ? 3 : 1;
    const results = all.slice(0, limit);

    return NextResponse.json({ results });
  } catch (e) {
    console.error(LOG, (e as Error).message);
    return NextResponse.json({ error: "Secondhand search failed" }, { status: 500 });
  }
}
