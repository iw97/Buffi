import * as cheerio from "cheerio";

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

  // Try JSON-LD first (common on modern e-commerce)
  const jsonLd = $('script[type="application/ld+json"]').toArray();
  for (const el of jsonLd) {
    try {
      const data = JSON.parse($(el).html() || "{}") as { "@type"?: string; "@graph"?: unknown[]; name?: string; brand?: { name?: string } | string; offers?: { price?: number } | { price?: number }[]; description?: string };
      const graph = data["@graph"];
      const list: Array<{ "@type"?: string; name?: string; brand?: { name?: string } | string; offers?: { price?: number } | { price?: number }[]; description?: string }> = Array.isArray(graph) ? (graph as typeof data[]) : [data];
      const item = list.find((d) => d["@type"] === "Product") ?? (data["@type"] === "Product" ? data : null);
      if (item) {
        name = (item as { name?: string }).name ?? name;
        const b = (item as { brand?: { name?: string } | string }).brand;
        brand = (typeof b === "object" && b?.name) ? b.name : (typeof b === "string" ? b : brand);
        const offers = (item as { offers?: { price?: number } | { price?: number }[] }).offers;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        if (offer?.price) price = parseFloat(String(offer.price));
        description = (item as { description?: string }).description ?? description;
        break;
      }
    } catch {
      /* ignore */
    }
  }

  // Meta tags
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const productPrice = $('meta[property="product:price:amount"]').attr("content");
  if (ogTitle && !name) name = ogTitle;
  if (productPrice && price == null) price = parseFloat(productPrice);

  // Retailer-specific selectors
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
  if (!price && productPrice) price = parseFloat(productPrice);
  if (!materials) materials = $('[class*="material"]').first().text().trim() || $('[class*="composition"]').first().text().trim();

  if (!name && !brand && !price) return null;

  return { brand, name, price, materials, description };
}

function parsePrice(text: string): number | undefined {
  const m = text.replace(/[^\d.]/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}
