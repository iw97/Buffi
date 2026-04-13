/**
 * Internal analytics + scan cache: aggregate by product URL (Admin SDK only).
 */
import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ScanAnalysis, VerdictTier } from "@/lib/scan/types";
import { getAdminFirestore } from "./admin";
import {
  COLLECTIONS,
  type ProductScanDocument,
  type ProductScanLatestSnapshot,
  type VerdictDistribution
} from "./types";
import { cleanProductUrl } from "@/lib/scan/cleanProductUrl";

const LOG = "[productScans]";

/** Normalize URL for stable hashing: clean tracking params, lowercase host, strip hash, trim trailing slash on path. */
export function normalizeProductUrl(url: string): string {
  const trimmed = cleanProductUrl(url.trim());
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** URL-safe document ID: sha256 base64url prefix of normalized URL. */
export function productUrlToDocumentId(url: string): string {
  const normalized = normalizeProductUrl(url);
  return createHash("sha256").update(normalized, "utf8").digest("base64url").slice(0, 32);
}

function verdictToDistributionKey(verdict: VerdictTier): keyof VerdictDistribution {
  switch (verdict) {
    case "Retail Trap":
      return "retailTrap";
    case "Think Twice":
      return "thinkTwice";
    case "Worth It":
      return "worthIt";
    default:
      return "worthIt";
  }
}

function emptyVerdictDistribution(): VerdictDistribution {
  return { worthIt: 0, thinkTwice: 0, retailTrap: 0 };
}

function buildLatestSnapshot(analysis: ScanAnalysis): ProductScanLatestSnapshot {
  const snap: ProductScanLatestSnapshot = {
    price: analysis.price,
    markupMin: analysis.markupMin,
    markupMax: analysis.markupMax,
    estimatedMaterialCostMin: analysis.estimatedMaterialCostMin,
    estimatedMaterialCostMax: analysis.estimatedMaterialCostMax,
    costPerWear: analysis.costPerWear,
    verdict: analysis.verdict,
    verdictReason: analysis.verdictReason,
    tags: analysis.tags,
    markupContext: analysis.markupContext
  };
  if (analysis.imageUrl != null) snap.imageUrl = analysis.imageUrl;
  if (analysis.verdictSpanNote != null) snap.verdictSpanNote = analysis.verdictSpanNote;
  if (analysis.isSmallBusiness !== undefined) snap.isSmallBusiness = analysis.isSmallBusiness;
  if (analysis.isEthicalBrand !== undefined) snap.isEthicalBrand = analysis.isEthicalBrand;
  if (analysis.hasCertifiedMaterials !== undefined) snap.hasCertifiedMaterials = analysis.hasCertifiedMaterials;
  if (analysis.certifications != null && analysis.certifications.length > 0) snap.certifications = analysis.certifications;
  if (analysis.functionalSynthetic !== undefined) snap.functionalSynthetic = analysis.functionalSynthetic;
  if (analysis.valuesMatch != null && analysis.valuesMatch.length > 0) snap.valuesMatch = analysis.valuesMatch;
  return snap;
}

function lastScannedAtToMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }
  return null;
}

/** Parse CACHE_TTL_DAYS (default 7). ≤0 disables cache reads. */
export function getCacheTtlDays(): number {
  const raw = process.env.CACHE_TTL_DAYS?.trim();
  if (!raw) return 7;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 7;
  return n;
}

/**
 * Return productScans doc if it exists and lastScannedAt is within ttlDays.
 */
export async function getCachedProductScanIfFresh(
  productUrl: string,
  ttlDays: number
): Promise<ProductScanDocument | null> {
  if (ttlDays <= 0) return null;
  const db = getAdminFirestore();
  if (!db) return null;
  const normalized = normalizeProductUrl(productUrl);
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    return null;
  }
  const docId = productUrlToDocumentId(normalized);
  const ref = db.collection(COLLECTIONS.PRODUCT_SCANS).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as ProductScanDocument;
  const ms = lastScannedAtToMillis(data.lastScannedAt);
  if (ms == null) return null;
  const ageMs = Date.now() - ms;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  if (ageMs > ttlMs) return null;
  return data;
}

