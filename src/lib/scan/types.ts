/** Raw product data from URL scrape or barcode lookup, before Claude analysis */
export interface RawProductData {
  brand?: string;
  name?: string;
  price?: number;
  materials?: string;
  description?: string;
  url?: string;
  barcode?: string;
  source: "url" | "barcode";
}

/** Claude analysis output — exact fields from the prompt */
export interface ScanAnalysis {
  brand: string;
  name: string;
  price: number;
  materials: { fiber: string; percentage: number }[];
  estimatedMaterialCost: number;
  markup: number;
  costPerWear: number;
  verdict: "Retail Trap" | "Worth It";
  verdictReason: string;
  tags: string[];
}

/** Full scan result returned by /api/scan */
export interface ScanResult {
  ok: true;
  analysis: ScanAnalysis;
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
