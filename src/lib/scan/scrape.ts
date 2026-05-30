import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { cleanProductUrl, isGapFamilyHost } from "./cleanProductUrl";
import { isLuxuryBrandForSerpComposition } from "./luxuryBrands";
import { getCompositionFromGoogleSearch } from "./serpapi";
import { isZaraProductPageUrl } from "./zaraHints";
import { scrapeZaraFromUrl } from "./zara";
import { parseZaraOuterShellComposition } from "./zaraComposition";
import { fetchWithBrightData } from "./unlockerFetch";

const LOG_PREFIX = "[scrape]";
/** Max chars logged per JSON-LD script body (full text may be larger on disk). */
const JSON_LD_LOG_MAX_CHARS = 150_000;

function debugScrapeMaterials(step: string, data: Record<string, unknown>): void {
  if (process.env.DEBUG_SCRAPE_MATERIALS !== "1") return;
  console.log("[debug-scrape/materials]", step, data);
}

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

function parseGapPriceText(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!m?.[1]) return undefined;
  return normalizePrice(parseFloat(m[1]));
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

/** Discount copy (e.g. "25–50% off vacation looks") — not fiber composition. */
function isPromoDiscountText(text: string): boolean {
  return /\d+%\s*off/i.test(text) || /off\s+\d+%/i.test(text);
}

/** Heuristic: block looks like a care label / composition line, not random merchandising. */
export function looksLikeCompositionText(text: string): boolean {
  const t = text.trim();
  if (t.length < 6 || t.length > 2000) return false;
  if (isPromoDiscountText(t)) return false;
  if (t.includes("%")) return true;
  return /cotton|polyester|linen|silk|wool|nylon|viscose|lyocell|modal|cashmere|elastane|spandex|leather|acetate|ramie|hemp|polyamide|acrylic|denim/i.test(
    t
  );
}

function looksLikePromoOrNonCompositionMaterials(text: string): boolean {
  if (!text?.trim()) return false;
  if (isPromoDiscountText(text)) return true;
  return !looksLikeCompositionText(text);
}

function gapBrandFromHost(host: string): string {
  const h = host.toLowerCase();
  if (h.includes("oldnavy")) return "Old Navy";
  if (h.includes("bananarepublic")) return "Banana Republic";
  if (h.includes("athleta")) return "Athleta";
  return "Gap";
}

/** Extract "Fabric: …" from Gap meta description (SSR PDP when Fabric & care panel is client-only). */
function extractGapFabricFromMetaDescription(metaDesc: string): string | undefined {
  const m = metaDesc.match(/Fabric:\s*(.+?),\s*Stretch/i);
  let fabric = m?.[1]?.replace(/\u200b/g, "").replace(/[.,\s]+$/g, "").trim();
  if (!fabric || fabric.length < 4) {
    const broad = metaDesc.match(
      /(?:shell|body|main fabric|fabric)\s*:\s*([^.,]+(?:\d+\s*%\s*[^.,]+)?)/i
    );
    fabric = broad?.[1]?.trim();
  }
  if (!fabric || fabric.length < 4) return undefined;
  return looksLikeCompositionText(fabric) ? fabric : undefined;
}

// Prevents subcomponent details like
// '100% Cotton gusset' or 'polyester lining'
// from being mistaken for the garment's
// main fiber composition.
// Reference case: SKIMS Fits Everybody
// bodysuit — gusset is cotton but main
// fabric is 76% polyamide / 24% elastane
const SUBCOMPONENT_WORDS = [
  "gusset",
  "lining",
  "liner",
  "trim",
  "waistband",
  "label",
  "embroidery",
  "interlining",
  "pocket",
  "crotch",
  "panel",
  "insert",
  "facing"
] as const;

/** Chars of surrounding page text to inspect around each %fiber match (broad scan + page re-check). */
const BROAD_TEXT_CONTEXT_RADIUS = 80;

const BROAD_TEXT_FIBERS =
  "cotton|polyester|linen|silk|wool|nylon|viscose|lyocell|modal|cashmere|elastane|spandex|leather|acetate|ramie|hemp|polyamide|acrylic";

function normalizeCompositionSearchText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Section labels in care-label copy: "Content: 100% polyester; Lining: 100% cupro". */
const COMPOSITION_SECTION_LABELS =
  "content|shell|body|main\\s+fabric|outer|face|lining|trim|gusset|insert|facing|pocket|waistband|liner|interlining";

function isStructuredCompositionDisclosure(text: string): boolean {
  const t = text.trim();
  if (new RegExp(`^(?:${COMPOSITION_SECTION_LABELS})\\s*:\\s*\\d`, "i").test(t)) return true;
  if (new RegExp(`;\\s*(?:${COMPOSITION_SECTION_LABELS})\\s*:\\s*\\d`, "i").test(t)) return true;
  return false;
}

