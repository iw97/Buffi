"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getObAnswer } from "@/lib/auth/onboardingAnswers";
import { firstNameFromOnboardingName } from "@/lib/auth/onboardingSteps";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";

export function OnboardingWelcomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [firstName, setFirstName] = useState("there");

  useEffect(() => {
    const name = getObAnswer("buffi_ob_name") ?? "";
    setFirstName(firstNameFromOnboardingName(name));
  }, []);

  function handleContinue() {
    router.push(`/onboarding/regret${stepQ}`);
  }

  return (
    <div className="min-h-screen ob-welcome">
      <div className="ob-welcome-glow" aria-hidden />

      <div className="ob-shell ob-shell--welcome">
        <div className="ob-welcome-content">
          <p className="ob-welcome-eyebrow ob-welcome-fade ob-welcome-fade--0">
            Welcome to
          </p>
          <h1 className="ob-welcome-headline ob-welcome-fade ob-welcome-fade--400">
            Material Intelligence.
          </h1>
          <p className="ob-welcome-greeting ob-welcome-fade ob-welcome-fade--800">
            Hi {firstName}.
          </p>

          <div className="ob-welcome-body ob-welcome-fade ob-welcome-fade--1400">
            <p>
              Buffi scans what you wear and tells you the truth — what it&apos;s made of, what it
              cost to make, and whether the price is actually worth it.
            </p>
            <p>
              No brand deals. No sponsored results. Just the receipt.
            </p>
          </div>
        </div>

        <div className="ob-nav ob-nav--centered ob-nav--stacked ob-welcome-fade ob-welcome-fade--2000">
          <button className="ob-next" type="button" onClick={handleContinue}>
            Let&apos;s go →
          </button>
          <p className="auth-legal ob-welcome-legal">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="ob-welcome-legal-link">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="ob-welcome-legal-link">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
