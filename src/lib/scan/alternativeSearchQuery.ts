import type { GarmentCategoryId } from "./garmentCategories";
import { getGarmentCategorySearchTerm } from "./garmentCategories";

/**
 * Builds a Google Shopping query for an alternative product.
 * User-confirmed garment category overrides fiber-based category in Claude's query.
 */
export function buildAlternativeShoppingQuery(opts: {
  brand: string;
  garmentCategory?: GarmentCategoryId | null;
  price?: number;
  claudeSearchQuery: string;
}): string {
  const term =
    opts.garmentCategory != null ? getGarmentCategorySearchTerm(opts.garmentCategory) : null;

  if (term) {
    const brand = opts.brand.trim();
    const pricePart =
      typeof opts.price === "number" && opts.price > 0 ? ` under $${Math.round(opts.price)}` : "";
    return `${brand} ${term}${pricePart}`.trim();
  }

  return opts.claudeSearchQuery.trim();
}