/** "Lining: 100% cupro" as a section — not "polyester lining:" where lining modifies the fiber. */
function subcomponentAppearsAsLabel(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|;\\s*)\\b${escaped}\\s*:\\s*\\d`, "i").test(text.trim());
}

/** Sub-component modifier: "100% polyester lining" or "polyester lining:" — not "Lining: 100% cupro". */
function subcomponentAppearsAsModifier(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\d{1,3}\\s*%\\s*(?:${BROAD_TEXT_FIBERS})\\s+${escaped}\\b`, "i").test(text)) {
    return true;
  }
  if (
    new RegExp(`\\b(?:${BROAD_TEXT_FIBERS})\\s+${escaped}\\s*:`, "i").test(text) &&
    !subcomponentAppearsAsLabel(text, word)
  ) {
    return true;
  }
  if (
    text.length < 80 &&
    new RegExp(`\\b(?:${BROAD_TEXT_FIBERS})\\s+${escaped}\\b`, "i").test(text) &&
    !subcomponentAppearsAsLabel(text, word)
  ) {
    return true;
  }
  return false;
}

export function isGussetFalsePositive(text: string): boolean {
  if (!text?.trim()) return false;

  if (isStructuredCompositionDisclosure(text)) {
    debugScrapeMaterials("isGussetFalsePositive", {
      input: text.slice(0, 200),
      returned: false,
      reason: "structured-composition-disclosure"
    });
    return false;
  }

  for (const w of SUBCOMPONENT_WORDS) {
    if (subcomponentAppearsAsLabel(text, w)) continue;
    if (!subcomponentAppearsAsModifier(text, w)) continue;
    debugScrapeMaterials("isGussetFalsePositive", {
      input: text.slice(0, 200),
      returned: true,
      reason: `subcomponent-modifier:${w}`
    });
    return true;
  }

  debugScrapeMaterials("isGussetFalsePositive", {
    input: text.slice(0, 200),
    returned: false
  });
  return false;
}

/** If candidate is bare %fiber text, reject when any page occurrence sits near gusset/lining/etc. */
function isGussetFalsePositiveInPageAtCandidate(candidate: string, pageText: string): boolean {
  const pageNorm = normalizeCompositionSearchText(pageText);
  if (!pageNorm) return false;

  const candNorm = normalizeCompositionSearchText(candidate);
  const searchTargets: string[] = [];
  if (candNorm.length >= 3 && pageNorm.includes(candNorm)) {
    searchTargets.push(candNorm);
  } else {
    const fiberHit = candidate.match(
      new RegExp(`\\d{1,3}\\s*%\\s*(?:${BROAD_TEXT_FIBERS})`, "i")
    );
    if (fiberHit?.[0]) searchTargets.push(normalizeCompositionSearchText(fiberHit[0]));
  }
  if (searchTargets.length === 0) return false;

  for (const target of searchTargets) {
    let idx = 0;
    while ((idx = pageNorm.indexOf(target, idx)) >= 0) {
      const start = Math.max(0, idx - BROAD_TEXT_CONTEXT_RADIUS);
      const end = Math.min(pageNorm.length, idx + target.length + BROAD_TEXT_CONTEXT_RADIUS);
      if (isGussetFalsePositive(pageNorm.slice(start, end))) return true;
      idx += target.length || 1;
    }
  }
  return false;
}

function materialsCandidateIsFalsePositive(candidate: string, pageText?: string): boolean {
  if (isGussetFalsePositive(candidate)) return true;
  if (pageText?.trim()) return isGussetFalsePositiveInPageAtCandidate(candidate, pageText);
  return false;
}

/** Reject subcomponent false positives; log and return undefined so callers can try the next source. */
function acceptMaterialsCandidate(
  candidate: string | undefined,
  step = "acceptMaterialsCandidate",
  options?: { pageText?: string }
): string | undefined {
  if (!candidate?.trim()) return undefined;
  const text = candidate.trim();
  const falsePositive = materialsCandidateIsFalsePositive(text, options?.pageText);
  debugScrapeMaterials(step, {
    raw: text,
    isGussetFalsePositive: falsePositive,
    checkedPageText: !!options?.pageText?.trim(),
    accepted: !falsePositive
  });
  if (falsePositive) {
    console.log("[scrape] rejected subcomponent false positive:", text);
    return undefined;
  }
  return text;
}

