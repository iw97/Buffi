"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { usePendingScan, useScanResult, useScanError, type ScanErrorCode } from "@/contexts/ScanResultContext";

type ProgressId = "p1" | "p2" | "p3" | "p4";

const ORDER: Array<{ id: ProgressId; label: string; delayMs: number }> = [
  { id: "p1", label: "Fiber Composition", delayMs: 200 },
  { id: "p2", label: "Material Market Value", delayMs: 900 },
  { id: "p3", label: "Markup Analysis", delayMs: 1600 },
  { id: "p4", label: "Values Match", delayMs: 2300 }
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
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (hasNavigated.current) {
      console.log("[scan flow] effect skipped – already navigated");
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
      ? { url: pending.url, ...(selectedValues.length > 0 && { selectedValues }) }
      : pending.tag
        ? {
            composition: pending.tag.composition,
            ...(pending.tag.brand && { brand: pending.tag.brand }),
            ...(pending.tag.price != null && pending.tag.price > 0 && { price: pending.tag.price }),
            ...(selectedValues.length > 0 && { selectedValues })
          }
        : { barcode: pending.barcode, ...(selectedValues.length > 0 && { selectedValues }) };
    console.log("[scan flow] request body prepared", { keys: Object.keys(body), hasUrl: !!body.url });

    const controller = new AbortController();

    const run = async () => {
      try {
        console.log("[scan flow] fetch /api/scan starting");
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        console.log("[scan flow] fetch response", res.status, res.statusText);

        let data: Record<string, unknown> = {};
        try {
          const text = await res.text();
          console.log("[scan flow] response body length", text?.length ?? 0);
          data = text ? JSON.parse(text) : {};
        }         catch (parseErr) {
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
          setLastError(toErrorCode(res.status, data as { code?: string }));
          setPending(null);
          setFlowError((data.message as string) || `Request failed (${res.status})`);
          return;
        }
        if (data.ok && data.analysis) {
          console.log("[scan flow] success – writing scanResult then navigating");
          const analysis = data.analysis as Parameters<typeof setResult>[0];
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
  }, [pending, setPending, setResult, setLastError, router]);

  useEffect(() => {
    const timers: Array<number> = [];
    items.forEach(({ id, delayMs }) => {
      const start = window.setTimeout(() => {
        let n = 0;
        const t = window.setInterval(() => {
          n = Math.min(n + 4, 100);
          setProgress((prev) => ({ ...prev, [id]: n }));
          if (n >= 100) window.clearInterval(t);
        }, 20);
        timers.push(start);
      }, delayMs);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [items]);

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
