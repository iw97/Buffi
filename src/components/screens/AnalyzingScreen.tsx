"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UrlScrapeFallbackStep } from "@/components/scan/UrlScrapeFallbackStep";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  usePendingScan,
  useScanResult,
  useScanError,
  setZaraUrlTagScanHint,
  type ScanErrorCode
} from "@/contexts/ScanResultContext";
import { parseProductFromUrl } from "@/lib/scan/parseProductFromUrl";
import { isZaraCompositionInsufficient, isZaraProductPageUrl } from "@/lib/scan/zaraHints";
import type { ScanAnalysis } from "@/lib/scan/types";

type ProgressId = "p1" | "p2" | "p3" | "p4";

/** Each bar fills in (100 / step) * intervalMs — keep total near scan wait time. */
const PROGRESS_BAR_FILL_STEP = 2;
const PROGRESS_BAR_FILL_INTERVAL_MS = 40;

const ORDER: Array<{ id: ProgressId; label: string; delayMs: number }> = [
  { id: "p1", label: "Fiber Composition", delayMs: 400 },
  { id: "p2", label: "Material Market Value", delayMs: 2000 },
  { id: "p3", label: "Markup Analysis", delayMs: 3600 },
  { id: "p4", label: "Values Match", delayMs: 5200 }
];

function toErrorCode(status: number, body?: { code?: string }): ScanErrorCode {
  if (body?.code === "product_not_found") return "product_not_found";
  if (body?.code === "url_scrape_failed") return "url_scrape_failed";
  if (body?.code === "claude_timeout") return "claude_timeout";
  if (body?.code === "invalid_input") return "invalid_input";
  if (status === 404) return "product_not_found";
  if (status === 422) return "url_scrape_failed";
  if (status === 504) return "claude_timeout";
  if (status === 400) return "invalid_input";
  return "unknown";
}