function pickMaterials(
  current: string | undefined,
  candidate: string | undefined,
  pageText?: string
): string | undefined {
  if (current?.trim()) return current;
  return acceptMaterialsCandidate(candidate, "pickMaterials", { pageText });
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

function getCombinedPageTextForComposition($: cheerio.CheerioAPI): string {
  const scriptText = $('script[type="application/json"], script:not([src])')
    .toArray()
    .map((el) => $(el).html() || "")
    .join("\n");
  const bodyText = $("body").text();
  return `${bodyText}\n${scriptText}`.replace(/\s+/g, " ");
}

function extractCompositionFromBroadText($: cheerio.CheerioAPI, combined?: string): string | undefined {
  const pageText = combined ?? getCombinedPageTextForComposition($);
  if (!pageText.trim()) return undefined;

  const patterns = [
    // Multi-fiber care labels: "76% Polyamide, 24% Elastane"
    new RegExp(
      `(\\d{1,3}\\s*%\\s*(?:${BROAD_TEXT_FIBERS}))(?:\\s*[,/]\\s*\\d{1,3}\\s*%\\s*(?:${BROAD_TEXT_FIBERS})){0,5}`,
      "gi"
    ),
    // Single fiber fragment: "100% Cotton"
    new RegExp(`\\d{1,3}\\s*%\\s*(?:${BROAD_TEXT_FIBERS})`, "gi")
  ];

  for (const re of patterns) {
    for (const m of pageText.matchAll(re)) {
      const matchText = m[0];
      if (!matchText || m.index == null) continue;

      const start = Math.max(0, m.index - BROAD_TEXT_CONTEXT_RADIUS);
      const end = Math.min(pageText.length, m.index + matchText.length + BROAD_TEXT_CONTEXT_RADIUS);
      const context = pageText.slice(start, end);

      debugScrapeMaterials("broad-text-scan-context", {
        match: matchText,
        context
      });

      if (isGussetFalsePositive(context)) continue;

      const candidate = matchText.replace(/\s+/g, " ").trim();
      if (!looksLikeCompositionText(candidate)) continue;
      return candidate.slice(0, 400);
    }
  }

  return undefined;
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

function collectJsonLdNodes(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (node): node is Record<string, unknown> =>
        node != null && typeof node === "object" && !Array.isArray(node)
    );
  }
  if (parsed != null && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const graph = obj["@graph"];
    if (Array.isArray(graph)) {
      return graph.filter(
        (node): node is Record<string, unknown> =>
          node != null && typeof node === "object" && !Array.isArray(node)
      );
    }
    return [obj];
  }
  return [];
}

function tryExtractMaterialFromJsonLdScript(contentStr: string, pageText?: string): string | undefined {
  try {
    const nodes = collectJsonLdNodes(JSON.parse(contentStr));
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const m = extractMaterialFromJsonLdNode(node);
      const accepted = acceptMaterialsCandidate(m, "json-ld-node", { pageText });
      if (accepted) return accepted;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Desktop Chrome — first attempt for retailer HTML / Shopify .json */
const DESKTOP_CHROME_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};

/** Mobile Safari — second attempt after 403/404 */
const MOBILE_SAFARI_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1"
};

function googleReferrerForPremiumRetail(hostname: string): Record<string, string> {
  const h = hostname.toLowerCase();
  if (h.includes("thereformation.com") || h.includes("miumiu.com")) {
    return { Referer: "https://www.google.com/" };
  }
  return {};
}

/**
 * Fetch with browser-like headers; on 403/404 retry with mobile Safari profile.
 * Logs success: `[scrape] fetch succeeded on attempt N with profileName`.
 */
