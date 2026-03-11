"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ScanAnalysis } from "@/lib/scan/types";

interface ScanResultContextValue {
  result: ScanAnalysis | null;
  setResult: (r: ScanAnalysis | null) => void;
  clearResult: () => void;
}

const ScanResultContext = createContext<ScanResultContextValue | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<ScanAnalysis | null>(null);
  const setResult = useCallback((r: ScanAnalysis | null) => setResultState(r), []);
  const clearResult = useCallback(() => setResultState(null), []);
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
