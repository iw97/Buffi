import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { cleanProductUrl } from "./cleanProductUrl";
import { isLuxuryBrandForSerpComposition } from "./luxuryBrands";
import { getCompositionFromGoogleSearch } from "./serpapi";
import { scrapeZaraFromUrl } from "./zara";

const LOG_PREFIX = "[scrape]";
/** Max chars logged per JSON-LD script body (full text may be larger on disk). */
const JSON_LD_LOG_MAX_CHARS = 150_000;

function logJsonLdScriptBodies($: cheerio.CheerioAPI, jsonLdScripts: unknown[], contextLabel: string): void {
  console.log(LOG_PREFIX, `[${contextLabel}] JSON-LD scripts: count=${jsonLdScripts.length}`);
  for (let i = 0; i < jsonLdScripts.length; i++) {
    const el = jsonLdScripts[i];
    const body = ($(el as AnyNode).html() || "").trim();
    const logged =
      body.length > JSON_LD_LOG_MAX_CHARS
        ? `${body.slice(0, JSON_LD_LOG_MAX_CHARS)}\n…[truncated: ${body.length} chars total]`
        : body;
    console.log(LOG_PREFIX, `[${contextLabel}] JSON-LD[${i}] raw length=${body.length}`);
    console.log(LOG_PREFIX, `[${contextLabel}] JSON-LD[${i}] full text:\n${logged || "(empty)"}`);
  }
}

function logGenericMaterialSelectorProbes($: cheerio.CheerioAPI, contextLabel: string): void {
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
    const passes =
      !!(text && text.length > 5 && text.length < 500 && looksLikeCompositionText(text));
    console.log(LOG_PREFIX, `[${contextLabel}] generic selector`, {
      selector,
      textLength: text.length,
      preview: text.slice(0, 120) || "(empty)",
      passesCompositionHeuristic: passes
    });
  }
}

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

/**
 * JSON-LD material strings only: require % or digit+%+fiber pattern.
 * Never treat Product.description / name as composition (marketing copy).
 */
function jsonLdCompositionAcceptable(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || t.length > 800) return false;
  if (t.includes("%")) return true;
  if (/\d+\s*%\s*[a-zA-Z]/i.test(t)) return true;
  return false;
}

function clipJsonLdMaterial(s: string): string {
  return s.trim().slice(0, 500);
}

/** First numeric price from schema.org Product offers (array or single Offer). */
function parseSchemaOrgOfferPrice(item: Record<string, unknown>): number | undefined {
  const offers = item.offers;
  const list: unknown[] = Array.isArray(offers) ? offers : offers != null && typeof offers === "object" ? [offers] : [];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const raw = (o as { price?: string | number }).price;
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const use = normalizePrice(n);
    if (use != null) return use;
  }
  return undefined;
}