export function AnalyzingScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const isConfigured = auth?.isConfigured ?? false;
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  useRequireAuth("/analyzing");

  const { pending, setPending } = usePendingScan();
  const { setResult } = useScanResult();
  const { setLastError } = useScanError();
  const [progress, setProgress] = useState<Record<ProgressId, number>>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0
  });

  const items = useMemo(() => ORDER, []);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [urlFallback, setUrlFallback] = useState<{ brand: string; name: string } | null>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (urlFallback) return;
    if (hasNavigated.current) {
      console.log("[scan flow] effect skipped – already navigated");
      return;
    }
    if (isConfigured && (authLoading || !user)) {
      return;
    }
    setFlowError(null);
    console.log("[scan flow] effect run – full pending/input", pending === null ? "null" : JSON.stringify(pending, null, 2));

    const hasInput = pending?.url || pending?.barcode || pending?.tag;
    if (!hasInput) {
      console.log("[scan flow] no input (missing url, barcode, tag), redirecting to /scan");
      hasNavigated.current = true;
      router.replace("/scan");
      return;
    }

    const selectedValues = auth?.profile?.valuesSelected ?? [];
    const body = pending.url
      ? {
          url: pending.url,
          ...(pending.urlManual && {
            brand: pending.urlManual.brand,
            productName: pending.urlManual.name,
            ...(pending.urlManual.price != null &&
              pending.urlManual.price > 0 && { price: pending.urlManual.price })
          }),
          ...(selectedValues.length > 0 && { selectedValues })
        }
      : pending.tag
        ? {
            composition: pending.tag.composition,
            ...(pending.tag.brand && { brand: pending.tag.brand }),
            ...(pending.tag.price != null && pending.tag.price > 0 && { price: pending.tag.price }),
            ...(pending.tag.garmentCategory && { garmentCategory: pending.tag.garmentCategory }),
            ...(selectedValues.length > 0 && { selectedValues })
          }
        : { barcode: pending.barcode, ...(selectedValues.length > 0 && { selectedValues }) };
    console.log("[scan flow] request body prepared", {
      keys: Object.keys(body),
      hasUrl: "url" in body && !!body.url
    });

    const controller = new AbortController();

    const run = async () => {
      try {
        if (!user) {
          console.log("[scan flow] missing user, cannot authorize /api/scan");
          setLastError("unknown");
          setPending(null);
          setFlowError(
            isConfigured
              ? "Sign in to run an analysis."
              : "Cannot verify your session. Ensure Firebase client env vars are set, then sign in."
          );
          return;
        }
        console.log("[scan flow] fetch /api/scan starting");
        const token = await user.getIdToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        };
        const res = await fetch("/api/scan", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        console.log("[scan flow] fetch response", res.status, res.statusText);

        let data: Record<string, unknown> = {};
        try {
          const text = await res.text();
          console.log("[scan flow] response body length", text?.length ?? 0);
          data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
          console.error("[scan flow] JSON parse failed", parseErr);
          setFlowError("Invalid response from server");
          setLastError("unknown");
          setPending(null);
          hasNavigated.current = true;
          router.replace("/scan");
          return;
        }

        if (!res.ok) {
          console.log("[scan flow] res not ok", res.status, data);
          if (res.status === 403 && (data as { code?: string }).code === "scan_limit_reached") {
            setPending(null);
            hasNavigated.current = true;
            router.replace("/paywall");
            return;
          }

          const code = toErrorCode(res.status, data as { code?: string });
          if (
            code === "url_scrape_failed" &&
            pending?.url &&
            !pending.urlManual
          ) {
            const parsed = parseProductFromUrl(pending.url);
            setUrlFallback(parsed ?? { brand: "", name: "" });
            setFlowError(null);
            setLastError(null);
            return;
          }

          setLastError(code);
          setPending(null);
          const errMsg =
            (typeof data.message === "string" && data.message) ||
            (typeof (data as { error?: string }).error === "string" && (data as { error: string }).error) ||
            `Request failed (${res.status})`;
          setFlowError(errMsg);
          return;
        }
        if (data.ok && data.analysis) {
          console.log("[scan flow] success – writing scanResult then navigating");
          const analysis = data.analysis as ScanAnalysis;
          const scannedUrl = typeof pending?.url === "string" ? pending.url.trim() : "";
          if (scannedUrl && isZaraProductPageUrl(scannedUrl) && isZaraCompositionInsufficient(analysis)) {
            setZaraUrlTagScanHint(true);
          } else {
            setZaraUrlTagScanHint(false);
          }
          setResult(analysis);
          hasNavigated.current = true;
          router.replace("/breakdown");
          setTimeout(() => setPending(null), 0);
        } else {
          console.log("[scan flow] unexpected success shape", { hasOk: "ok" in data, hasAnalysis: "analysis" in data });
          setLastError("unknown");
          setPending(null);
          setFlowError("Server returned unexpected response");
          return;
        }
      } catch (err) {
        const e = err as Error & { name?: string };
        if (e.name === "AbortError") {
          console.log("[scan flow] aborted");
          return;
        }
        console.error("[scan flow] catch", e?.message, e);
        setLastError("unknown");
        setPending(null);
        setFlowError(e?.message || "Something went wrong");
        return;
      }
    };

    run();
    return () => controller.abort();
  }, [pending, urlFallback, setPending, setResult, setLastError, router, isConfigured, authLoading, user]);

  useEffect(() => {
    if (urlFallback) return;
    const timers: Array<number> = [];
    items.forEach(({ id, delayMs }) => {
      const start = window.setTimeout(() => {
        let n = 0;
        const t = window.setInterval(() => {
          n = Math.min(n + PROGRESS_BAR_FILL_STEP, 100);
          setProgress((prev) => ({ ...prev, [id]: n }));
          if (n >= 100) window.clearInterval(t);
        }, PROGRESS_BAR_FILL_INTERVAL_MS);
        timers.push(t);
      }, delayMs);
      timers.push(start);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [items, urlFallback]);

  function handleUrlFallbackBack() {
    setUrlFallback(null);
    setPending(null);
    hasNavigated.current = true;
    router.replace("/scan");
  }

  function handleUrlFallbackSubmit(payload: { brand: string; name: string; price?: number }) {
    if (!pending?.url) return;
    setUrlFallback(null);
    setFlowError(null);
    setPending({
      url: pending.url,
      urlManual: {
        brand: payload.brand,
        name: payload.name,
        ...(payload.price != null && { price: payload.price })
      }
    });
  }

  if (isConfigured && authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <div className="analyzing-label">Loading</div>
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          Checking your account…
        </p>
      </div>
    );
  }

  if (isConfigured && !user) {
    return null;
  }

  if (urlFallback && pending?.url) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="scan-header">
          <div>
            <div className="wordmark">
              Buffi<span>.</span>
            </div>
            <div className="header-tag">Material Intelligence</div>
          </div>
        </div>
        <UrlScrapeFallbackStep
          brand={urlFallback.brand}
          name={urlFallback.name}
          onBack={handleUrlFallbackBack}
          onSubmit={handleUrlFallbackSubmit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-10">
      {flowError ? (
        <>
          <div className="analyzing-label">Scan failed</div>
          <p
            className="analyzing-title"
            style={{ fontSize: 16, fontStyle: "normal", maxWidth: 320, textAlign: "center" }}
          >
            {flowError}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFlowError(null);
              setPending(null);
              hasNavigated.current = true;
              router.replace("/scan");
            }}
          >
            Back to scan
          </button>
        </>
      ) : (
        <>
          <div className="analyzing-label">Reading Tag</div>
          <div className="analyzing-title">
            Pulling
            <br />
            The Truth.
          </div>

          <div className="progress-block">
            {items.map((it) => (
              <div key={it.id} className="progress-item" style={{ opacity: 1 }}>
                <div className="progress-label-row">
                  <span>{it.label}</span>
                  <span>{progress[it.id]}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress[it.id]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
