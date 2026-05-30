"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";
import { saveObAnswer } from "@/lib/auth/onboardingAnswers";

export function OnboardingIntroScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [name, setName] = useState("");

  function handleContinue() {
    saveObAnswer("buffi_ob_name", name.trim());
    router.push(`/onboarding/regret${stepQ}`);
  }

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        <div className="ob-progress">
          <div className="ob-pip active" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
          <div className="ob-pip" />
        </div>

        <div className="ob-step-label">Step 1 of 7</div>
        <p className="ob-desc" style={{ marginBottom: 28 }}>
          Most people have no idea what their clothes are actually made of — or
          what they actually cost to make. Buffi changes that.
        </p>

        <h2 className="ob-title">
          What&apos;s your
          <br />
          <em>name?</em>
        </h2>

        <div style={{ marginTop: 24 }}>
          <input
            className="auth-input"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && handleContinue()}
            autoFocus
          />
        </div>

        <div className="ob-nav">
          <button
            className="ob-next"
            type="button"
            disabled={!name.trim()}
            style={{ opacity: name.trim() ? 1 : 0.4 }}
            onClick={handleContinue}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