/** Build ScanAnalysis from productScans document (cache hit). */
export function productScanToScanAnalysis(doc: ProductScanDocument): ScanAnalysis {
  const ls = doc.latestScan;
  const materials =
    Array.isArray(doc.fibers) && doc.fibers.length > 0
      ? doc.fibers
      : [{ fiber: "Unknown", percentage: 100 }];

  if (ls) {
    const analysis: ScanAnalysis = {
      brand: doc.brand,
      name: doc.productName,
      price: ls.price,
      materials,
      estimatedMaterialCostMin: ls.estimatedMaterialCostMin,
      estimatedMaterialCostMax: ls.estimatedMaterialCostMax,
      markupMin: ls.markupMin,
      markupMax: ls.markupMax,
      costPerWear: ls.costPerWear,
      verdict: ls.verdict,
      verdictReason: ls.verdictReason,
      tags: ls.tags,
      markupContext: ls.markupContext,
      confidenceTier: 1
    };
    if (ls.imageUrl != null) analysis.imageUrl = ls.imageUrl;
    if (ls.verdictSpanNote != null) analysis.verdictSpanNote = ls.verdictSpanNote;
    if (ls.isSmallBusiness !== undefined) analysis.isSmallBusiness = ls.isSmallBusiness;
    if (ls.isEthicalBrand !== undefined) analysis.isEthicalBrand = ls.isEthicalBrand;
    if (ls.hasCertifiedMaterials !== undefined) analysis.hasCertifiedMaterials = ls.hasCertifiedMaterials;
    if (ls.certifications != null && ls.certifications.length > 0) analysis.certifications = ls.certifications;
    if (ls.functionalSynthetic !== undefined) analysis.functionalSynthetic = ls.functionalSynthetic;
    if (ls.valuesMatch != null && ls.valuesMatch.length > 0) analysis.valuesMatch = ls.valuesMatch;
    return analysis;
  }

  // Legacy documents without latestScan: best-effort from aggregates
  return {
    brand: doc.brand,
    name: doc.productName,
    price: doc.averagePrice,
    materials: materials.length ? materials : [{ fiber: "Unknown", percentage: 100 }],
    estimatedMaterialCostMin: doc.averageMarkupMin,
    estimatedMaterialCostMax: doc.averageMarkupMax,
    markupMin: doc.averageMarkupMin,
    markupMax: doc.averageMarkupMax,
    costPerWear: 0,
    verdict: "Think Twice",
    verdictReason: "Cached aggregate (legacy document)",
    tags: [],
    markupContext: "unjustified",
    confidenceTier: 1
  };
}

/**
 * After a successful URL-based scan, upsert productScans/{hash}.
 */
export async function recordProductScan(productUrl: string, analysis: ScanAnalysis): Promise<void> {
  const db = getAdminFirestore();
  if (!db) {
    console.log(LOG, "skip: FIREBASE_SERVICE_ACCOUNT_JSON not set");
    return;
  }
  const normalized = normalizeProductUrl(productUrl);
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    console.log(LOG, "skip: invalid product URL");
    return;
  }

  const docId = productUrlToDocumentId(normalized);
  const ref = db.collection(COLLECTIONS.PRODUCT_SCANS).doc(docId);
  const vKey = verdictToDistributionKey(analysis.verdict);
  const price = typeof analysis.price === "number" && !Number.isNaN(analysis.price) ? analysis.price : 0;
  const mkMin =
    typeof analysis.markupMin === "number" && !Number.isNaN(analysis.markupMin) ? analysis.markupMin : 0;
  const mkMax =
    typeof analysis.markupMax === "number" && !Number.isNaN(analysis.markupMax) ? analysis.markupMax : 0;

  const latestScan = buildLatestSnapshot(analysis);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = FieldValue.serverTimestamp();

      if (!snap.exists) {
        const vd = emptyVerdictDistribution();
        vd[vKey] = 1;
        tx.set(ref, {
          productUrl: normalized,
          brand: analysis.brand,
          productName: analysis.name,
          fibers: analysis.materials,
          scanCount: 1,
          averagePrice: price,
          averageMarkupMin: mkMin,
          averageMarkupMax: mkMax,
          verdictDistribution: vd,
          firstScannedAt: now,
          lastScannedAt: now,
          latestScan
        });
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const prevN = typeof data.scanCount === "number" && data.scanCount > 0 ? data.scanCount : 0;
      const newN = prevN + 1;

      const prevAvgP = typeof data.averagePrice === "number" ? data.averagePrice : price;
      const prevAvgMin = typeof data.averageMarkupMin === "number" ? data.averageMarkupMin : mkMin;
      const prevAvgMax = typeof data.averageMarkupMax === "number" ? data.averageMarkupMax : mkMax;

      const newAvgPrice = prevN === 0 ? price : (prevAvgP * prevN + price) / newN;
      const newAvgMarkupMin = prevN === 0 ? mkMin : (prevAvgMin * prevN + mkMin) / newN;
      const newAvgMarkupMax = prevN === 0 ? mkMax : (prevAvgMax * prevN + mkMax) / newN;

      const prevVd = (data.verdictDistribution as VerdictDistribution | undefined) ?? emptyVerdictDistribution();
      const verdictDistribution: VerdictDistribution = {
        worthIt: typeof prevVd.worthIt === "number" ? prevVd.worthIt : 0,
        thinkTwice: typeof prevVd.thinkTwice === "number" ? prevVd.thinkTwice : 0,
        retailTrap: typeof prevVd.retailTrap === "number" ? prevVd.retailTrap : 0
      };
      verdictDistribution[vKey] = (verdictDistribution[vKey] ?? 0) + 1;

      tx.update(ref, {
        productUrl: normalized,
        brand: analysis.brand,
        productName: analysis.name,
        fibers: analysis.materials,
        scanCount: newN,
        averagePrice: newAvgPrice,
        averageMarkupMin: newAvgMarkupMin,
        averageMarkupMax: newAvgMarkupMax,
        verdictDistribution,
        lastScannedAt: now,
        latestScan
      });
    });
  } catch (e) {
    console.error(LOG, "transaction failed:", (e as Error).message);
  }
}
