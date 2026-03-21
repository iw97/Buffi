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
  sameBrand: BetterAlternativeCard | null;
  sameBrandSkippedMessage: string | null;
  crossBrand: BetterAlternativeCard | null;
}
