"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/returnTo";

type ProgressId = "p1" | "p2" | "p3" | "p4";

const PROGRESS_ITEMS: Array<{ id: ProgressId; label: string; delayMs: number }> = [
  { id: "p1", label: "Preferences", delayMs: 200 },
  { id: "p2", label: "Shopping Profile", delayMs: 900 },
  { id: "p3", label: "Values", delayMs: 1600 },
  { id: "p4", label: "Match Settings", delayMs: 2300 },
];

export function OnboardingReflectionScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");

  const [progress, setProgress] = useState<Record<ProgressId, number>>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
  });
  const hasNavigated = useRef(false);
  const items = useMemo(() => PROGRESS_ITEMS, []);

  useEffect(() => {
    const timers: Array<number> = [];
    items.forEach(({ id, delayMs }) => {
      const t = window.setTimeout(() => {
        let n = 0;
        const interval = window.setInterval(() => {
          n = Math.min(n + 4, 100);
          setProgress((prev) => ({ ...prev, [id]: n }));
          if (n >= 100) window.clearInterval(interval);
        }, 20);
        timers.push(interval);
      }, delayMs);
      timers.push(t);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [items]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        const params = new URLSearchParams({ returnTo });
        router.push(`/onboarding/account?${params.toString()}`);
      }
    }, 3400);
    return () => window.clearTimeout(t);
  }, [router, returnTo]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-10">
      <div className="analyzing-label">Personalizing your Buffi experience...</div>

      <div className="progress-block">
        {items.map((it) => (
          <div key={it.id} className="progress-item">
            <div className="progress-label-row">
              <span>{it.label}</span>
              <span>{progress[it.id]}%</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress[it.id]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
