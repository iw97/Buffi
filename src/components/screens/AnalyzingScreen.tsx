"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProgressId = "p1" | "p2" | "p3" | "p4";

const ORDER: Array<{ id: ProgressId; label: string; delayMs: number }> = [
  { id: "p1", label: "Fiber Composition", delayMs: 200 },
  { id: "p2", label: "Material Market Value", delayMs: 900 },
  { id: "p3", label: "Markup Analysis", delayMs: 1600 },
  { id: "p4", label: "Values Match", delayMs: 2300 }
];

export function AnalyzingScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<Record<ProgressId, number>>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0
  });

  const items = useMemo(() => ORDER, []);

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
      }, delayMs);
      timers.push(start);
    });

    const nav = window.setTimeout(() => router.push("/breakdown"), 3400);
    timers.push(nav);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [items, router]);

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

