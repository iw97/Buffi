/**
 * Zara-specific extraction: internal JSON APIs first (JS-heavy PDP), then HTML, Claude title parse, with logging.
 */

import { parseZaraOuterShellComposition, pickCompositionFromStrings } from "./zaraComposition";

const LOG = "[zara]";

const ZARA_ORIGIN = "https://www.zara.com";

/** US-ish catalog defaults; Zara may require different store/category IDs per region. */
const ITX_STORE_ID = "11719";
const ITX_CATEGORY_ID = "10701";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

export type ZaraScrapeMethod =
  | "zara_extra_detail"
  | "zara_itxrest_detail"
  | "zara_html_dom"
  | "zara_api_merged"
  | "zara_slug_serpapi";

function normalizePrice(n: number): number | undefined {
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return undefined;
  if (n > 500 && Number.isInteger(n)) {
    const asMajor = n / 100;
    if (asMajor > 0 && asMajor < 5000) return asMajor;
  }
  if (n > 10_000) return undefined;
  return Math.round(n * 100) / 100;
}

/** e.g. ...-p02633808.html or /p02633808.html → p02633808 */
export function extractZaraProductId(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/(p\d{6,})\.html(?:$|[?#])/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** e.g. /100-herringbone-linen-fitted-blazer-p02633808.html -> "100 Herringbone Linen Fitted Blazer" */
export function extractZaraNameFromUrlSlug(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const leaf = pathname.split("/").filter(Boolean).pop();
    if (!leaf) return undefined;
    const withoutHtml = leaf.replace(/\.html$/i, "");
    const noProductId = withoutHtml.replace(/-p\d{6,}$/i, "");
    const words = noProductId
      .split("-")
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return undefined;
    return words.map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ").trim();
  } catch {
    return undefined;
  }
}

/** /us/en/... → /us/en */
function zaraLocalePrefix(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/^\/([a-z]{2}\/[a-z]{2})\b/i);
    return m ? `/${m[1].toLowerCase()}` : "/us/en";
  } catch {
    return "/us/en";
  }
}

function walkCollectStrings(val: unknown, out: string[], depth = 0): void {
  if (depth > 14) return;
  if (typeof val === "string") {
    const t = val.trim();
    if (t.length > 3) out.push(t);
    return;
  }
  if (Array.isArray(val)) {
    for (const x of val) walkCollectStrings(x, out, depth + 1);
    return;
  }
  if (val && typeof val === "object") {
    for (const v of Object.values(val)) walkCollectStrings(v, out, depth + 1);
  }
}

function findPricesInObject(obj: unknown): number[] {
  const found: number[] = [];
  function walk(x: unknown, depth: number): void {
    if (depth > 18 || x == null) return;
    if (typeof x === "number" && x > 0) found.push(x);
    if (typeof x === "string") {
      const m = x.match(/[\d,]+\.?\d*/);
      if (m) {
        const n = parseFloat(m[0].replace(/,/g, ""));
        if (!Number.isNaN(n) && n > 0) found.push(n);
      }
    }
    if (Array.isArray(x)) {
      for (const i of x) walk(i, depth + 1);
      return;
    }
    if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if (/price|amount|value|minPrice|maxPrice/i.test(k)) walk(v, depth + 1);
        else walk(v, depth + 1);
      }
    }
  }
  walk(obj, 0);
  return found;
}

function pickPriceFromJson(data: unknown): number | undefined {
  const nums = findPricesInObject(data);
  if (nums.length === 0) return undefined;
  const reasonable = nums.filter((n) => n > 0.5 && n < 50_000);
  if (reasonable.length === 0) return undefined;
  const sorted = [...new Set(reasonable)].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return normalizePrice(mid);
}

function pickNameFromJson(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const direct = ["name", "productName", "commercialName", "title", "displayName"] as const;
  for (const k of direct) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 2) return v.trim();
  }
  const strings: string[] = [];
  walkCollectStrings(data, strings);
  const titleLike = strings
    .filter((s) => s.length > 8 && s.length < 200 && !/\d{3,}/.test(s))
    .sort((a, b) => b.length - a.length);
  return titleLike[0];
}

