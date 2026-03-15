"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ScanAnalysis } from "@/lib/scan/types";

export const SCAN_RESULT_STORAGE_KEY = "buffi_scan_result";

export function getStoredScanResult(): ScanAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const s = sessionStorage.getItem(SCAN_RESULT_STORAGE_KEY);
    return s ? (JSON.parse(s) as ScanAnalysis) : null;
  } catch {
    return null;
  }
}

/** True if the value is a valid ScanAnalysis (has required fields from a successful scan). */
export function isValidScanResult(value: unknown): value is ScanAnalysis {
  if (value == null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const verdict = r.verdict;
  const hasVerdict =
    verdict === "Retail Trap" || verdict === "Worth It" || verdict === "Think Twice";
  const hasCostRange =
    typeof r.estimatedMaterialCostMin === "number" && typeof r.estimatedMaterialCostMax === "number";
  const hasLegacyCost = typeof r.estimatedMaterialCost === "number";
  return hasVerdict && (hasCostRange || hasLegacyCost);
}

/** Unwrap API response shape { ok, analysis } to analysis if present. */
export function normalizeScanResult(value: unknown): ScanAnalysis | null {
  if (value == null || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const analysis = r.analysis;
  if (analysis != null && typeof analysis === "object" && isValidScanResult(analysis))
    return analysis as ScanAnalysis;
  if (isValidScanResult(value)) return value as ScanAnalysis;
  return null;
}

function setStoredResult(r: ScanAnalysis | null): void {
  if (typeof window === "undefined") return;
  try {
    if (r == null) sessionStorage.removeItem(SCAN_RESULT_STORAGE_KEY);
    else sessionStorage.setItem(SCAN_RESULT_STORAGE_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

interface ScanResultContextValue {
  result: ScanAnalysis | null;
  setResult: (r: ScanAnalysis | null) => void;
  clearResult: () => void;
}

const ScanResultContext = createContext<ScanResultContextValue | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<ScanAnalysis | null>(null);
  const setResult = useCallback((r: ScanAnalysis | null) => {
    setStoredResult(r);
    setResultState(r);
  }, []);
  const clearResult = useCallback(() => {
    setStoredResult(null);
    setResultState(null);
  }, []);
  return (
    <ScanResultContext.Provider value={{ result, setResult, clearResult }}>
      {children}
    </ScanResultContext.Provider>
  );
}

export function useScanResult() {
  const ctx = useContext(ScanResultContext);
  if (!ctx) throw new Error("useScanResult must be used within ScanResultProvider");
  return ctx;
}

/** Pending scan input — set before navigating to /analyzing, consumed there */
export interface PendingScan {
  url?: string;
  barcode?: string;
  /** Tag photo flow: composition from OCR + optional brand/price before analysis */
  tag?: {
    composition: string;
    brand?: string;
    price?: number;
  };
}

const PendingScanContext = createContext<{
  pending: PendingScan | null;
  setPending: (p: PendingScan | null) => void;
} | null>(null);

export function PendingScanProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingScan | null>(null);
  return (
    <PendingScanContext.Provider value={{ pending, setPending }}>
      {children}
    </PendingScanContext.Provider>
  );
}

export function usePendingScan() {
  const ctx = useContext(PendingScanContext);
  if (!ctx) throw new Error("usePendingScan must be used within PendingScanProvider");
  return ctx;
}

/** Error from API — set by AnalyzingScreen, consumed by ScanScreen */
export type ScanErrorCode =
  | "camera_permission_denied"
  | "camera_requires_https"
  | "product_not_found"
  | "url_scrape_failed"
  | "claude_timeout"
  | "invalid_input"
  | "unknown";

const ScanErrorContext = createContext<{
  lastError: ScanErrorCode | null;
  setLastError: (e: ScanErrorCode | null) => void;
} | null>(null);

export function ScanErrorProvider({ children }: { children: ReactNode }) {
  const [lastError, setLastError] = useState<ScanErrorCode | null>(null);
  return (
    <ScanErrorContext.Provider value={{ lastError, setLastError }}>
      {children}
    </ScanErrorContext.Provider>
  );
}

export function useScanError() {
  const ctx = useContext(ScanErrorContext);
  if (!ctx) throw new Error("useScanError must be used within ScanErrorProvider");
  return ctx;
}
