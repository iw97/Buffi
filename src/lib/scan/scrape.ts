import * as cheerio from "cheerio";

const LOG_PREFIX = "[scrape]";

function parsePrice(text: string): number | undefined {
  if (!text || typeof text !== "string") return undefined;
  const m = text.replace(/[^\d.]/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}

/** Extract price from schema.org Product JSON-LD: offers.price, priceSpecification.price/value, lowPrice, highPrice */
function extractPriceFromJsonLdItem(item: Record<string, unknown>): number | undefined {
  const offers = item.offers;
  if (!offers) return undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== "object") return undefined;
  const o = offer as Record<string, unknown>;
  if (typeof o.price === "number" && o.price > 0) return o.price;
  if (typeof o.price === "string") return parseFloat(o.price) || undefined;
  const spec = o.priceSpecification as Record<string, unknown> | undefined;
  if (spec && typeof spec === "object") {
    const p = spec.price ?? spec.value;
    if (typeof p === "number" && p > 0) return p;
    if (typeof p === "string") return parseFloat(p) || undefined;
  }
  const low = o.lowPrice;
  if (typeof low === "number" && low > 0) return low;
  if (typeof low === "string") return parseFloat(low) || undefined;
  const high = o.highPrice;
  if (typeof high === "number" && high > 0) return high;
  if (typeof high === "string") return parseFloat(high) || undefined;
  return undefined;
}

/** Extract brand from schema.org Product JSON-LD: brand.name or brand (string). Handles @type Brand. */
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

/** Try to get price via headless browser when Cheerio has no price (JS-rendered). */
async function extractPriceWithPuppeteer(
  url: string,
  host: string
): Promise<number | undefined> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 2000));

      const priceFromPage = await page.evaluate((h) => {
        const host = h.toLowerCase();
        const sel = [
          '[data-auto-id="product-price"]',
          ".product-intro__head-price",
          ".money-amount__main",
          ".ProductPrice-module",
          '[data-testid="price"]',
          ".product-price",
          "[data-price]",
          ".price",
          "[class*='price']"
        ];
        for (const s of sel) {
          try {
            const el = document.querySelector(s);
            const text = el?.textContent?.trim() || (el as HTMLElement | undefined)?.getAttribute?.("data-price") || "";
            const m = text.replace(/[^\d.]/g, "").match(/[\d.]+/);
            if (m) return parseFloat(m[0]);
          } catch {
            /* ignore */
          }
        }
        return null;
      }, host);

      if (typeof priceFromPage === "number" && priceFromPage > 0) return priceFromPage;
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.warn(LOG_PREFIX, "Puppeteer fallback failed (price may be missing):", (e as Error).message);
  }
  return undefined;
}

