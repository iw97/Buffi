/**
 * Firestore document types and collection names for Recit.
 */

export const COLLECTIONS = {
  USERS: "users",
  SAVED_ITEMS: "savedItems"
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
}

/** A saved scan result */
export interface SavedItem {
  id: string;
  userId: string;
  brand: string;
  name: string;
  retailPrice: number;
  verdict: "trap" | "win";
  tags: { label: string; type: "trap" | "win" }[];
  emoji?: string;
  breakdownSnapshot?: Record<string, unknown>;
  savedAt: string;
}
