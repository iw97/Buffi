"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getObAnswer } from "@/lib/auth/onboardingAnswers";
import { getReflectionCopy } from "@/lib/auth/onboardingReflectionCopy";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";

export function OnboardingPersonalizedScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [reflectionCopy, setReflectionCopy] = useState("");

  useEffect(() => {
    const name = getObAnswer("buffi_ob_name") ?? "";
    const shopperType = getObAnswer("buffi_ob_shopper") ?? "";
    setReflectionCopy(getReflectionCopy(shopperType, name));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="ob-shell ob-shell--personalized">
        <p className="ob-desc ob-personalized-copy">{reflectionCopy}</p>

        <div className="ob-nav ob-nav--centered">
          <button
            className="ob-next"
            type="button"
            onClick={() => router.push(`/onboarding/reflection${stepQ}`)}
          >
            Let&apos;s shop smarter!
          </button>
        </div>
      </div>
    </div>
  );
}
