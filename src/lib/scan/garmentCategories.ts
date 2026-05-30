/** User-selected garment type from tag scan confirmation (IRL flow). */
export const GARMENT_CATEGORIES = [
  { id: "top_tshirt", label: "Top / T-shirt", searchTerm: "t-shirt" },
  { id: "blouse_shirt", label: "Blouse / Shirt", searchTerm: "shirt" },
  { id: "sweater_knitwear", label: "Sweater / Knitwear", searchTerm: "sweater" },
  { id: "dress", label: "Dress", searchTerm: "dress" },
  { id: "skirt", label: "Skirt", searchTerm: "skirt" },
  { id: "pants_trousers", label: "Pants / Trousers", searchTerm: "pants" },
  { id: "jeans", label: "Jeans", searchTerm: "jeans" },
  { id: "leggings_activewear", label: "Leggings / Activewear", searchTerm: "leggings" },
  { id: "jacket_blazer", label: "Jacket / Blazer", searchTerm: "jacket" },
  { id: "coat_outerwear", label: "Coat / Outerwear", searchTerm: "coat" },
  { id: "swimwear", label: "Swimwear", searchTerm: "swimsuit" },
  { id: "shorts", label: "Shorts", searchTerm: "shorts" },
  { id: "other", label: "Other", searchTerm: null }
] as const;

export type GarmentCategoryId = (typeof GARMENT_CATEGORIES)[number]["id"];

const BY_ID = new Map(GARMENT_CATEGORIES.map((c) => [c.id, c]));

export function isGarmentCategoryId(value: unknown): value is GarmentCategoryId {
  return typeof value === "string" && BY_ID.has(value as GarmentCategoryId);
}

export function getGarmentCategoryLabel(id: GarmentCategoryId): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Short noun for shopping search; null for "Other" → fall back to Claude query. */
export function getGarmentCategorySearchTerm(id: GarmentCategoryId): string | null {
  return BY_ID.get(id)?.searchTerm ?? null;
}
