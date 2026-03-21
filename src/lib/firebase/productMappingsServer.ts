/**
 * GTIN → product URL registry (Admin SDK only, no client access).
 */
import { FieldValue } from "firebase-admin/firestore";
import { extractGtinFromProductUrl } from "@/lib/scan/extractGtin";
import { getAdminFirestore } from "./admin";
import { COLLECTIONS, type ProductMappingDocument } from "./types";
import { normalizeProductUrl } from "./productScansServer";

const LOG = "[productMappings]";

export async function recordProductMappingFromUrlScan(params: {
  gtin: string;
  productUrl: string;
  brand: string;
  productName: string;
}): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  const ref = db.collection(COLLECTIONS.PRODUCT_MAPPINGS).doc(params.gtin);
  const urlNorm = normalizeProductUrl(params.productUrl);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = FieldValue.serverTimestamp();
      if (!snap.exists) {
        tx.set(ref, {
          gtin: params.gtin,
          productUrl: urlNorm,
          brand: params.brand,
          productName: params.productName,
          confirmedAt: now,
          confirmCount: 1,
          source: "url-scrape",
          stale: false
        });
      } else {
        tx.update(ref, {
          productUrl: urlNorm,
          brand: params.brand,
          productName: params.productName,
          confirmedAt: now,
          confirmCount: FieldValue.increment(1),
          stale: false
        });
      }
    });
  } catch (e) {
    console.error(LOG, "recordProductMappingFromUrlScan failed:", (e as Error).message);
  }
}

/**
 * After a successful URL scan: extract GTIN in the background and upsert productMappings.
 */
export async function extractGtinAndUpsertMapping(productUrl: string, brand: string, productName: string): Promise<void> {
  let gtin: string | null;
  try {
    gtin = await extractGtinFromProductUrl(productUrl);
  } catch {
    gtin = null;
  }

  if (gtin) {
    console.log(`[scrape] GTIN extracted: ${gtin}`);
    await recordProductMappingFromUrlScan({ gtin, productUrl, brand, productName });
  } else {
    console.log(`[scrape] no GTIN found for this URL — skip silently`);
  }
}

async function urlRespondsOk(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BuffiBot/1.0; +https://buffi.app)"
      }
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(12000),
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BuffiBot/1.0; +https://buffi.app)",
          Range: "bytes=0-0"
        }
      });
    }
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Before returning a stored product URL for a GTIN (e.g. barcode lookup): verify URL is live.
 * If dead, mark document stale and return null.
 */
export async function resolveProductUrlForGtin(gtin: string): Promise<string | null> {
  const db = getAdminFirestore();
  if (!db) return null;

  const ref = db.collection(COLLECTIONS.PRODUCT_MAPPINGS).doc(gtin);
  let snap;
  try {
    snap = await ref.get();
  } catch (e) {
    console.warn(LOG, "resolveProductUrlForGtin read failed:", (e as Error).message);
    return null;
  }
  if (!snap.exists) return null;

  const data = snap.data() as ProductMappingDocument;
  if (data.stale) return null;

  const url = typeof data.productUrl === "string" ? data.productUrl.trim() : "";
  if (!url) return null;

  const live = await urlRespondsOk(url);
  if (live) return url;

  try {
    await ref.update({
      stale: true,
      staleAt: FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn(LOG, "failed to mark stale:", (e as Error).message);
  }
  console.log("[productMappings] dead URL marked stale:", url);
  return null;
}