function extractMaterialFromJsonLdNode(node: Record<string, unknown>): string | undefined {
  const mat = node.material;
  if (typeof mat === "string" && mat.trim() && jsonLdCompositionAcceptable(mat)) return clipJsonLdMaterial(mat);
  if (mat && typeof mat === "object") {
    const n = (mat as { name?: string }).name;
    if (typeof n === "string" && n.trim() && jsonLdCompositionAcceptable(n)) return clipJsonLdMaterial(n);
  }
  const fabric = node.fabric;
  if (typeof fabric === "string" && fabric.trim() && jsonLdCompositionAcceptable(fabric)) return clipJsonLdMaterial(fabric);
  const props = node.additionalProperty;
  if (Array.isArray(props)) {
    for (const p of props) {
      if (!p || typeof p !== "object") continue;
      const po = p as { name?: string; value?: unknown };
      const propName = typeof po.name === "string" ? po.name : "";
      if (!/material|composition|fabric/i.test(propName)) continue;
      const v = po.value;
      if (typeof v === "string" && v.trim() && jsonLdCompositionAcceptable(v)) return clipJsonLdMaterial(v);
      if (v != null && typeof v === "object" && "name" in (v as object)) {
        const vn = (v as { name?: string }).name;
        if (typeof vn === "string" && vn.trim() && jsonLdCompositionAcceptable(vn)) return clipJsonLdMaterial(vn);
      }
    }
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
      if (m) return m;
    }
    const top = extractMaterialFromJsonLdNode(data);
    if (top) return top;
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

/**
 * Shopify product.json paths to try. Reformation-style URLs use `/products/handle/SKU.html`;
 * JSON lives at `/products/handle.json`, not `...SKU.html.json`.
 */
function buildShopifyProductJsonPathCandidates(pathname: string): string[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  const out: string[] = [];
  if (/\.html$/i.test(p)) {
    const stripped = p.replace(/\/[^/]+\.html$/i, "");
    /** Require `/products/<handle>` (not bare `/products`) before using stripped.json */
    if (stripped !== p && /^\/products\/.+/.test(stripped)) out.push(`${stripped}.json`);
  }
  if (!/\.html$/i.test(p)) out.push(`${p}.json`);
  return [...new Set(out)];
}

function sheinFetchUrlCandidates(productUrl: string): string[] {
  const list: string[] = [productUrl];
  try {
    const u = new URL(productUrl);
    const h = u.hostname.toLowerCase();
    if (h === "www.shein.com" || h === "us.shein.com") {
      const alt = new URL(productUrl);
      alt.hostname = h === "www.shein.com" ? "us.shein.com" : "www.shein.com";
      const s = alt.toString();
      if (!list.includes(s)) list.push(s);
    }
  } catch {
    /* ignore */
  }
  return list;
}

function scrapeReformationCompositionFromDom($: cheerio.CheerioAPI): string {
  const fromTest = $('[data-testid*="material"]').first().text().trim();
  if (fromTest) return fromTest;
  const fromPd = $('[class*="ProductDetails"]')
    .find('[class*="composition"], [class*="material"]')
    .first()
    .text()
    .trim();
  if (fromPd) return fromPd;
  const labelHints = ["fabric", "material", "composition"];
  let bestDd = "";
  $("dt").each((_, el) => {
    const lab = $(el).text().trim().toLowerCase();
    if (!labelHints.some((h) => lab === h || lab.includes(h))) return;
    const dd = $(el).next("dd").text().trim();
    if (dd.length > bestDd.length) bestDd = dd;
  });
  if (bestDd) return bestDd;
  /** SFCC PDPs often put care/composition in a short paragraph, not a dedicated test id. */
  const fiberWord = /\b(silk|cotton|wool|linen|polyester|viscose|nylon|elastane|spandex|leather|modal|cashmere|lyocell|acetate|polyamide|acrylic|charmeuse)\b/i;
  let bestP = "";
  $("p, li").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (t.length < 12 || t.length > 220) return;
    if (!t.includes("%")) return;
    if (!fiberWord.test(t)) return;
    if (/\bCO2\b|RefScale|footprint is about|compared to most clothes/i.test(t)) return;
    if (t.length > bestP.length) bestP = t;
  });
  return bestP;
}

function findSheinCompositionPanelText($: cheerio.CheerioAPI): string {
  let best = "";
  const headingRe = /^(composition|material|fabric|fiber)$/i;
  $("div, span, p, li, h2, h3, h4").each((_, el) => {
    const $el = $(el);
    const t = $el.text().trim();
    if (!headingRe.test(t) || t.length > 40) return;
    const next =
      $el.parent().find(".product-intro__detail-text, .product-intro__detail-item, div").first().text().trim() ||
      $el.next().text().trim() ||
      $el.parent().next().text().trim();
    if (next && next.length > best.length && looksLikeCompositionText(next)) best = next;
  });
  return best;
}

