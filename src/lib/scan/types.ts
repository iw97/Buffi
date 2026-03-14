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

/** Claude analysis output — exact fields from the prompt; verdict/verdictReason are computed. */
export interface ScanAnalysis {
  brand: string;
  name: string;
  price: number;
  materials: { fiber: string; percentage: number }[];
  estimatedMaterialCost: number;
  markup: number;
  costPerWear: number;
  verdict: VerdictTier;
  verdictReason: string;
  tags: string[];
  /** Small/indie brand; higher markups are normal for sustainability. */
  isSmallBusiness?: boolean;
  /** Nuance for verdict: justified | partially justified | unjustified */
  markupContext: MarkupContext;
  /** Product image URL from scraper (og:image or Shopify), when source was URL. */
  imageUrl?: string | null;
}

/** Full scan result returned by /api/scan */
export interface ScanResult {
  ok: true;
  analysis: ScanAnalysis;
}

/** Minimal scan response (brandName + fibers + price + confidenceTier → Claude) */
export interface MinimalScanResponse {
  estimatedMaterialCost: number;
  markup: number;
  markupBand: string;
  verdict: VerdictTier;
  verdictReason: string;
  tags: string[];
  isEstimated: boolean;
  isSmallBusiness: boolean;
  markupContext: MarkupContext;
}

/** Error codes for explicit handling */
export type ScanErrorCode =
  | "camera_permission_denied"
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
