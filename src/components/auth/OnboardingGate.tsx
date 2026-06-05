"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getRedirectResult } from "firebase/auth";
import { useAuthOptional } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import {
  hasLocalOnboardingAnswers,
  onboardingIntroPath,
  shouldGateRedirectToOnboarding
} from "@/lib/auth/onboardingStatus";

/**
 * Redirects signed-in users who have not finished onboarding
 * to /onboarding/intro. Waits for profile load before deciding.
 */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const auth = useAuthOptional();
  const loading = auth?.loading ?? true;
  const profileLoading = auth?.profileLoading ?? false;
  const profileReady = auth?.profileReady ?? false;
  const profileError = auth?.profileError ?? null;
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const isConfigured = auth?.isConfigured ?? false;

  useEffect(() => {
    if (profileError) return;
    if (!isConfigured || loading || !user) return;
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth/")) return;

    if (searchParams.get("from") === "auth") {
      return;
    }

    if (profileLoading || !profileReady) {
      return;
    }

    if (hasLocalOnboardingAnswers()) {
      return;
    }

    if (!shouldGateRedirectToOnboarding({ profileReady, profileError, profile })) {
      return;
    }

    router.replace(onboardingIntroPath(pathname || "/scan"));
  }, [
    profileError,
    isConfigured,
    loading,
    profileLoading,
    profileReady,
    user,
    profile,
    pathname,
    router,
    searchParams
  ]);

  if (profileError && user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-10"
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)" }}
        aria-live="polite"
      >
        <div className="analyzing-label">Couldn&apos;t load profile</div>
        <p className="auth-legal" style={{ color: "var(--red)", textAlign: "center", maxWidth: 360 }}>
          {profileError}
        </p>
        <p className="auth-legal" style={{ color: "var(--text-dim)", textAlign: "center", maxWidth: 320 }}>
          Your account is signed in, but we couldn&apos;t create or load your profile. Check that the server is
          configured, then try again.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void auth?.refreshProfile?.()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (user && profileLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-10"
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)" }}
        aria-live="polite"
      >
        <div className="analyzing-label">Loading</div>
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          Setting up your account…
        </p>
      </div>
    );
  }

  return null;
}
