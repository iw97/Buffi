/** Predefined list of common fashion brands for tag-flow autocomplete */
export const FASHION_BRANDS = [
  "& Other Stories",
  "A.P.C.",
  "Acne Studios",
  "Adidas",
  "Alexander Wang",
  "AllSaints",
  "American Eagle",
  "Anthropologie",
  "Arket",
  "ASOS",
  "Banana Republic",
  "Boden",
  "Bottega Veneta",
  "Burberry",
  "Calvin Klein",
  "COS",
  "Everlane",
  "Gap",
  "Gucci",
  "H&M",
  "J.Crew",
  "Levi's",
  "Loewe",
  "Madewell",
  "Mango",
  "Massimo Dutti",
  "Max Mara",
  "Nike",
  "Nordstrom",
  "Old Navy",
  "Patagonia",
  "Prada",
  "Primark",
  "Ralph Lauren",
  "Reformation",
  "Saint Laurent",
  "Sézane",
  "Shein",
  "Stüssy",
  "The North Face",
  "Theory",
  "Uniqlo",
  "Urban Outfitters",
  "Zara"
] as const;

export type FashionBrand = (typeof FASHION_BRANDS)[number];

/**
 * Major athletic and mass-market brands: never treat as indie or ethical for markup leniency,
 * even if the model mis-sets flags (e.g. Nike athletic shorts).
 * Match is case-insensitive: exact name or common sub-brand prefix (e.g. "Nike ACG").
 */
const MAINSTREAM_NO_MARKUP_LENIENCY_SLUGS: readonly string[] = [
  "nike",
  "jordan",
  "air jordan",
  "converse",
  "adidas",
  "reebok",
  "puma",
  "under armour",
  "under armor",
  "new balance",
  "asics",
  "brooks",
  "saucony",
  "mizuno",
  "lululemon",
  "athleta",
  "fabletics",
  "gymshark",
  "h&m",
  "zara",
  "pull&bear",
  "bershka",
  "stradivarius",
  "massimo dutti",
  "uniqlo",
  "gap",
  "old navy",
  "banana republic",
  "shein",
  "primark",
  "fashion nova",
  "boohoo",
  "prettylittlething",
  "missguided",
  "forever 21",
  "urban outfitters",
  "anthropologie",
  "free people",
  "abercrombie & fitch",
  "abercrombie",
  "hollister",
  "american eagle",
  "aeropostale",
  "amazon essentials",
  "champion",
  "fila",
  "the north face",
  "columbia"
];

export function isMainstreamBrandWithoutIndieLeniency(brand: string): boolean {
  const b = brand.trim().toLowerCase();
  if (!b) return false;
  return MAINSTREAM_NO_MARKUP_LENIENCY_SLUGS.some((slug) => b === slug || b.startsWith(`${slug} `) || b.startsWith(`${slug}/`));
}

/** Clear indie/ethical leniency flags for known mega-brands so verdict thresholds stay strict. */
export function normalizeMarkupLeniencyFlags(
  brand: string,
  flags: { isSmallBusiness: boolean; isEthicalBrand: boolean }
): { isSmallBusiness: boolean; isEthicalBrand: boolean } {
  if (!isMainstreamBrandWithoutIndieLeniency(brand)) return flags;
  return { isSmallBusiness: false, isEthicalBrand: false };
}
