"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { getObAnswer } from "@/lib/auth/onboardingAnswers";

type ProgressId = "p1" | "p2" | "p3" | "p4";

const PROGRESS_ITEMS: Array<{ id: ProgressId; label: string; delayMs: number }> = [
  { id: "p1", label: "Preferences", delayMs: 200 },
  { id: "p2", label: "Shopping Profile", delayMs: 900 },
  { id: "p3", label: "Values", delayMs: 1600 },
  { id: "p4", label: "Match Settings", delayMs: 2300 },
];

const COPY: Record<string, string> = {
  "Someone brands can't fool":
    "{name}, Buffi was built for you. You're done being misled by marketing language and vague labels. From here on, you'll know exactly what's in what you're buying — and whether it's worth a single dollar of what they're charging.",
  "Someone who buys less but better":
    "{name}, that's exactly what Buffi helps you do. Instead of guessing what's quality and what isn't, you'll have the data to choose fewer, smarter pieces — and stop wasting money on things that don't deliver.",
  "Someone who actually knows what they're paying for":
    "{name}, most people never find out. You're about to. Buffi breaks down what your clothes actually cost to make, what you're really paying for, and whether the math adds up.",
  "All three — I'm done settling":
    "{name}, then Buffi is exactly where you should be. You're about to shop with more intelligence than most people ever will — knowing what's in it, what it cost to make, and whether it's actually worth it.",
};

function getReflectionCopy(shopperType: string, name: string): string {
  const template = COPY[shopperType] ?? COPY["All three — I'm done settling"];
  const displayName = name.trim() || "You";
  return template.replace("{name}", displayName);
}

export function OnboardingReflectionScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");

  const [name, setName] = useState("");
  const [shopperType, setShopperType] = useState("");
  const [progress, setProgress] = useState<Record<ProgressId, number>>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
  });
  const hasNavigated = useRef(false);
  const items = useMemo(() => PROGRESS_ITEMS, []);

  useEffect(() => {
    setName(getObAnswer("buffi_ob_name") ?? "");
    setShopperType(getObAnswer("buffi_ob_shopper") ?? "");
  }, []);

  // Run progress bars
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

  // Navigate to account after animation completes (~3.2s)
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

  const reflectionCopy = getReflectionCopy(shopperType, name);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-10">
      <p
        className="ob-desc"
        style={{ textAlign: "center", maxWidth: 340, marginBottom: 0 }}
      >
        {reflectionCopy}
      </p>

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
