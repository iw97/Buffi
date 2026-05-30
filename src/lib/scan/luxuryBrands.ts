/** Brands whose PDPs often render composition in JS — SerpAPI composition fallback may apply. */
const LUXURY_BRANDS_COMPOSITION_FALLBACK = new Set(
  [
    "Miu Miu",
    "Prada",
    "Gucci",
    "Chanel",
    "Louis Vuitton",
    "Bottega Veneta",
    "Dior",
    "Saint Laurent",
    "Balenciaga",
    "Celine",
    "Loewe",
    "Valentino",
    "Versace",
    "Burberry",
    "Fendi",
    "Givenchy",
    "Marni",
    "Jacquemus",
    "The Row",
    "Toteme"
  ].map((s) => s.toLowerCase())
);

export function isLuxuryBrandForSerpComposition(brand: string | undefined): boolean {
  const b = brand?.trim().toLowerCase();
  if (!b) return false;
  if (LUXURY_BRANDS_COMPOSITION_FALLBACK.has(b)) return true;
  if (b.includes("saint laurent")) return true;
  if (b.includes("louis vuitton")) return true;
  return false;
}
