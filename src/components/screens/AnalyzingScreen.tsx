"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    const hasInput = pending?.url || pending?.barcode || pending?.tag;
    if (!hasInput) {
      router.replace("/scan");
      return;
    }

    const body = pending.url
      ? { url: pending.url }
      : pending.tag
        ? {
            composition: pending.tag.composition,
            ...(pending.tag.brand && { brand: pending.tag.brand }),
            ...(pending.tag.price != null && pending.tag.price > 0 && { price: pending.tag.price })
          }
        : { barcode: pending.barcode };
    const controller = new AbortController();

    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLastError(toErrorCode(res.status, data));
          setPending(null);
          router.replace("/scan");
          return;
        }
        if (data.ok && data.analysis) {
          setResult(data.analysis);
          setPending(null);
          router.replace("/breakdown");
        } else {
          setLastError("unknown");
          setPending(null);
          router.replace("/scan");
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLastError("unknown");
        setPending(null);
        router.replace("/scan");
      });

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
    </div>
  );
}
