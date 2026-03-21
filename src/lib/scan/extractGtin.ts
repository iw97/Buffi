/**
 * Silent GTIN / barcode extraction from product pages (URL scans).
 * Order: Shopify .json → JSON-LD (Product) → meta tags → data-* attributes.
 */
import * as cheerio from "cheerio";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json",
  "Accept-Language": "en-US,en;q=0.9"
};

/** Keep only numeric strings that look like valid GTIN/UPC/EAN lengths. */
export function normalizeGtin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return null;
}

/** 1) Shopify product.json — product.variants[0].barcode */
export async function tryShopifyVariantBarcode(productUrl: string): Promise<string | null> {
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
    const data = (await res.json()) as {
      product?: { variants?: Array<{ barcode?: string; sku?: string }> };
    };
    const v = data.product?.variants?.[0];
    if (!v) return null;
    if (typeof v.barcode === "string" && v.barcode.trim()) {
      const n = normalizeGtin(v.barcode.trim());
      if (n) return n;
    }
    if (typeof v.sku === "string" && v.sku.trim()) {
      const n = normalizeGtin(v.sku.trim());
      if (n) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const JSONLD_GTIN_KEYS = ["gtin", "gtin13", "gtin12", "gtin8", "sku"] as const;

function walkJsonLdForProductGtin(obj: unknown): string | null {
  if (obj == null) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = walkJsonLdForProductGtin(item);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj !== "object") return null;

  const rec = obj as Record<string, unknown>;
  const types = rec["@type"];
  const isProduct =
    types === "Product" || (Array.isArray(types) && (types as string[]).includes("Product"));

  if (isProduct) {
    for (const k of JSONLD_GTIN_KEYS) {
      const v = rec[k];
      if (typeof v === "string" && v.trim()) {
        const n = normalizeGtin(v.trim());
        if (n) return n;
      }
    }
  }

  for (const v of Object.values(rec)) {
    const r = walkJsonLdForProductGtin(v);
    if (r) return r;
  }
  return null;
}

/** 2) JSON-LD — Product schema: gtin*, sku */
export function extractGtinFromJsonLdHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const contentStr = ($(el).html() || "").trim();
    if (!contentStr) continue;
    try {
      const data = JSON.parse(contentStr) as Record<string, unknown>;
      const r = walkJsonLdForProductGtin(data);
      if (r) return r;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** 3) Meta tags — name or property contains upc, ean, gtin */
export function extractGtinFromMeta(html: string): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;
  $("meta").each((_, el) => {
    if (found) return false;
    const name = ($(el).attr("name") || "").toLowerCase();
    const prop = ($(el).attr("property") || "").toLowerCase();
    const content = $(el).attr("content");
    if (!content?.trim()) return;
    if (!/(upc|ean|gtin)/.test(name) && !/(upc|ean|gtin)/.test(prop)) return;
    const n = normalizeGtin(content.trim());
    if (n) found = n;
  });
  return found;
}

/** 4) data-gtin, data-upc, data-barcode, data-ean */
export function extractGtinFromDataAttributes(html: string): string | null {
  const $ = cheerio.load(html);
  const selectors = "[data-gtin], [data-upc], [data-barcode], [data-ean]";
  let found: string | null = null;
  $(selectors).each((_, el) => {
    if (found) return false;
    const $el = $(el);
    const raw =
      $el.attr("data-gtin") ||
      $el.attr("data-upc") ||
      $el.attr("data-barcode") ||
      $el.attr("data-ean");
    if (typeof raw === "string" && raw.trim()) {
      const n = normalizeGtin(raw.trim());
      if (n) found = n;
    }
  });
  return found;
}

/**
 * Extract GTIN using sources in order. Logs nothing — caller logs.
 */
export async function extractGtinFromProductUrl(productUrl: string): Promise<string | null> {
  const shopify = await tryShopifyVariantBarcode(productUrl);
  if (shopify) return shopify;

  try {
    const res = await fetch(productUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: "follow"
    });
    if (!res.ok) return null;
    const html = await res.text();

    const fromLd = extractGtinFromJsonLdHtml(html);
    if (fromLd) return fromLd;

    const fromMeta = extractGtinFromMeta(html);
    if (fromMeta) return fromMeta;

    const fromData = extractGtinFromDataAttributes(html);
    if (fromData) return fromData;
  } catch {
    /* ignore */
  }

  return null;
}

