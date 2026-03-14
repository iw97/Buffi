import * as cheerio from "cheerio";

const LOG_PREFIX = "[scrape]";

/** Normalize a numeric price for Shopify .json variant data only. */
function normalizePrice(n: number | undefined): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  if (n <= 0) return undefined;
  if (n > 10000) return undefined;
  return n;
}

/** Extract brand from schema.org Product JSON-LD: brand.name or brand (string). */
function extractBrandFromJsonLdItem(item: Record<string, unknown>): string | undefined {
  const b = item.brand;
  if (!b) return undefined;
  if (typeof b === "string" && b.trim()) return b.trim();
  if (typeof b === "object" && b !== null) {
    const name = (b as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return undefined;
}

/** If name looks like "Product Name — Brand" or "Product Name - Brand", return [name, brand]. */
function splitNameAndBrand(fullName: string): { name: string; brand?: string } {
  const trimmed = fullName.trim();
  const separators = [" — ", " – ", " - ", " | ", " :: "];
  for (const sep of separators) {
    const i = trimmed.indexOf(sep);
    if (i > 0) {
      const namePart = trimmed.slice(0, i).trim();
      const brandPart = trimmed.slice(i + sep.length).trim();
      if (namePart && brandPart) return { name: namePart, brand: brandPart };
    }
  }
  return { name: trimmed };
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json",
  "Accept-Language": "en-US,en;q=0.9"
};

/** Try Shopify product JSON endpoint (e.g. /products/foo.json). Returns product data or null. Price only when endpoint provides it. */
async function fetchShopifyProductJson(productUrl: string): Promise<{
  name?: string;
  brand?: string;
  price?: number;
  materials?: string;
  description?: string;
} | null> {
  try {
    const u = new URL(productUrl);
    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    if (!pathname.includes("/products/")) return null;
    const jsonUrl = `${u.origin}${pathname}.json`;
    const res = await fetch(jsonUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: Record<string, unknown> };
    const product = data?.product;
    if (!product || typeof product !== "object") return null;
    const title = product.title as string | undefined;
    if (!title?.trim()) return null;
    const vendor = product.vendor as string | undefined;
    const variants = product.variants as Array<{ price?: string }> | undefined;
    let price: number | undefined;
    if (Array.isArray(variants) && variants.length > 0 && variants[0]?.price != null) {
      const p = parseFloat(String(variants[0].price));
      if (!Number.isNaN(p) && p >= 0) price = normalizePrice(p);
    }
    const bodyHtml = product.body_html as string | undefined;
    const description =
      typeof bodyHtml === "string" && bodyHtml.trim()
        ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
        : undefined;
    console.log(LOG_PREFIX, "Shopify .json used for", productUrl.slice(0, 80), "->", {
      title: title.slice(0, 40),
      vendor,
      price: price ?? "(none)"
    });
    return {
      name: title.trim(),
      brand: vendor?.trim() || undefined,
      price,
      description: description || undefined,
      materials: undefined
    };
  } catch {
    return null;
  }
}

/** Extract product data from retailer HTML. Name, brand, materials from Cheerio; price only from Shopify .json when available. */
export async function scrapeProductFromUrl(url: string): Promise<{
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
} | null> {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.toLowerCase();

  // Shopify: try .json endpoint first (returns price when store allows it)
  const shopifyResult = await fetchShopifyProductJson(url);
  if (shopifyResult && (shopifyResult.name || shopifyResult.brand || shopifyResult.price != null)) {
    const out = {
      brand: shopifyResult.brand,
      name: shopifyResult.name,
      price: shopifyResult.price,
      materials: shopifyResult.materials,
      description: shopifyResult.description
    };
    console.log(LOG_PREFIX, "extracted (Shopify .json)", url.slice(0, 80), "->", {
      brand: out.brand ?? "(missing)",
      name: out.name?.slice(0, 50) ?? "(missing)",
      price: out.price ?? "(missing)",
      hasMaterials: !!out.materials
    });
    return out;
  }

  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
  const ogTitle = $('meta[property="og:title"]').attr("content");

  let brand: string | undefined;
  let name: string | undefined;
  let materials: string | undefined;
  let description: string | undefined;

  // Schema.org Product JSON-LD: name, brand, description only (no price)
  for (let i = 0; i < jsonLdScripts.length; i++) {
    const el = jsonLdScripts[i];
    const contentStr = ($(el).html() || "").trim();
    if (!contentStr) continue;
    try {
      const data = JSON.parse(contentStr) as Record<string, unknown> & {
        "@graph"?: unknown[];
        "@type"?: string;
        name?: string;
        brand?: unknown;
        description?: string;
      };
      const graph = data["@graph"];
      const list: Array<Record<string, unknown>> = Array.isArray(graph)
        ? (graph as Record<string, unknown>[])
        : [data];
      const item = list.find((d) => d["@type"] === "Product") ?? (data["@type"] === "Product" ? data : null);
      if (item) {
        const itemName = item.name as string | undefined;
        if (itemName?.trim()) name = itemName.trim();
        const brandFromLd = extractBrandFromJsonLdItem(item);
        if (brandFromLd) brand = brandFromLd;
        const desc = item.description as string | undefined;
        if (desc?.trim()) description = desc.trim();
      }
    } catch {
      /* ignore */
    }
  }

  if (ogTitle && !name) name = ogTitle;

  if (name && !brand) {
    const split = splitNameAndBrand(name);
    if (split.brand) {
      name = split.name;
      brand = split.brand;
    }
  }

  // Retailer-specific DOM: name, brand, materials only
  if (host.includes("zara.com")) {
    brand = brand ?? "Zara";
    name = name ?? $(".product-detail-info__header-name").first().text().trim();
    materials = materials ?? $('[data-qa="product-detail-composition"]').text().trim() || $(".product-detail-composition").text().trim();
  } else if (host.includes("hm.com")) {
    brand = brand ?? "H&M";
    name = name ?? $("h1.primary-product-title").first().text().trim() || $(".ProductTitle-module").first().text().trim();
    materials = materials ?? $(".ProductDetails-module__composition").text().trim() || $('[data-testid="product-composition"]').text().trim();
  } else if (host.includes("asos.com")) {
    brand = brand ?? $('[data-auto-id="product-brand"]').first().text().trim();
    name = name ?? $('[data-auto-id="product-title"]').first().text().trim() || $("h1").first().text().trim();
    materials = materials ?? $(".product-description__materials").text().trim() || $('[data-id="product-details"]').find("li").text();
  } else if (host.includes("nike.com")) {
    brand = brand ?? "Nike";
    name = name ?? $("h1").first().text().trim();
  } else if (host.includes("everlane.com")) {
    brand = brand ?? "Everlane";
    name = name ?? $("h1.product-title").first().text().trim() || $(".product__title").first().text().trim();
    materials = materials ?? $(".product-details__materials").text().trim() || $('[data-id="materials"]').text().trim();
  } else if (host.includes("shein.com") || host.includes("shein.")) {
    brand = brand ?? "Shein";
    name = name ?? $(".product-intro__head-name").first().text().trim() || $("h1").first().text().trim();
    materials = materials ?? $(".product-intro__detail-description").text().trim() || $('[data-id="product-detail"]').text();
  }

  if (!name) name = $("h1").first().text().trim() || ogTitle;
  if (!materials) materials = $('[class*="material"]').first().text().trim() || $('[class*="composition"]').first().text().trim();

  if (!name && !brand) return null;

  const out = { brand, name, materials, description };
  console.log(LOG_PREFIX, "extracted from HTML", url.slice(0, 80), "->", {
    brand: out.brand ?? "(missing)",
    name: out.name?.slice(0, 50) ?? "(missing)",
    hasMaterials: !!out.materials
  });
  return out;
}
