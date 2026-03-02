/** Lookup product by barcode: UPC Item DB first, then Open Products Facts */
export async function lookupBarcode(barcode: string): Promise<{
  brand?: string;
  name?: string;
  price?: number;
  description?: string;
} | null> {
  const code = barcode.replace(/\D/g, "");
  if (!code || code.length < 8) return null;

  // 1. UPC Item DB (free trial)
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as { code?: string; items?: Array<{ title?: string; brand?: string; lowest_recorded_price?: number; highest_recorded_price?: number; description?: string }> };
      if (data.code === "OK" && data.items?.length) {
        const item = data.items[0];
        const price = item.lowest_recorded_price ?? item.highest_recorded_price;
        return {
          brand: item.brand ?? undefined,
          name: item.title ?? undefined,
          price: typeof price === "number" ? price : undefined,
          description: item.description ?? undefined
        };
      }
    }
  } catch {
    /* fall through */
  }

  // 2. Open Products Facts (clothing / general products)
  try {
    const res = await fetch(
      `https://world.openproductsfacts.net/api/v2/product/${code}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        product?: {
          product_name?: string;
          brands?: string;
          quantity?: string;
          nutriments?: { [k: string]: unknown };
        };
        status?: number;
      };
      const p = data.product;
      if (p && (p.product_name || p.brands)) {
        return {
          brand: p.brands ?? undefined,
          name: p.product_name ?? undefined,
          price: undefined,
          description: p.quantity ?? undefined
        };
      }
    }
  } catch {
    /* fall through */
  }

  // 3. Open Food Facts as last resort (some apparel may be listed)
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        product?: {
          product_name?: string;
          brands?: string;
          quantity?: string;
        };
      };
      const p = data.product;
      if (p && (p.product_name || p.brands)) {
        return {
          brand: p.brands ?? undefined,
          name: p.product_name ?? undefined,
          price: undefined,
          description: p.quantity ?? undefined
        };
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}