function pickDescriptionFromJson(data: unknown): string | undefined {
  const strings: string[] = [];
  walkCollectStrings(data, strings);
  const long = strings
    .filter((s) => s.length > 40 && s.length < 4000 && !/^https?:/i.test(s))
    .sort((a, b) => b.length - a.length);
  const comp = pickCompositionFromStrings(strings);
  const body = long.find((s) => !comp || s !== comp);
  const merged = [comp, body].filter(Boolean).join("\n\n");
  return merged.trim().slice(0, 3000) || undefined;
}

async function fetchJson(url: string, referer: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, Referer: referer },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) {
      console.log(LOG, "fetch non-OK", res.status, url.slice(0, 100));
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) {
      console.log(LOG, "skip non-JSON content-type", ct, url.slice(0, 80));
      return null;
    }
    return (await res.json()) as unknown;
  } catch (e) {
    console.log(LOG, "fetch failed", url.slice(0, 90), (e as Error).message);
    return null;
  }
}

function parseZaraApiPayload(data: unknown): {
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
} {
  const strings: string[] = [];
  walkCollectStrings(data, strings);
  const materials = pickCompositionFromStrings(strings);
  return {
    name: pickNameFromJson(data),
    price: pickPriceFromJson(data),
    materials,
    description: pickDescriptionFromJson(data)
  };
}

export interface ZaraScrapeResult {
  brand: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
  /** Primary PDP scrape path (API vs HTML); composition may still come from Claude — see reliability log. */
  method: ZaraScrapeMethod;
}


async function scrapeZaraHtml(url: string): Promise<{
  name?: string;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
} | null> {
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, Referer: url },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr("content");
    const imageUrl = typeof ogImage === "string" && ogImage.trim() ? ogImage.trim() : null;
    const name =
      $(".product-detail-info__header-name").first().text().trim() ||
      $('h1[data-qa="product-name"]').first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim();
    const rawMaterials =
      $('[data-qa="product-detail-composition"]').text().trim() ||
      $(".product-detail-composition").text().trim() ||
      $('[class*="composition"]').first().text().trim();
    const materials =
      parseZaraOuterShellComposition(rawMaterials) ||
      parseZaraOuterShellComposition(html) ||
      undefined;
    const description =
      $(".product-detail-description").first().text().trim() ||
      $('[data-qa="product-description"]').text().trim();
    if (!name && !materials) return null;
    return {
      name: name || undefined,
      materials: materials || undefined,
      description: description || undefined,
      imageUrl
    };
  } catch {
    return null;
  }
}

function resolveZaraMethod(extraOk: boolean, itxOk: boolean, htmlWasOnlySource: boolean): ZaraScrapeMethod {
  if (extraOk && itxOk) return "zara_api_merged";
  if (extraOk) return "zara_extra_detail";
  if (itxOk) return "zara_itxrest_detail";
  if (htmlWasOnlySource) return "zara_html_dom";
  return "zara_html_dom";
}

/**
 * Zara PDP: locale + US extra-detail APIs, itxrest detail, HTML, then Claude on title for composition. Logs reliability.
 */
