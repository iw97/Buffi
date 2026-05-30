"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";
import { saveObAnswer } from "@/lib/auth/onboardingAnswers";

const OPTIONS = [
  "Someone brands can't fool",
  "Someone who buys less but better",
  "Someone who actually knows what they're paying for",
  "All three — I'm done settling",
];

export function OnboardingShopperScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [selected, setSelected] = useState<string | null>(null);

  function handleContinue() {
    if (selected) saveObAnswer("buffi_ob_shopper", selected);
    router.push(`/onboarding/reflection${stepQ}`);
  }

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        <div className="ob-progress">
          <div className="ob-pip done" />
          <div className="ob-pip done" />
          <div className="ob-pip done" />
          <div className="ob-pip done" />
          <div className="ob-pip done" />
          <div className="ob-pip done" />
          <div className="ob-pip active" />
        </div>

        <div className="ob-step-label">Step 7 of 7</div>
        <h2 className="ob-title">
          What kind of shopper do you{" "}
          <em>want to be?</em>
        </h2>

        <div className="chip-grid" style={{ marginTop: 24 }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`chip ${selected === opt ? "selected" : ""}`}
              onClick={() => setSelected(opt)}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="ob-nav">
          <button
            className="ob-back"
            type="button"
            onClick={() => router.push(`/onboarding/priorities${stepQ}`)}
          >
            ←
          </button>
          <button
            className="ob-next"
            type="button"
            disabled={!selected}
            style={{ opacity: selected ? 1 : 0.4 }}
            onClick={handleContinue}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
