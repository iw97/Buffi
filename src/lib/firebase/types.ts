/**
 * Firestore document types and collection names for Buffi.
 */

export const COLLECTIONS = {
  USERS: "users",
  SAVED_ITEMS: "savedItems",
  SCAN_HISTORY: "scanHistory",
  PRODUCT_MAPPINGS: "productMappings"
} as const;

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

/** Product mapping by GTIN (productMappings collection). Read-only for clients; writes via server/Admin SDK. */
export interface ProductMapping {
  id?: string;
  gtin: string;
  productUrl: string;
  brand: string;
  confirmedAt: string;
  confirmedByUserId: string;
}
