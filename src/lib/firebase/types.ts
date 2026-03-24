import type { MarkupContext, ValuesMatchEntry, VerdictTier } from "@/lib/scan/types";

/**
 * Firestore document types and collection names for Buffi.
 */

export const COLLECTIONS = {
  USERS: "users",
  SAVED_ITEMS: "savedItems",
  SCAN_HISTORY: "scanHistory",
  /** GTIN → URL registry; Admin SDK only, no client access. */
  PRODUCT_MAPPINGS: "productMappings",
  /** Internal product-level scan aggregates + cache; Admin SDK only, no client access. */
  PRODUCT_SCANS: "productScans"
} as const;

/** Verdict counters for productScans aggregation (maps from ScanAnalysis verdict). */
export interface VerdictDistribution {
  worthIt: number;
  thinkTwice: number;
  retailTrap: number;
}

/** Latest scan snapshot inside productScans (for cache / breakdown restoration). */
export interface ProductScanLatestSnapshot {
  price: number;
  markupMin: number;
  markupMax: number;
  estimatedMaterialCostMin: number;
  estimatedMaterialCostMax: number;
  costPerWear: number;
  verdict: VerdictTier;
  verdictReason: string;
  tags: string[];
  markupContext: MarkupContext;
  imageUrl?: string | null;
  verdictSpanNote?: string | null;
  isSmallBusiness?: boolean;
  isEthicalBrand?: boolean;
  hasCertifiedMaterials?: boolean;
  certifications?: string[];
  functionalSynthetic?: boolean;
  valuesMatch?: ValuesMatchEntry[];
}

/**
 * productScans/{urlHash} — internal product intelligence + result cache.
 * Document ID: URL-safe hash of normalized productUrl.
 */
export interface ProductScanDocument {
  productUrl: string;
  brand: string;
  productName: string;
  fibers: { fiber: string; percentage: number }[];
  averagePrice: number;
  scanCount: number;
  averageMarkupMin: number;
  averageMarkupMax: number;
  verdictDistribution: VerdictDistribution;
  firstScannedAt: unknown;
  lastScannedAt: unknown;
  /** Present on new writes; legacy docs may omit. */
  latestScan?: ProductScanLatestSnapshot;
}

/** productMappings/{gtin} — written only from server. */
export interface ProductMappingDocument {
  gtin: string;
  productUrl: string;
  brand: string;
  productName: string;
  confirmedAt: unknown;
  confirmCount: number;
  source: "url-scrape";
  stale?: boolean;
  staleAt?: unknown;
}

/** User profile and preferences (stored in users/{uid}) */
export interface UserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string;
  valuesSelected?: string[];
  priorities?: Record<string, number>;
  budgetPerItem?: number;
  savedCount?: number;
  scannedCount?: number;
  trapsAvoidedDollars?: number;
  /** Pro subscription */
  isPro?: boolean;
  /** Scan count (can be reset) */
  scanCount?: number;
  scanCountResetAt?: string;
  /** Saved items count */
  saveCount?: number;
}

/** A saved scan result (savedItems collection) */
export interface SavedItem {
  id?: string;
  userId: string;
  brandName: string;
  itemName: string;
  price: number;
  estimatedMaterialCost: number;
  markup: number;
  markupBand: string;
  fibers: string[];
  verdict: "trap" | "win" | "think_twice";
  verdictReason: string;
  tags: string[];
  isEstimated: boolean;
  confidenceTier: number;
  savedAt: string;
}

/** Scan history entry (scanHistory collection) */
export interface ScanHistoryEntry {
  id?: string;
  userId: string;
  brandName: string;
  itemName: string;
  verdict: "trap" | "win" | "think_twice";
  confidenceTier: number;
  scannedAt: string;
  expiresAt: string;
}

