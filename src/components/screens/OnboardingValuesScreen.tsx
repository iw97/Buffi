"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";

const DEFAULT_CHIPS = [
  { label: "Natural fibers only", selected: true },
  { label: "No virgin plastic", selected: false },
  { label: "Secondhand first", selected: true },
  { label: "Made in USA", selected: false },
  { label: "Union-made", selected: false },
  { label: "Cost-per-wear thinker", selected: true },
  { label: "Capsule wardrobe", selected: false },
  { label: "No animal products", selected: false },
  { label: "Certified sustainable", selected: false },
  { label: "Avoid fast fashion", selected: true }
];

export function OnboardingValuesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [chips, setChips] = useState(DEFAULT_CHIPS);

  const progress = useMemo(
    () => (
      <div className="ob-progress">
        <div className="ob-pip active" />
        <div className="ob-pip" />
        <div className="ob-pip" />
      </div>
    ),
    []
  );

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        {progress}

        <div className="ob-step-label">Step 1 of 3 · Your Values</div>
        <h2 className="ob-title">
          What matters
          <br />
          most to <em>you?</em>
        </h2>
        <p className="ob-desc">
          Select everything that applies. This shapes how we score every item
          you scan.
        </p>

        <div className="chip-grid">
          {chips.map((chip, idx) => (
            <button
              key={chip.label}
              type="button"
              className={`chip ${chip.selected ? "selected" : ""}`}
              onClick={() =>
                setChips((prev) =>
                  prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
                )
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="ob-nav">
          <button
            className="ob-next"
            type="button"
            onClick={() => router.push(`/onboarding/priorities${stepQ}`)}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