export async function scrapeZaraFromUrl(productPageUrl: string): Promise<ZaraScrapeResult | null> {
  const id = extractZaraProductId(productPageUrl);
  const slugName = extractZaraNameFromUrlSlug(productPageUrl);
  const locale = zaraLocalePrefix(productPageUrl);
  const origin = (() => {
    try {
      return new URL(productPageUrl).origin;
    } catch {
      return ZARA_ORIGIN;
    }
  })();

  const brand = "Zara";
  let name: string | undefined;
  let price: number | undefined;
  let materials: string | undefined;
  let description: string | undefined;
  let imageUrl: string | null | undefined;

  let extraOk = false;
  let itxOk = false;
  let extraDetailComposition = false;
  let itxrestComposition = false;
  let htmlComposition = false;
  let serpOk = false;

  if (slugName) {
    name = slugName;
    console.log(LOG, "slug extracted", { nameFromSlug: slugName.slice(0, 60) });
  }

  if (id) {
    const extraUrls = [
      ...new Set([
        `${origin}${locale}/product/${id}/extra-detail`,
        `${ZARA_ORIGIN}/us/en/product/${id}/extra-detail`
      ])
    ];
    let dataExtra: unknown | null = null;
    for (const extraUrl of extraUrls) {
      dataExtra = await fetchJson(extraUrl, productPageUrl);
      if (dataExtra) break;
    }
    if (dataExtra) {
      const p = parseZaraApiPayload(dataExtra);
      if (p.name || p.materials || p.description || p.price != null) {
        extraOk = true;
        if (p.materials) extraDetailComposition = true;
        name = p.name ?? name;
        price = p.price ?? price;
        materials = p.materials ?? materials;
        description = p.description ?? description;
        console.log(LOG, "extra-detail succeeded", "id=", id, {
          hasName: !!name,
          hasPrice: price != null,
          hasMaterials: !!materials,
          hasDescription: !!description
        });
      }
    } else {
      console.log(LOG, "extra-detail failed or empty for id=", id);
    }

    const needItx = !name || !materials || price == null || !description;
    if (needItx) {
      const numericId = id.replace(/^p/i, "");
      const itxBase = `${ZARA_ORIGIN}/itxrest/2/catalog/store/${ITX_STORE_ID}/${ITX_CATEGORY_ID}/category/0/product`;
      const itxUrls = [
        `${itxBase}/${id}/detail?languageId=-1&appVersion=default`,
        ...(numericId !== id ? [`${itxBase}/${numericId}/detail?languageId=-1&appVersion=default`] : [])
      ];
      let dataItx: unknown | null = null;
      for (const itxUrl of itxUrls) {
        dataItx = await fetchJson(itxUrl, productPageUrl);
        if (dataItx) break;
      }
      if (dataItx) {
        const p = parseZaraApiPayload(dataItx);
        if (p.name || p.materials || p.description || p.price != null) {
          itxOk = true;
          if (p.materials) itxrestComposition = true;
          name = name || p.name;
          price = price ?? p.price;
          materials = materials || p.materials;
          description = description || p.description;
          console.log(LOG, "itxrest detail succeeded", "id=", id, {
            hasName: !!name,
            hasPrice: price != null,
            hasMaterials: !!materials,
            hasDescription: !!description,
            mergedWithExtra: extraOk
          });
        }
      } else {
        console.log(LOG, "itxrest detail failed or empty for id=", id);
      }
    }
  } else {
    console.log(LOG, "no product id in URL (expected ...p########.html); will try HTML / title only");
  }

  /** True when APIs did not contribute product fields and HTML provided them (SSR/meta). */
  let htmlWasOnlySource = !extraOk && !itxOk;
  // Direct HTML fetch always returns Akamai bot-challenge page for Zara; skip it.
  // Bright Data (called in scrapeProductFromUrl) handles the actual page fetch.
  console.log(LOG, "skipping direct HTML scrape (Akamai-blocked; Bright Data handles page fetch)");

  let compositionFrom: "extra_detail" | "itxrest" | "html" | "claude_title" | "none" = "none";
  if (extraDetailComposition) compositionFrom = "extra_detail";
  else if (itxrestComposition) compositionFrom = "itxrest";
  else if (htmlComposition) compositionFrom = "html";

  let method = resolveZaraMethod(extraOk, itxOk, htmlWasOnlySource);
  if (method === "zara_html_dom" && serpOk) method = "zara_slug_serpapi";

  if (!name && !materials && price == null) {
    console.log(LOG, "Zara scrape produced no usable fields");
    return null;
  }

  console.log(LOG, "zara_reliability", {
    productId: id ?? "(none)",
    extraDetailOk: extraOk,
    itxrestOk: itxOk,
    serpapiOk: false,
    htmlDomOk: false,
    compositionSource: compositionFrom,
    scrapeMethod: method,
    priceFromZaraApi: price != null,
    usedClaudeForComposition: false
  });

  return {
    brand,
    name,
    price,
    materials,
    description,
    imageUrl: imageUrl ?? null,
    method
  };
}
