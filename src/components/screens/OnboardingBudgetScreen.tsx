"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingBudgetScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState<number>(75);

  const progress = useMemo(
    () => (
      <div className="ob-progress">
        <div className="ob-pip done" />
        <div className="ob-pip done" />
        <div className="ob-pip active" />
      </div>
    ),
    []
  );

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        {progress}

        <div className="ob-step-label">Step 3 of 3 · Your Budget</div>
        <h2 className="ob-title">
          What&apos;s your
          <br />
          sweet <em>spot?</em>
        </h2>
        <p className="ob-desc">
          Set a typical per-item budget. We&apos;ll flag anything that seems
          overpriced for what it actually is.
        </p>

        <div className="budget-block">
          <div className="budget-wrap">
            <span className="budget-symbol">$</span>
            <input
              className="budget-input"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              placeholder="75"
              inputMode="numeric"
            />
          </div>
          <div className="budget-hint">Per item · Retail price</div>
          <div className="budget-presets">
            {[25, 50, 75, 150].map((val) => (
              <button
                key={val}
                className="preset-btn"
                type="button"
                onClick={() => setBudget(val)}
              >
                ${val}
              </button>
            ))}
            <button className="preset-btn" type="button" onClick={() => setBudget(250)}>
              $250+
            </button>
          </div>
        </div>

        <div className="ob-nav">
          <button className="ob-back" type="button" onClick={() => router.push("/onboarding/priorities")}>
            ←
          </button>
          <button className="ob-next" type="button" onClick={() => router.push("/onboarding/account")}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