/** Try Shopify product JSON endpoint (e.g. /products/foo.json). Returns product data or null. Price only when endpoint provides it. */
async function fetchShopifyProductJson(productUrl: string): Promise<{
  name?: string;
  brand?: string;
  price?: number;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
} | null> {
  let host = "";
  try {
    const u = new URL(productUrl);
    host = u.hostname.toLowerCase();
    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    if (!pathname.includes("/products/")) {
      console.log(LOG_PREFIX, "Shopify .json skip: pathname has no /products/", { host, pathname: pathname.slice(0, 120) });
      return null;
    }
    const candidates = buildShopifyProductJsonPathCandidates(pathname);
    if (candidates.length === 0) {
      console.log(LOG_PREFIX, "Shopify .json skip: no JSON path candidates", { host, pathname });
      return null;
    }

    for (const jsonPath of candidates) {
      const jsonUrl = `${u.origin}${jsonPath}`;
      console.log(LOG_PREFIX, "Shopify .json attempt", { host, jsonUrl: jsonUrl.slice(0, 140) });
      try {
        const res = await fetch(jsonUrl, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) {
          console.log(LOG_PREFIX, "Shopify .json non-OK", {
            status: res.status,
            statusText: res.statusText,
            jsonUrl: jsonUrl.slice(0, 140)
          });
          continue;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!/json/i.test(contentType)) {
          const peek = (await res.clone().text()).slice(0, 240);
          console.log(LOG_PREFIX, "Shopify .json unexpected content-type", { contentType, peek });
          continue;
        }
        let data: { product?: Record<string, unknown> };
        try {
          data = (await res.json()) as { product?: Record<string, unknown> };
        } catch (parseErr) {
          console.log(LOG_PREFIX, "Shopify .json JSON.parse failed", (parseErr as Error).message);
          continue;
        }
        const product = data?.product;
        if (!product || typeof product !== "object") {
          console.log(LOG_PREFIX, "Shopify .json missing product key", { jsonUrl: jsonUrl.slice(0, 120) });
          continue;
        }
        const title = product.title as string | undefined;
        if (!title?.trim()) {
          console.log(LOG_PREFIX, "Shopify .json missing product.title", { jsonUrl: jsonUrl.slice(0, 120) });
          continue;
        }
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
        console.log(LOG_PREFIX, "Shopify .json success", productUrl.slice(0, 80), "jsonPath=", jsonPath, "->", {
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
      } catch (inner) {
        console.log(LOG_PREFIX, "Shopify .json fetch error for candidate", jsonPath, (inner as Error).message);
        continue;
      }
    }
    console.log(LOG_PREFIX, "Shopify .json all candidates failed", { host, productUrl: productUrl.slice(0, 120) });
    return null;
  } catch (e) {
    console.log(LOG_PREFIX, "Shopify .json fatal", { host, err: (e as Error).message });
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
  /** SerpAPI organic snippet used for composition (luxury JS-only sites). */
  materialsFromSerpSearch?: boolean;
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
  console.log(LOG_PREFIX, "scrape start", { host, cleaned: cleaned.slice(0, 120) });

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
    console.log(LOG_PREFIX, "scrape path taken", "Shopify.json");
    console.log(
      LOG_PREFIX,
      "note: HTML not fetched here — no JSON-LD or generic selector pass in scrapeProductFromUrl for this branch."
    );
    console.log(LOG_PREFIX, "final materials before return", out.materials ?? "(undefined)");
    console.log(LOG_PREFIX, "price detail", {
      scrapedPrice: out.price ?? null,
      scrapedPriceSource:
        out.price != null ? "Shopify product .json — variants[].price (see fetchShopifyProductJson)" : "none",
      serpApiNote: "SerpAPI runs in /api/scan after scrapeProductFromUrl, not inside scrapeProductFromUrl"
    });
    return out;
  }
  console.log(
    LOG_PREFIX,
    "Shopify.json branch skipped",
    shopifyResult ? "(returned data but missing name/brand/price)" : "(null or not a /products/… URL)"
  );

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
      console.log(LOG_PREFIX, "scrape path taken", "Zara-specific (scrapeZaraFromUrl)");
      console.log(
        LOG_PREFIX,
        "note: JSON-LD / generic DOM probes for materials are inside zara.ts + this function’s generic fallback only if Zara returns empty and code falls through to HTML below."
      );
      console.log(LOG_PREFIX, "final materials before return", out.materials ?? "(undefined)");
      console.log(LOG_PREFIX, "price detail", {
        scrapedPrice: out.price ?? null,
        scrapedPriceSource: out.price != null ? "Zara APIs / Serp slug flow inside scrapeZaraFromUrl" : "none",
        serpApiNote: "Additional Zara SerpAPI price may run in /api/scan after scrapeProductFromUrl"
      });
      return out;
    }
    console.log(LOG_PREFIX, "Zara-specific scrape empty; falling back to generic HTML", cleaned.slice(0, 80));
  }

  const fetchUrls = host.includes("shein.") ? sheinFetchUrlCandidates(cleaned) : [cleaned];
  let html = "";
  let fetchOk = false;
  let fetchUrlUsed = cleaned;
  for (const tryUrl of fetchUrls) {
    const res = await fetch(tryUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      html = await res.text();
      fetchOk = true;
      fetchUrlUsed = tryUrl;
      break;
    }
    console.log(LOG_PREFIX, "generic HTML fetch non-OK, may try next", {
      tryUrl: tryUrl.slice(0, 120),
      status: res.status
    });
  }
  if (!fetchOk || !html) {
    console.log(LOG_PREFIX, "scrape path taken", "generic HTML fetch failed", { tried: fetchUrls.length });
    return null;
  }
  console.log(LOG_PREFIX, "generic HTML fetched", fetchUrlUsed.slice(0, 120));
  const $ = cheerio.load(html);

  const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
  console.log(LOG_PREFIX, "scrape path taken", "generic HTML (Cheerio)");
  logJsonLdScriptBodies($, jsonLdScripts as unknown[], "generic HTML");
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const imageUrl = typeof ogImage === "string" && ogImage.trim() ? ogImage.trim() : null;

  let brand: string | undefined;
  let name: string | undefined;
  let materials: string | undefined;
  let description: string | undefined;
  let materialsFromSerpSearch = false;
  let priceFromJsonLd: number | undefined;

  // Schema.org Product JSON-LD: name, brand, description, optional Offer price (e.g. Reformation when .json is 404)
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
        const offerPrice = parseSchemaOrgOfferPrice(item);
        if (offerPrice != null && priceFromJsonLd == null) priceFromJsonLd = offerPrice;
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
    materials =
      materials ??
      ($(".product-intro__detail-description").text().trim() ||
        findSheinCompositionPanelText($) ||
        $('[data-id="product-detail"]').text().trim());
  } else if (host.includes("thereformation.com")) {
    name = name ?? $("h1").first().text().trim();
    brand = brand ?? "Reformation";
    const refDom = scrapeReformationCompositionFromDom($).trim();
    materials =
      materials ??
      (refDom ||
        $('[class*="composition"]').text().trim() ||
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
    console.log(LOG_PREFIX, "generic material selector pass (before first match)", {
      materialsSoFar: materials ?? "(none)"
    });
    logGenericMaterialSelectorProbes($, "pre-generic-loop");
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
      const wouldTake =
        !!(text && text.length > 5 && text.length < 500 && looksLikeCompositionText(text));
      console.log(LOG_PREFIX, "generic selector (selection loop)", {
        selector,
        textLength: text.length,
        preview: text.slice(0, 160) || "(empty)",
        wouldSelectAsMaterials: wouldTake
      });
      if (text && text.length > 5 && text.length < 500 && looksLikeCompositionText(text)) {
        materials = text;
        console.log(LOG_PREFIX, "generic materials found via", selector);
        break;
      }
    }
  }

  // JSON-LD: material / additionalProperty / composition-like description
  if (!materials) {
    console.log(LOG_PREFIX, "JSON-LD material extraction pass (tryExtractMaterialFromJsonLdScript)");
    for (let si = 0; si < jsonLdScripts.length; si++) {
      const script = jsonLdScripts[si];
      const contentStr = ($(script).html() || "").trim();
      if (!contentStr) {
        console.log(LOG_PREFIX, `JSON-LD material pass script[${si}]`, "(empty body, skip)");
        continue;
      }
      const found = tryExtractMaterialFromJsonLdScript(contentStr);
      console.log(LOG_PREFIX, `JSON-LD material pass script[${si}]`, {
        extracted: found ?? "(none)",
        usedForMaterials: !!found
      });
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

  if (!materials?.trim() && isLuxuryBrandForSerpComposition(brand) && name?.trim()) {
    const serpMat = await getCompositionFromGoogleSearch({ brand: brand!, productName: name! });
    if (serpMat?.trim()) {
      materials = serpMat.trim();
      materialsFromSerpSearch = true;
      console.log(LOG_PREFIX, "luxury composition from SerpAPI Google organic", {
        brand,
        namePreview: name.slice(0, 80)
      });
    }
  }

  if (!name && !brand) {
    console.log(LOG_PREFIX, "scrape abort: no name and no brand after generic HTML path");
    return null;
  }

  console.log(LOG_PREFIX, "extraction result", {
    hasMaterials: !!materials,
    materialsPreview: materials?.slice(0, 80),
    source: materials ? "scraped" : "none"
  });

  const out = {
    brand,
    name,
    materials,
    description,
    imageUrl,
    ...(priceFromJsonLd != null ? { price: priceFromJsonLd } : {}),
    ...(materialsFromSerpSearch ? { materialsFromSerpSearch: true as const } : {})
  };
  console.log(LOG_PREFIX, "extracted from HTML", cleaned.slice(0, 80), "->", {
    brand: out.brand ?? "(missing)",
    name: out.name?.slice(0, 50) ?? "(missing)",
    hasMaterials: !!out.materials,
    hasImage: !!out.imageUrl
  });
  console.log(LOG_PREFIX, "scrape path taken", "generic HTML (Cheerio) — return");
  console.log(LOG_PREFIX, "final materials before return", out.materials ?? "(undefined)");
  console.log(LOG_PREFIX, "price detail", {
    scrapedPrice: out.price ?? null,
    scrapedPriceSource:
      out.price != null
        ? priceFromJsonLd != null
          ? "JSON-LD Product offers[].price (schema.org)"
          : "set in generic HTML path"
        : "none",
    serpApiNote: "SerpAPI may run in /api/scan after scrapeProductFromUrl when scraped price is missing"
  });
  return out;
}
