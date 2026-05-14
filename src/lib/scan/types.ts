/** Raw product data from URL scrape, barcode lookup, or tag (OCR) flow, before Claude analysis */
export interface RawProductData {
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
  imageUrl?: string | null;
  url?: string;
  barcode?: string;
  source: "url" | "barcode" | "tag";
  /** When true, `materials` came from SerpAPI organic search (luxury JS-only PDP), not static HTML. */
  materialsFromSerpSearch?: boolean;
}

/** Context for whether markup is justified; used to nuance verdict presentation. */
export type MarkupContext = "justified" | "partially justified" | "unjustified";

/** Three-tier verdict for display (teal / amber / red). */
export type VerdictTier = "Worth It" | "Think Twice" | "Retail Trap";

/** Per-value assessment from Claude (pass / fail / unverified). */
export type ValuesMatchState = "pass" | "fail" | "unverified";

export interface ValuesMatchEntry {
  value: string;
  state: ValuesMatchState;
  note: string;
}

/** Claude analysis output — exact fields from the prompt; verdict/verdictReason are computed. */
export interface ScanAnalysis {
  brand: string;
  name: string;
  price: number;
  materials: { fiber: string; percentage: number }[];
  /** Range: total cost to produce (materials + labor). Use min/max for display. */
  estimatedMaterialCostMin: number;
  estimatedMaterialCostMax: number;
  /** Range: markup % (min = from costMax/price, max = from costMin/price). */
  markupMin: number;
  markupMax: number;
  /** Legacy single values (optional); used for backward compat if range not present. */
  estimatedMaterialCost?: number;
  markup?: number;
  costPerWear: number;
  verdict: VerdictTier;
  verdictReason: string;
  /** When markup range spans two verdict tiers, show this note. */
  verdictSpanNote?: string | null;
  tags: string[];
  /** Small/indie brand; higher markups are normal for sustainability. */
  isSmallBusiness?: boolean;
  /** Nuance for verdict: justified | partially justified | unjustified */
  markupContext: MarkupContext;
  /** Product image URL from scraper (og:image or Shopify), when source was URL. */
  imageUrl?: string | null;
  /** User values evaluation: one entry per selected value (pass/fail/unverified + note). */
  valuesMatch?: ValuesMatchEntry[];
  /** True when synthetic fibers are appropriate for the garment category (e.g. rainwear, activewear); do not penalize. */
  functionalSynthetic?: boolean;
  /** Known ethical/sustainable brand; higher markup is partially justified. */
  isEthicalBrand?: boolean;
  /** True when recycled/certified materials are detected in product context. */
  hasCertifiedMaterials?: boolean;
  /** Detected certification/material labels, e.g. REPREVE, GOTS, Fair Trade. */
  certifications?: string[];
  /** Set when analysis is served from productScans cache (URL scans). */
  confidenceTier?: number;
  /** True when composition or cost signals are from search/snippet rather than PDP scrape. */
  isEstimated?: boolean;
}

/** Full scan result returned by /api/scan */
export interface ScanResult {
  ok: true;
  analysis: ScanAnalysis;
  /** Present for URL scans: live pipeline vs productScans cache */
  source?: "live" | "cache";
}

/** Minimal scan response (brandName + fibers + price + confidenceTier → Claude) */
export interface MinimalScanResponse {
  estimatedMaterialCostMin: number;
  estimatedMaterialCostMax: number;
  markupMin: number;
  markupMax: number;
  markupBand: string;
  verdict: VerdictTier;
  verdictReason: string;
  verdictSpanNote?: string | null;
  tags: string[];
  isEstimated: boolean;
  isSmallBusiness: boolean;
  markupContext: MarkupContext;
  functionalSynthetic?: boolean;
  isEthicalBrand?: boolean;
  hasCertifiedMaterials?: boolean;
  certifications?: string[];
}

/** A Claude-suggested alternative product shown when verdict is Think Twice or Retail Trap. */
export interface AlternativeSuggestion {
  brand: string;
  productName: string;
  estimatedPrice: string;
  keyMaterial: string;
  whyBetter: string;
  searchQuery: string;
  /** Thumbnail URL from Google Shopping — null when SerpAPI is unconfigured or returns nothing. */
  imageUrl?: string | null;
}

/** Error codes for explicit handling */
export type ScanErrorCode =
  | "camera_permission_denied"
  | "camera_requires_https"
  | "product_not_found"
  | "url_scrape_failed"
  | "claude_timeout"
  | "invalid_input"
  | "unknown";

export interface ScanError {
  ok: false;
  code: ScanErrorCode;
  message: string;
}