async function fetchWithBrowserRetry(
  url: string,
  hostnameForReferrer: string,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const ref = googleReferrerForPremiumRetail(hostnameForReferrer);
  const signal = options?.signal;
  const profiles: Array<{ name: string; headers: Record<string, string> }> = [
    { name: "desktopChrome", headers: { ...DESKTOP_CHROME_HEADERS, ...ref } },
    { name: "mobileSafari", headers: { ...MOBILE_SAFARI_HEADERS, ...ref } }
  ];

  let last: Response | null = null;
  for (let i = 0; i < profiles.length; i++) {
    const { name, headers } = profiles[i];
    const res = await fetch(url, { headers, signal });
    last = res;
    if (res.ok) {
      console.log("[scrape] fetch succeeded on attempt", i + 1, "with", name);
      return res;
    }
    const retry = (res.status === 403 || res.status === 404) && i < profiles.length - 1;
    if (retry) {
      console.log(LOG_PREFIX, "fetch retry after HTTP", res.status, "→", profiles[i + 1]?.name, url.slice(0, 100));
      await res.arrayBuffer().catch(() => undefined);
      continue;
    }
    return res;
  }
  return last as Response;
}

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
export async function fetchShopifyProductJson(productUrl: string): Promise<{
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
        const res = await fetchWithBrowserRetry(jsonUrl, host, {
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

/** First numeric price from ProductGroup.hasVariant[].offers.price. */
function parseSchemaOrgProductGroupVariantPrice(item: Record<string, unknown>): number | undefined {
  const variants = item.hasVariant;
  if (!Array.isArray(variants)) return undefined;
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const price = parseSchemaOrgOfferPrice(v as Record<string, unknown>);
    if (price != null) return price;
  }
  return undefined;
}

function extractSchemaOrgImageUrl(item: Record<string, unknown>): string | undefined {
  const image = item.image;
  if (typeof image === "string" && image.trim()) return image.trim();
  if (Array.isArray(image)) {
    for (const im of image) {
      if (typeof im === "string" && im.trim()) return im.trim();
      if (im && typeof im === "object") {
        const url = (im as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }
  }
  return undefined;
}

function extractSchemaOrgVariantGtin(item: Record<string, unknown>): string | undefined {
  const variants = item.hasVariant;
  if (!Array.isArray(variants)) return undefined;
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const vo = v as Record<string, unknown>;
    const keys = ["gtin", "gtin13", "gtin12", "gtin8", "sku"] as const;
    for (const key of keys) {
      const val = vo[key];
      if (typeof val === "string" && val.trim()) return val.trim();
      if (typeof val === "number" && Number.isFinite(val)) return String(val);
    }
  }
  return undefined;
}

function hasSchemaOrgType(node: Record<string, unknown>, typeName: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t === typeName;
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x === typeName);
  return false;
}

/** True when JSON-LD includes schema.org Product or ProductGroup. */
export function isRealProductPage($: cheerio.CheerioAPI): boolean {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const contentStr = ($(el).html() || "").trim();
    if (!contentStr) continue;
    try {
      const nodes = collectJsonLdNodes(JSON.parse(contentStr));
      for (const node of nodes) {
        if (hasSchemaOrgType(node, "Product") || hasSchemaOrgType(node, "ProductGroup")) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

type GenericHtmlExtraction = {
  brand?: string;
  name?: string;
  materials?: string;
  description?: string;
  imageUrl: string | null;
  priceFromJsonLd?: number;
  gtin?: string;
  styleNumber?: string;
  materialsFromSerpSearch: boolean;
};

function mergeGenericHtmlExtractions(
  a: GenericHtmlExtraction | null,
  b: GenericHtmlExtraction | null
): GenericHtmlExtraction | null {
  if (!a) return b;
  if (!b) return a;
  return {
    brand: a.brand?.trim() || b.brand?.trim(),
    name: a.name?.trim() || b.name?.trim(),
    materials:
      acceptMaterialsCandidate(a.materials) || acceptMaterialsCandidate(b.materials),
    description: a.description?.trim() || b.description?.trim(),
    imageUrl: a.imageUrl ?? b.imageUrl,
    priceFromJsonLd: a.priceFromJsonLd ?? b.priceFromJsonLd,
    gtin: a.gtin?.trim() || b.gtin?.trim(),
    styleNumber: a.styleNumber?.trim() || b.styleNumber?.trim(),
    materialsFromSerpSearch: a.materialsFromSerpSearch || b.materialsFromSerpSearch
  };
}

async function extractGenericProductFromLoadedCheerio(
  $: cheerio.CheerioAPI,
  host: string,
  pipelineLabel: string
): Promise<GenericHtmlExtraction | null> {
    const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
    console.log(LOG_PREFIX, "scrape path taken", pipelineLabel);
    logJsonLdScriptBodies($, jsonLdScripts as unknown[], pipelineLabel);
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    let imageUrl = typeof ogImage === "string" && ogImage.trim() ? ogImage.trim() : null;

    let brand: string | undefined;
    let name: string | undefined;
    let materials: string | undefined;
    let description: string | undefined;
    let materialsFromSerpSearch = false;
    let priceFromJsonLd: number | undefined;
    let gtin: string | undefined;
    let styleNumber: string | undefined;

    // Schema.org Product JSON-LD: name, brand, description, optional Offer price (e.g. Reformation when .json is 404)
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const el = jsonLdScripts[i];
      const contentStr = ($(el).html() || "").trim();
      if (!contentStr) continue;
      try {
        const list = collectJsonLdNodes(JSON.parse(contentStr));
        for (const item of list) {
          if (!item || typeof item !== "object") continue;

          if (hasSchemaOrgType(item, "Product")) {
            const itemName = item.name as string | undefined;
            if (itemName?.trim() && !name) name = itemName.trim();
            const brandFromLd = extractBrandFromJsonLdItem(item);
            if (brandFromLd && !brand) brand = brandFromLd;
            const desc = item.description as string | undefined;
            if (desc?.trim() && !description) description = desc.trim();
            const imageFromLd = extractSchemaOrgImageUrl(item);
            if (imageFromLd && !imageUrl) imageUrl = imageFromLd;
            const offerPrice = parseSchemaOrgOfferPrice(item);
            if (offerPrice != null && priceFromJsonLd == null) {
              priceFromJsonLd = offerPrice;
              console.log(LOG_PREFIX, `[${pipelineLabel}] JSON-LD Product price`, offerPrice);
            }
            const sku = item.sku as string | undefined;
            if (typeof sku === "string" && sku.trim() && !styleNumber) styleNumber = sku.trim().slice(0, 50);
            const productId = item.productID as string | undefined;
            if (typeof productId === "string" && productId.trim() && !styleNumber) styleNumber = productId.trim().slice(0, 50);
          }

          // Shopify commonly uses ProductGroup + hasVariant[].offers.price when .json is blocked.
          if (hasSchemaOrgType(item, "ProductGroup")) {
            const groupName = item.name as string | undefined;
            if (groupName?.trim() && !name) {
              const normalizedGroupName = groupName.includes(" | ")
                ? groupName.split(" | ")[0]?.trim() || groupName.trim()
                : groupName.trim();
              name = normalizedGroupName;
            }
            const brandFromGroup = extractBrandFromJsonLdItem(item);
            if (brandFromGroup && !brand) brand = brandFromGroup;
            const groupDesc = item.description as string | undefined;
            if (groupDesc?.trim() && !description) description = groupDesc.trim();
            const imageFromGroup = extractSchemaOrgImageUrl(item);
            if (imageFromGroup && !imageUrl) imageUrl = imageFromGroup;
            const groupVariantPrice = parseSchemaOrgProductGroupVariantPrice(item);
            if (groupVariantPrice != null && priceFromJsonLd == null) priceFromJsonLd = groupVariantPrice;
            const groupVariantGtin = extractSchemaOrgVariantGtin(item);
            if (groupVariantGtin && !gtin) gtin = groupVariantGtin;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!styleNumber) {
      const metaSku =
        $('meta[name="sku"]').attr("content") ||
        $('meta[property="product:sku"]').attr("content") ||
        $('meta[name="product:item_group_id"]').attr("content");
      if (metaSku?.trim()) styleNumber = metaSku.trim().slice(0, 50);
    }

    if (ogTitle && !name) name = ogTitle;

    const h1Name = $("h1").first().text().trim();
    if (name?.includes(" | ") && h1Name && name.toLowerCase().startsWith(h1Name.toLowerCase())) {
      name = h1Name;
    }

    if (name && !brand) {
      const split = splitNameAndBrand(name);
      if (split.brand) {
        name = split.name;
        brand = split.brand;
      }
    }

    const pageTextForComposition = getCombinedPageTextForComposition($);

    // Retailer-specific DOM: name, brand, materials only
    if (host.includes("zara.com")) {
      brand = brand ?? "Zara";
      name = name ?? $(".product-detail-info__header-name").first().text().trim();
      const zaraDomComp =
        $('[data-qa="product-detail-composition"]').text().trim() ||
        $(".product-detail-composition").text().trim();
      materials = pickMaterials(
        materials,
        parseZaraOuterShellComposition(zaraDomComp) ||
          parseZaraOuterShellComposition(pageTextForComposition) ||
          zaraDomComp,
        pageTextForComposition
      );
    } else if (host.includes("hm.com")) {
      brand = brand ?? "H&M";
      name = name ?? ($("h1.primary-product-title").first().text().trim() || $(".ProductTitle-module").first().text().trim());
      materials = pickMaterials(
        materials,
        $(".ProductDetails-module__composition").text().trim() || $('[data-testid="product-composition"]').text().trim(),
        pageTextForComposition
      );
    } else if (host.includes("asos.com")) {
      brand = brand ?? $('[data-auto-id="product-brand"]').first().text().trim();
      name = name ?? ($('[data-auto-id="product-title"]').first().text().trim() || $("h1").first().text().trim());
      materials = pickMaterials(
        materials,
        $(".product-description__materials").text().trim() || $('[data-id="product-details"]').find("li").text(),
        pageTextForComposition
      );
    } else if (host.includes("nike.com")) {
      brand = brand ?? "Nike";
      name = name ?? $("h1").first().text().trim();
    } else if (host.includes("everlane.com")) {
      brand = brand ?? "Everlane";
      name = name ?? ($("h1.product-title").first().text().trim() || $(".product__title").first().text().trim());
      materials = pickMaterials(
        materials,
        $(".product-details__materials").text().trim() || $('[data-id="materials"]').text().trim(),
        pageTextForComposition
      );
    } else if (host.includes("girlfriend.com")) {
      brand = brand ?? "Girlfriend Collective";
      name = name ?? $("h1").first().text().trim();
      materials = pickMaterials(
        materials,
        $('[class*="material"]').text().trim() ||
          $('[class*="composition"]').text().trim() ||
          $('[class*="fabric"]').text().trim(),
        pageTextForComposition
      );
    } else if (host.includes("shein.com") || host.includes("shein.")) {
      brand = brand ?? "Shein";
      name = name ?? ($(".product-intro__head-name").first().text().trim() || $("h1").first().text().trim());
      materials = pickMaterials(
        materials,
        $(".product-intro__detail-description").text().trim() ||
          findSheinCompositionPanelText($) ||
          $('[data-id="product-detail"]').text().trim(),
        pageTextForComposition
      );
    } else if (host.includes("thereformation.com")) {
      name = name ?? $("h1").first().text().trim();
      brand = brand ?? "Reformation";
      const refDom = scrapeReformationCompositionFromDom($).trim();
      materials = pickMaterials(
        materials,
        refDom ||
          $('[class*="composition"]').text().trim() ||
          $('[class*="material"]').text().trim() ||
          $(".product-composition").text().trim(),
        pageTextForComposition
      );
    } else if (host.includes("miumiu.com") || host.includes("prada.com")) {
      brand = brand ?? (host.includes("miumiu.com") ? "Miu Miu" : "Prada");
      name = name ?? $("h1").first().text().trim();
      materials = pickMaterials(
        materials,
        $('[class*="material"]').text().trim() || $('[class*="composition"]').text().trim(),
        pageTextForComposition
      );
    } else if (isGapFamilyHost(host)) {
      brand = brand ?? gapBrandFromHost(host);
      name =
        name ??
        ($('[data-testid="product-title"]').first().text().trim() ||
          $("h1.pdp-product-title").first().text().trim() ||
          $("h1").first().text().trim());
      const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
      const gapMetaFabric = extractGapFabricFromMetaDescription(metaDesc);
      const gapFabricPanel =
        $('[data-testid="pdp-product-info-container"]')
          .find(".fds_panel__title")
          .filter((_, el) => /fabric\s*&\s*care/i.test($(el).text()))
          .first()
          .closest(".fds_panel")
          .find(".product-information-item__list li")
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean)
          .join("; ");
      materials = pickMaterials(
        materials,
        gapMetaFabric || gapFabricPanel || undefined,
        pageTextForComposition
      );
      if (!priceFromJsonLd) {
        const priceText =
          $('[data-testid="pdp-markdown-title-price"] .current-black-promo-price').first().text().trim() ||
          $(".current-black-promo-price").first().text().trim();
        const parsed = parseGapPriceText(priceText);
        if (parsed != null) priceFromJsonLd = parsed;
      }
      console.log(LOG_PREFIX, `[${pipelineLabel}] Gap family host`, {
        hasProductJsonLd: isRealProductPage($),
        gapMetaFabric: gapMetaFabric?.slice(0, 80) ?? null
      });
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
          const accepted = acceptMaterialsCandidate(text, `generic-selector:${selector}`, {
            pageText: pageTextForComposition
          });
          if (accepted) {
            materials = accepted;
            console.log(LOG_PREFIX, "generic materials found via", selector);
            break;
          }
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
        const found = tryExtractMaterialFromJsonLdScript(contentStr, pageTextForComposition);
        console.log(LOG_PREFIX, `JSON-LD material pass script[${si}]`, {
          extracted: found ?? "(none)",
          usedForMaterials: !!found
        });
        if (found) {
          const accepted = acceptMaterialsCandidate(found, `json-ld-script:${si}`, {
            pageText: pageTextForComposition
          });
          if (accepted) {
            materials = accepted;
            console.log(LOG_PREFIX, "generic materials found via JSON-LD");
            break;
          }
        }
      }
    }

    if (!materials) {
      const broad = extractCompositionFromBroadText($, pageTextForComposition);
      const acceptedBroad = acceptMaterialsCandidate(broad, "broad-text-scan", {
        pageText: pageTextForComposition
      });
      if (acceptedBroad) {
        materials = acceptedBroad;
        console.log(LOG_PREFIX, "materials found via broad text composition scan");
      }
    }

    materials = acceptMaterialsCandidate(materials, "extractGeneric-final", {
      pageText: pageTextForComposition
    });

    if (!name) name = $("h1").first().text().trim() || ogTitle;
    // Zara-only broad DOM fallback when the dedicated Zara scraper already fell through to generic HTML.
    if (!materials && host.includes("zara.com")) {
      materials = pickMaterials(
        materials,
        $('[class*="material"]').first().text().trim() || $('[class*="composition"]').first().text().trim(),
        pageTextForComposition
      );
    }

    if (!materials?.trim() && isLuxuryBrandForSerpComposition(brand) && name?.trim()) {
      const serpMat = await getCompositionFromGoogleSearch({ brand: brand!, productName: name! });
      const acceptedSerp = acceptMaterialsCandidate(serpMat?.trim());
      if (acceptedSerp) {
        materials = acceptedSerp;
        materialsFromSerpSearch = true;
        console.log(LOG_PREFIX, "luxury composition from SerpAPI Google organic", {
          brand,
          namePreview: name.slice(0, 80)
        });
      }
    }

    if (!name && !brand) {
      console.log(LOG_PREFIX, "scrape abort: no name and no brand after generic HTML path", pipelineLabel);
      return null;
    }

    debugScrapeMaterials(`extractGeneric-done:${pipelineLabel}`, {
      rawMaterials: materials ?? null
    });
    console.log(LOG_PREFIX, "extraction result", {
      hasMaterials: !!materials,
      materialsPreview: materials?.slice(0, 80),
      source: materials ? "scraped" : "none",
      pipelineLabel
    });

    return {
      brand,
      name,
      materials,
      description,
      imageUrl,
      priceFromJsonLd,
      gtin,
      styleNumber,
      materialsFromSerpSearch
    };
}

/** Extract product data from retailer HTML. Name, brand, materials from Cheerio; price only from Shopify .json when available. Image: og:image or Shopify images[0].src. */
export async function scrapeProductFromUrl(url: string): Promise<{
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
  gtin?: string;
  styleNumber?: string;
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
  const shopifyPathEligible = parsedUrl.pathname.includes("/products/");
  console.log("SCRAPE START", cleaned);
  console.log("IS SHOPIFY ATTEMPT:", shopifyPathEligible);

  // Shopify: try .json endpoint first (returns price when store allows it; image from images[0].src)
  const shopifyResult = await fetchShopifyProductJson(cleaned);
  console.log("SHOPIFY RESULT:", shopifyResult);
  debugScrapeMaterials("step1-shopify-json", {
    raw: shopifyResult?.materials ?? null
  });
  const shopifyMaterials = acceptMaterialsCandidate(shopifyResult?.materials, "step1-shopify-json-filtered");
  const step1ShopifyFoundMaterials = !!shopifyMaterials;
  console.log(
    "[scrape] step 1 Shopify .json:",
    step1ShopifyFoundMaterials ? "success" : "failed"
  );
  if (shopifyResult && step1ShopifyFoundMaterials) {
    const out = {
      brand: shopifyResult.brand,
      name: shopifyResult.name,
      price: shopifyResult.price,
      materials: shopifyMaterials,
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
  console.log(LOG_PREFIX, "Shopify.json did not provide materials; continuing pipeline");

  const shopifySeed: GenericHtmlExtraction | null = shopifyResult
    ? {
        brand: shopifyResult.brand,
        name: shopifyResult.name,
        materials: acceptMaterialsCandidate(shopifyResult.materials),
        description: shopifyResult.description,
        imageUrl: shopifyResult.imageUrl ?? null,
        priceFromJsonLd: shopifyResult.price,
        materialsFromSerpSearch: false
      }
    : null;

  let zaraPartial: {
    brand: string;
    name?: string;
    price?: number;
    description?: string;
    imageUrl?: string | null;
  } | null = null;

  const zaraHost = isZaraProductPageUrl(cleaned);

  if (zaraHost) {
    const zara = await scrapeZaraFromUrl(cleaned);
    if (zara && (zara.name || zara.brand)) {
      const zaraMaterials = acceptMaterialsCandidate(
        zara.materials ? parseZaraOuterShellComposition(zara.materials) : undefined
      );
      if (zaraMaterials) {
        const out = {
          brand: zara.brand,
          name: zara.name,
          price: zara.price,
          materials: zaraMaterials,
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
        console.log(LOG_PREFIX, "final materials before return", out.materials ?? "(undefined)");
        return out;
      }
      zaraPartial = {
        brand: zara.brand,
        name: zara.name,
        price: zara.price,
        description: zara.description,
        imageUrl: zara.imageUrl ?? null
      };
      console.log(
        LOG_PREFIX,
        "Zara metadata without composition; returning name/price — no Bright Data or generic HTML fallback",
        cleaned.slice(0, 80)
      );
      return {
        brand: zaraPartial.brand,
        name: zaraPartial.name,
        price: zaraPartial.price,
        description: zaraPartial.description,
        imageUrl: zaraPartial.imageUrl ?? null
      };
    }
    console.log(LOG_PREFIX, "Zara-specific scrape empty; falling back to generic HTML (no Bright Data)", cleaned.slice(0, 80));
  }

  const fetchUrls = host.includes("shein.") ? sheinFetchUrlCandidates(cleaned) : [cleaned];
  let html = "";
  let fetchOk = false;
  let fetchUrlUsed = cleaned;
  for (const tryUrl of fetchUrls) {
    let referHost = host;
    try {
      referHost = new URL(tryUrl).hostname;
    } catch {
      /* keep host */
    }
    try {
      const res = await fetchWithBrowserRetry(tryUrl, referHost, {
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
    } catch (err) {
      console.log(LOG_PREFIX, "generic HTML fetch error", {
        tryUrl: tryUrl.slice(0, 120),
        message: (err as Error).message
      });
    }
  }

  const standardFetchFailed = !fetchOk || !html.trim();

  let cheerioExtraction: GenericHtmlExtraction | null = null;
  if (fetchOk && html.trim()) {
    console.log(LOG_PREFIX, "generic HTML fetched", fetchUrlUsed.slice(0, 120));
    const $std = cheerio.load(html);
    cheerioExtraction = await extractGenericProductFromLoadedCheerio($std, host, "generic HTML (Cheerio)");
  } else {
    console.log(LOG_PREFIX, "generic HTML fetch did not return OK body", { tried: fetchUrls.length });
  }

  const gapHost = isGapFamilyHost(host);
  let gapShellPage = false;
  if (fetchOk && html.trim()) {
    const $pageCheck = cheerio.load(html);
    const shellPage = !isRealProductPage($pageCheck);
    gapShellPage = gapHost && shellPage;
    if (shellPage && cheerioExtraction?.materials?.trim()) {
      if (looksLikePromoOrNonCompositionMaterials(cheerioExtraction.materials)) {
        console.log(LOG_PREFIX, "shell page — rejecting promo/non-composition materials", {
          host: host.slice(0, 40),
          preview: cheerioExtraction.materials.slice(0, 80)
        });
        cheerioExtraction = { ...cheerioExtraction, materials: undefined };
      }
    }
  }

  const step2CheerioFoundMaterials = !!cheerioExtraction?.materials?.trim();
  debugScrapeMaterials("step2-cheerio-html", {
    raw: cheerioExtraction?.materials ?? null,
    hasMaterials: step2CheerioFoundMaterials
  });
  console.log("[scrape] step 2 Cheerio:", step2CheerioFoundMaterials ? "found" : "not found");
  console.log("[scrape] pre-BrightData condition check", {
    zaraHost,
    gapHost,
    gapShellPage,
    standardFetchFailed,
    hasMaterialsFromGeneric: !!cheerioExtraction?.materials?.trim()
  });

  let shouldTryBrightData = !step2CheerioFoundMaterials;
  if (gapHost && gapShellPage && !step2CheerioFoundMaterials) {
    shouldTryBrightData = true;
    console.log(
      LOG_PREFIX,
      "Gap page missing Product JSON-LD (shell/SSR) — forcing Bright Data for product data"
    );
  }
  if (zaraHost) {
    shouldTryBrightData = false;
    console.log(
      LOG_PREFIX,
      "skipping Bright Data for Zara — name inference handles this"
    );
  }
  debugScrapeMaterials("bright-data-decision", {
    triggered: shouldTryBrightData,
    zaraHost,
    gapHost,
    gapShellPage,
    step2CheerioFoundMaterials
  });

  let bdExtraction: GenericHtmlExtraction | null = null;
  if (shouldTryBrightData) {
    console.log("[scrape] step 2 failed, auto-triggering Bright Data step 3");
    console.log(LOG_PREFIX, "scrape path taken", "Bright Data Web Unlocker (4th fallback)");
    console.log("[scrape] using Bright Data fallback for", cleaned.slice(0, 60));
    const brightDataHtml = await fetchWithBrightData(cleaned);
    if (brightDataHtml) {
      console.log("[scrape] retrying parse with Bright Data HTML");
      const $bd = cheerio.load(brightDataHtml);
      bdExtraction = await extractGenericProductFromLoadedCheerio($bd, host, "Bright Data HTML (Cheerio)");
      console.log("[BD] price found:", bdExtraction?.priceFromJsonLd ?? null);
      console.log("[BD] materials found:", bdExtraction?.materials ?? null);
      console.log("[BD] extraction result:", {
        hasMaterials: !!bdExtraction?.materials,
        hasName: !!bdExtraction?.name,
        hasPrice: bdExtraction?.priceFromJsonLd != null,
        materialsPreview: bdExtraction?.materials?.slice(0, 100),
        namePreview: bdExtraction?.name?.slice(0, 50)
      });
      console.log("[scrape] Bright Data parse result", {
        hasMaterials: !!bdExtraction?.materials,
        hasName: !!bdExtraction?.name,
        materialsPreview: bdExtraction?.materials?.slice(0, 80)
      });
    }
    debugScrapeMaterials("step3-bright-data", {
      htmlReceived: !!brightDataHtml,
      rawMaterials: bdExtraction?.materials ?? null
    });
    console.log("[scrape] step 3 Bright Data:", bdExtraction?.materials?.trim() ? "found" : "not found");
  }

  let merged: GenericHtmlExtraction | null = null;
  merged = mergeGenericHtmlExtractions(merged, shopifySeed);
  merged = mergeGenericHtmlExtractions(merged, cheerioExtraction);
  merged = mergeGenericHtmlExtractions(merged, bdExtraction);

  if (!merged?.materials?.trim()) {
    console.log("[scrape] all methods exhausted, returning null");
    console.log(LOG_PREFIX, "scrape path taken", "composition not found after all eligible methods", {
      tried: fetchUrls.length,
      standardFetchFailed,
      usedBrightData: shouldTryBrightData,
      zaraHost
    });
    return null;
  }

  if (!merged.name && !merged.brand) {
    console.log(LOG_PREFIX, "scrape path taken", "generic HTML path exhausted", {
      tried: fetchUrls.length,
      standardFetchFailed,
      usedBrightData: shouldTryBrightData
    });
    return null;
  }

  debugScrapeMaterials("pre-merge", {
    shopify: shopifySeed?.materials ?? null,
    cheerio: cheerioExtraction?.materials ?? null,
    brightData: bdExtraction?.materials ?? null,
    merged: merged?.materials ?? null
  });
  const finalMaterials = acceptMaterialsCandidate(merged.materials, "final-before-claude");
  debugScrapeMaterials("final-before-claude", {
    value: finalMaterials ?? null
  });
  if (!finalMaterials?.trim()) {
    console.log("[scrape] all methods exhausted after subcomponent filter, returning null");
    return null;
  }

  const out = {
    brand: merged.brand,
    name: merged.name,
    materials: finalMaterials,
    description: merged.description,
    imageUrl: merged.imageUrl,
    gtin: merged.gtin,
    ...(merged.styleNumber ? { styleNumber: merged.styleNumber } : {}),
    ...(merged.priceFromJsonLd != null ? { price: merged.priceFromJsonLd } : {}),
    ...(merged.materialsFromSerpSearch ? { materialsFromSerpSearch: true as const } : {})
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
        ? merged.priceFromJsonLd != null
          ? "JSON-LD Product/ProductGroup (offers[].price or hasVariant[].offers.price)"
          : "set in generic HTML path"
        : "none",
    serpApiNote: "SerpAPI may run in /api/scan after scrapeProductFromUrl when scraped price is missing"
  });
  return out;
}
