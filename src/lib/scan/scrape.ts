import * as cheerio from "cheerio";
import { cleanProductUrl } from "./cleanProductUrl";
import { scrapeZaraFromUrl } from "./zara";

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

/** Heuristic: block looks like a care label / composition line, not random merchandising. */
function looksLikeCompositionText(text: string): boolean {
  const t = text.trim();
  if (t.length < 6 || t.length > 2000) return false;
  if (t.includes("%")) return true;
  return /cotton|polyester|linen|silk|wool|nylon|viscose|lyocell|modal|cashmere|elastane|spandex|leather|acetate|ramie|hemp|polyamide|acrylic/i.test(
    t
  );
}

function extractMaterialFromJsonLdNode(node: Record<string, unknown>): string | undefined {
  const mat = node.material;
  if (typeof mat === "string" && mat.trim()) return mat.trim();
  if (mat && typeof mat === "object") {
    const n = (mat as { name?: string }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  const props = node.additionalProperty;
  if (Array.isArray(props)) {
    for (const p of props) {
      if (!p || typeof p !== "object") continue;
      const po = p as { name?: string; value?: unknown };
      const propName = typeof po.name === "string" ? po.name : "";
      if (!/material|composition|fabric/i.test(propName)) continue;
      const v = po.value;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v != null && typeof v === "object" && "name" in (v as object)) {
        const vn = (v as { name?: string }).name;
        if (typeof vn === "string" && vn.trim()) return vn.trim();
      }
    }
  }
  const desc = node.description;
  if (typeof desc === "string" && desc.trim() && looksLikeCompositionText(desc)) {
    return desc.trim().slice(0, 500);
  }
  return undefined;
}

function tryExtractMaterialFromJsonLdScript(contentStr: string): string | undefined {
  try {
    const data = JSON.parse(contentStr) as Record<string, unknown>;
    const graph = data["@graph"];
    const nodes: Array<Record<string, unknown>> = Array.isArray(graph)
      ? (graph as Record<string, unknown>[])
      : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const m = extractMaterialFromJsonLdNode(node);
      if (m && looksLikeCompositionText(m)) return m.slice(0, 500);
    }
    const top = extractMaterialFromJsonLdNode(data);
    if (top && looksLikeCompositionText(top)) return top.slice(0, 500);
  } catch {
    /* ignore */
  }
  return undefined;
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
  imageUrl?: string | null;
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
    if (Array.isArray(variants) && variants.length > 0) {
      const parsed = variants
        .map((v) => (v?.price != null ? parseFloat(String(v.price)) : NaN))
        .filter((p) => !Number.isNaN(p) && p >= 0);
      if (parsed.length > 0) {
        const usePrice = parsed.length === 1 ? parsed[0] : Math.max(...parsed);
        price = normalizePrice(usePrice);
      }
    }
    const images = product.images as Array<{ src?: string }> | undefined;
    const imageUrl =
      Array.isArray(images) && images.length > 0 && typeof images[0]?.src === "string" && images[0].src.trim()
        ? images[0].src.trim()
        : null;
    const bodyHtml = product.body_html as string | undefined;
    const description =
      typeof bodyHtml === "string" && bodyHtml.trim()
        ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
        : undefined;
    console.log(LOG_PREFIX, "Shopify .json used for", productUrl.slice(0, 80), "->", {
      title: title.slice(0, 40),
      vendor,
      price: price ?? "(none)",
      imageUrl: imageUrl ? "yes" : "no"
    });
    return {
      name: title.trim(),
      brand: vendor?.trim() || undefined,
      price,
      description: description || undefined,
      materials: undefined,
      imageUrl: imageUrl ?? null
    };
  } catch {
    return null;
  }
}

