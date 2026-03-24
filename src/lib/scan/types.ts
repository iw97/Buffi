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

/** Lightweight Claude comparison of a candidate product vs an original scan (better-alternatives flow). */
export interface AlternativeAnalysisResult {
  fibers: { fiber: string; percentage: number }[];
  estimatedMaterialCostMin: number;
  estimatedMaterialCostMax: number;
  markupMin: number;
  markupMax: number;
  costPerWear: number;
  isGenuinelyBetter: boolean;
  primaryImprovement: "fiber" | "markup" | "costPerWear" | null;
  /** At most six words (enforced in post-processing). */
  improvementSummary: string;
}

/** Input for `analyzeAlternative`: minimal candidate fields + composition text. */
export interface AlternativeCandidateProduct {
  name: string;
  brand: string;
  price: number;
  rawCompositionText: string;
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
