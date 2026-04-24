export interface BetterAlternativeCard {
  title: string;
  brand: string;
  price: number;
  imageUrl: string | null;
  url: string;
  badge: "more_natural" | "lower_markup" | "better_cpw";
  fiberSummary: string;
}

export interface BetterAlternativesPayload {
  /** Best alternative found across all brands. */
  primary: BetterAlternativeCard | null;
  /** Second-best, from a different brand than primary. */
  secondary: BetterAlternativeCard | null;
  /**
   * Populated whenever both primary and secondary are null.
   * Always contains actionable fabric guidance — never empty.
   */
  fallbackMessage: string | null;
}
