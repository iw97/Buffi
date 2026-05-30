"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";
import { saveObAnswer } from "@/lib/auth/onboardingAnswers";

const OPTIONS = [
  "Never",
  "Rarely",
  "Sometimes",
  "Often",
  "All the time",
];

export function OnboardingRegretScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        <div className="ob-progress">
          <div className="ob-pip done" />
          <div className="ob-pip active" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
        </div>

        <div className="ob-step-label">Step 2 of 7</div>
        <h2 className="ob-title">
          How often do you buy something and{" "}
          <em>regret it</em> within a month?
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
            onClick={() => router.push(`/onboarding/intro${stepQ}`)}
          >
            ←
          </button>
          <button
            className="ob-next"
            type="button"
            disabled={!selected}
            style={{ opacity: selected ? 1 : 0.4 }}
            onClick={() => {
              if (selected) saveObAnswer("buffi_ob_regret", selected);
              router.push(`/onboarding/quality${stepQ}`);
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
