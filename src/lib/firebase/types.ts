import type { Timestamp } from "firebase/firestore";
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
  /** Style/SKU number from product page JSON-LD or meta tags. */
  styleNumber?: string;
  /** GTIN from product page JSON-LD. */
  gtin?: string;
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

/**
 * User profile and preferences (stored in users/{uid}).
 * Time fields are Firestore `Timestamp` when written with `serverTimestamp()` (e.g. `ensureUserDocument`, `setUserProfile`).
 * `createdAt` may be an ISO string from older client-only writes (`setUserProfile` with `toISOString()`).
 */
export interface UserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: Timestamp | string;
  /** Set on every merged profile write via `serverTimestamp()`. */
  updatedAt: Timestamp;
  valuesSelected?: string[];
  priorities?: Record<string, number>;
  budgetPerItem?: number;
  /** Onboarding quiz answers */
  onboardingRegret?: string;
  onboardingQuality?: string;
  onboardingAwareness?: string;
  shopperType?: string;
  savedCount?: number;
  scannedCount?: number;
  trapsAvoidedDollars?: number;
  /** Pro subscription */
  isPro?: boolean;
  /** Stripe Customer id (cus_…). */
  stripeCustomerId?: string | null;
  /** Active subscription id (sub_…); omitted for one-time lifetime purchase. */
  stripeSubscriptionId?: string | null;
  /** Stripe subscription status, or `lifetime` for one-time Buffi Pro. */
  subscriptionStatus?: string | null;
  /** End of current paid period (subscriptions); null for lifetime. Firestore `Timestamp` when read from DB. */
  proExpiresAt?: Timestamp | null;
  /** Scan count (can be reset) */
  scanCount?: number;
  /** Count of completed breakdown views used for scan paywall. */
  completedScans?: number;
  /** Present after `ensureUserDocument`; stored as Firestore `Timestamp`. */
  scanCountResetAt?: Timestamp | string;
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
  /** Auto-pinned first completed scan for non-pro users. */
  firstScan?: boolean;
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