/** Extract product data from retailer HTML. Focus: Zara, H&M, ASOS, Everlane, Shein */
export async function scrapeProductFromUrl(url: string): Promise<{
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
} | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  const host = new URL(url).hostname.toLowerCase();
  let brand: string | undefined;
  let name: string | undefined;
  let price: number | undefined;
  let materials: string | undefined;
  let description: string | undefined;

  // --- 1) Server-rendered meta tags (og:price:amount, product:price:amount, og:title) ---
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogPriceAmount = $('meta[property="og:price:amount"]').attr("content");
  const productPriceAmount = $('meta[property="product:price:amount"]').attr("content");
  if (ogTitle && !name) name = ogTitle;
  if (ogPriceAmount && price == null) price = parseFloat(ogPriceAmount);
  if (productPriceAmount && price == null) price = parseFloat(productPriceAmount);

  // --- 2) Schema.org Product JSON-LD (Shopify and others: offers.price, brand.name) ---
  const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
  for (let i = 0; i < jsonLdScripts.length; i++) {
    const el = jsonLdScripts[i];
    const rawContent = $(el).html() || "";
    const contentStr = rawContent.trim();
    if (contentStr.length > 0) {
      const toLog = contentStr.length > 2000 ? contentStr.slice(0, 2000) + "…[truncated]" : contentStr;
      console.log(LOG_PREFIX, "JSON-LD script", i + 1, "raw content:", toLog);
    }
    if (!contentStr || (!contentStr.includes("offers") && !contentStr.includes("price"))) continue;
    try {
      const data = JSON.parse(contentStr) as Record<string, unknown> & {
        "@graph"?: unknown[];
        "@type"?: string;
        name?: string;
        brand?: { name?: string } | string;
        offers?: unknown;
        description?: string;
      };
      const graph = data["@graph"];
      const list: Array<Record<string, unknown>> = Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [data];
      const item = list.find((d) => d["@type"] === "Product") ?? (data["@type"] === "Product" ? data : null);
      if (item) {
        const itemName = item.name as string | undefined;
        if (itemName?.trim()) name = itemName.trim();
        const brandFromLd = extractBrandFromJsonLdItem(item);
        if (brandFromLd) brand = brandFromLd;
        const fromLd = extractPriceFromJsonLdItem(item);
        if (fromLd != null) price = fromLd;
        const desc = item.description as string | undefined;
        if (desc?.trim()) description = desc.trim();
      }
    } catch (parseErr) {
      console.warn(LOG_PREFIX, "JSON-LD parse error for script", i + 1, (parseErr as Error).message);
    }
  }

  // --- 2b) If name looks like "Product Name — Brand", split and use for brand ---
  if (name && !brand) {
    const split = splitNameAndBrand(name);
    if (split.brand) {
      name = split.name;
      brand = split.brand;
    }
  }

  // Meta product:price:amount / og:price:amount (again in case JSON-LD didn't have price)
  if (productPriceAmount && price == null) price = parseFloat(productPriceAmount);
  if (ogPriceAmount && price == null) price = parseFloat(ogPriceAmount);

  // --- 3) Retailer-specific DOM selectors (Cheerio; may be empty if price is JS-rendered) ---
  if (host.includes("zara.com")) {
    brand = brand ?? "Zara";
    name = name ?? $(".product-detail-info__header-name").first().text().trim();
    price = price ?? parsePrice($(".money-amount__main").first().text());
    materials = materials ?? $('[data-qa="product-detail-composition"]').text().trim() ?? $(".product-detail-composition").text().trim();
  } else if (host.includes("hm.com")) {
    brand = brand ?? "H&M";
    name = name ?? $("h1.primary-product-title").first().text().trim() ?? $(".ProductTitle-module").first().text().trim();
    price = price ?? parsePrice($(".ProductPrice-module").first().text()) ?? parsePrice($('[data-testid="price"]').first().text());
    materials = materials ?? $(".ProductDetails-module__composition").text().trim() ?? $('[data-testid="product-composition"]').text().trim();
  } else if (host.includes("asos.com")) {
    brand = brand ?? $('[data-auto-id="product-brand"]').first().text().trim();
    name = name ?? $('[data-auto-id="product-title"]').first().text().trim() ?? $("h1").first().text().trim();
    price = price ?? parsePrice($('[data-auto-id="product-price"]').first().text());
    materials = materials ?? $(".product-description__materials").text().trim() ?? $('[data-id="product-details"]').find("li").text();
  } else if (host.includes("everlane.com")) {
    brand = brand ?? "Everlane";
    name = name ?? $("h1.product-title").first().text().trim() ?? $(".product__title").first().text().trim();
    price = price ?? parsePrice($(".product-price").first().text()) ?? parsePrice($('[data-testid="price"]').first().text());
    materials = materials ?? $(".product-details__materials").text().trim() ?? $('[data-id="materials"]').text().trim();
  } else if (host.includes("shein.com") || host.includes("shein.")) {
    brand = brand ?? "Shein";
    name = name ?? $(".product-intro__head-name").first().text().trim() ?? $("h1").first().text().trim();
    price = price ?? parsePrice($(".product-intro__head-price").first().text());
    materials = materials ?? $(".product-intro__detail-description").text().trim() ?? $('[data-id="product-detail"]').text();
  }

  // Generic fallbacks
  if (!name) name = $("h1").first().text().trim() || ogTitle;
  if (!price && productPriceAmount) price = parseFloat(productPriceAmount);
  if (!materials) materials = $('[class*="material"]').first().text().trim() || $('[class*="composition"]').first().text().trim();

  // --- 4) If price still missing, try Puppeteer (JS-rendered price) ---
  if (price == null || price <= 0) {
    console.log(LOG_PREFIX, "price missing after HTML/meta/JSON-LD, trying Puppeteer for", url.slice(0, 80));
    const puppeteerPrice = await extractPriceWithPuppeteer(url, host);
    if (puppeteerPrice != null && puppeteerPrice > 0) price = puppeteerPrice;
  }

  if (!name && !brand && !price) return null;

  const out = { brand, name, price, materials, description };
  console.log(LOG_PREFIX, "extracted from URL", url.slice(0, 100), "->", {
    brand: out.brand ?? "(missing)",
    name: out.name ? (out.name.length > 50 ? out.name.slice(0, 50) + "…" : out.name) : "(missing)",
    price: out.price ?? "(missing)",
    hasMaterials: !!out.materials,
    hasDescription: !!out.description
  });
  return out;
}