/** Extract product data from retailer HTML. Name, brand, materials from Cheerio; price only from Shopify .json when available. Image: og:image or Shopify images[0].src. */
export async function scrapeProductFromUrl(url: string): Promise<{
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
} | null> {
  const cleaned = cleanProductUrl(url);
  console.log(LOG_PREFIX, "URL cleaned:", url.trim(), "→", cleaned);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cleaned);
  } catch {
    console.log(LOG_PREFIX, "invalid URL after cleaning");
    return null;
  }
  const host = parsedUrl.hostname.toLowerCase();

  // Shopify: try .json endpoint first (returns price when store allows it; image from images[0].src)
  const shopifyResult = await fetchShopifyProductJson(cleaned);
  if (shopifyResult && (shopifyResult.name || shopifyResult.brand || shopifyResult.price != null)) {
    const out = {
      brand: shopifyResult.brand,
      name: shopifyResult.name,
      price: shopifyResult.price,
      materials: shopifyResult.materials,
      description: shopifyResult.description,
      imageUrl: shopifyResult.imageUrl ?? null
    };
    console.log(LOG_PREFIX, "extracted (Shopify .json)", cleaned.slice(0, 80), "->", {
      brand: out.brand ?? "(missing)",
      name: out.name?.slice(0, 50) ?? "(missing)",
      price: out.price ?? "(missing)",
      hasMaterials: !!out.materials,
      hasImage: !!out.imageUrl
    });
    return out;
  }

  if (host.includes("zara.com")) {
    const zara = await scrapeZaraFromUrl(cleaned);
    if (zara && (zara.name || zara.brand)) {
      const out = {
        brand: zara.brand,
        name: zara.name,
        price: zara.price,
        materials: zara.materials,
        description: zara.description,
        imageUrl: zara.imageUrl ?? null
      };
      console.log(LOG_PREFIX, "extracted (Zara)", cleaned.slice(0, 80), "scrapeMethod=", zara.method, "->", {
        brand: out.brand ?? "(missing)",
        name: out.name?.slice(0, 50) ?? "(missing)",
        price: out.price ?? "(missing)",
        hasMaterials: !!out.materials,
        hasImage: !!out.imageUrl
      });
      return out;
    }
    console.log(LOG_PREFIX, "Zara-specific scrape empty; falling back to generic HTML", cleaned.slice(0, 80));
  }

  const res = await fetch(cleaned, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const imageUrl = typeof ogImage === "string" && ogImage.trim() ? ogImage.trim() : null;

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
    materials = materials ?? ($('[data-qa="product-detail-composition"]').text().trim() || $(".product-detail-composition").text().trim());
  } else if (host.includes("hm.com")) {
    brand = brand ?? "H&M";
    name = name ?? ($("h1.primary-product-title").first().text().trim() || $(".ProductTitle-module").first().text().trim());
    materials = materials ?? ($(".ProductDetails-module__composition").text().trim() || $('[data-testid="product-composition"]').text().trim());
  } else if (host.includes("asos.com")) {
    brand = brand ?? $('[data-auto-id="product-brand"]').first().text().trim();
    name = name ?? ($('[data-auto-id="product-title"]').first().text().trim() || $("h1").first().text().trim());
    materials = materials ?? ($(".product-description__materials").text().trim() || $('[data-id="product-details"]').find("li").text());
  } else if (host.includes("nike.com")) {
    brand = brand ?? "Nike";
    name = name ?? $("h1").first().text().trim();
  } else if (host.includes("everlane.com")) {
    brand = brand ?? "Everlane";
    name = name ?? ($("h1.product-title").first().text().trim() || $(".product__title").first().text().trim());
    materials = materials ?? ($(".product-details__materials").text().trim() || $('[data-id="materials"]').text().trim());
  } else if (host.includes("shein.com") || host.includes("shein.")) {
    brand = brand ?? "Shein";
    name = name ?? ($(".product-intro__head-name").first().text().trim() || $("h1").first().text().trim());
    materials = materials ?? ($(".product-intro__detail-description").text().trim() || $('[data-id="product-detail"]').text());
  } else if (host.includes("thereformation.com")) {
    name = name ?? $("h1").first().text().trim();
    brand = brand ?? "Reformation";
    materials =
      materials ??
      ($('[class*="composition"]').text().trim() ||
        $('[class*="material"]').text().trim() ||
        $(".product-composition").text().trim());
  } else if (host.includes("miumiu.com") || host.includes("prada.com")) {
    brand = brand ?? (host.includes("miumiu.com") ? "Miu Miu" : "Prada");
    name = name ?? $("h1").first().text().trim();
    materials =
      materials ??
      ($('[class*="material"]').text().trim() || $('[class*="composition"]').text().trim());
  }

  // Generic materials extraction for all other retailers (validated so we don't grab unrelated UI copy).
  if (!materials) {
    const materialSelectors = [
      '[class*="composition"]',
      '[class*="material"]',
      '[class*="fabric"]',
      '[class*="fiber"]',
      '[class*="content"]',
      '[data-qa*="composition"]',
      '[data-qa*="material"]',
      '[id*="composition"]',
      '[id*="material"]',
      ".product-composition",
      ".fabric-content",
      ".material-info"
    ];
    for (const selector of materialSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 5 && text.length < 500 && looksLikeCompositionText(text)) {
        materials = text;
        console.log(LOG_PREFIX, "generic materials found via", selector);
        break;
      }
    }
  }

  // JSON-LD: material / additionalProperty / composition-like description
  if (!materials) {
    for (const script of jsonLdScripts) {
      const contentStr = ($(script).html() || "").trim();
      if (!contentStr) continue;
      const found = tryExtractMaterialFromJsonLdScript(contentStr);
      if (found) {
        materials = found;
        console.log(LOG_PREFIX, "generic materials found via JSON-LD");
        break;
      }
    }
  }

  if (!name) name = $("h1").first().text().trim() || ogTitle;
  // Zara-only broad DOM fallback when the dedicated Zara scraper already fell through to generic HTML.
  if (!materials && host.includes("zara.com")) {
    materials =
      $('[class*="material"]').first().text().trim() || $('[class*="composition"]').first().text().trim() || undefined;
  }

  if (!name && !brand) return null;

  console.log(LOG_PREFIX, "extraction result", {
    hasMaterials: !!materials,
    materialsPreview: materials?.slice(0, 80),
    source: materials ? "scraped" : "none"
  });

  const out = { brand, name, materials, description, imageUrl };
  console.log(LOG_PREFIX, "extracted from HTML", cleaned.slice(0, 80), "->", {
    brand: out.brand ?? "(missing)",
    name: out.name?.slice(0, 50) ?? "(missing)",
    hasMaterials: !!out.materials,
    hasImage: !!out.imageUrl
  });
  return out;
}
