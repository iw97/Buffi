"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import {
  hasLocalOnboardingAnswers,
  onboardingIntroPath,
  profileHasCompletedOnboarding
} from "@/lib/auth/onboardingStatus";

/**
 * Redirects signed-in users who have not finished onboarding quiz
 * (and are not mid-quiz in localStorage) to /onboarding/intro.
 */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthOptional();
  const loading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const isConfigured = auth?.isConfigured ?? false;

  useEffect(() => {
    if (!isConfigured || loading || !user) return;
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth/")) return;
    if (profile === null) return;

    if (profileHasCompletedOnboarding(profile) || hasLocalOnboardingAnswers()) {
      return;
    }

    router.replace(onboardingIntroPath(pathname || "/scan"));
  }, [isConfigured, loading, user, profile, pathname, router]);

  return null;
}
