"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuthOptional } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { EmailPasswordAuthBlock } from "@/components/auth/EmailPasswordAuthBlock";
import { completeOnboardingSignup } from "@/lib/auth/completeOnboardingSignup";
import {
  hasLocalOnboardingAnswers,
  profileHasCompletedOnboarding,
  resolvePostAuthPath
} from "@/lib/auth/onboardingStatus";

export function OnboardingAccountScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");
  const auth = useAuthOptional();
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const [error, setError] = useState<string | null>(null);
  const { handleGoogle: signInWithGoogle, handleApple: signInWithApple } = useSignIn();

  const isConfigured = auth?.isConfigured ?? false;

  useEffect(() => {
    const signedInUser = user;
    if (!isConfigured || authLoading || !signedInUser) return;
    if (auth?.profileLoading) return;

    if (profileHasCompletedOnboarding(auth?.profile)) {
      router.replace(returnTo);
      return;
    }

    if (signedInUser.providerData.some((p) => p.providerId === "apple.com")) {
      router.replace(returnTo);
      return;
    }

    if (hasLocalOnboardingAnswers()) return;

    let cancelled = false;
    const { uid, email: authEmail, displayName } = signedInUser;

    async function restoreAndRoute() {
      const email = authEmail?.trim();
      if (!email) return;

      try {
        await completeOnboardingSignup(uid, email, displayName);
        await auth?.refreshProfile?.();
        if (cancelled) return;
        if (profileHasCompletedOnboarding(auth?.profile)) {
          router.replace(returnTo);
        }
      } catch {
        /* stay on account */
      }
    }

    void restoreAndRoute();
    return () => {
      cancelled = true;
    };
  }, [isConfigured, authLoading, user, auth?.profile, auth?.profileLoading, returnTo, router, auth]);

  if (isConfigured && authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <div className="analyzing-label">Loading</div>
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          Checking your account…
        </p>
      </div>
    );
  }

  if (isConfigured && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <div className="analyzing-label">Loading</div>
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          Setting up your account…
        </p>
      </div>
    );
  }

  async function finishSignup(signedInUser: User) {
    const isApple = signedInUser.providerData.some((p) => p.providerId === "apple.com");

    if (isApple) {
      if (signedInUser.email && hasLocalOnboardingAnswers()) {
        await completeOnboardingSignup(
          signedInUser.uid,
          signedInUser.email,
          signedInUser.displayName
        );
      }
      await auth?.refreshProfile?.();
      router.replace(returnTo);
      return;
    }

    if (signedInUser.email) {
      await completeOnboardingSignup(
        signedInUser.uid,
        signedInUser.email,
        signedInUser.displayName
      );
      await auth?.refreshProfile?.();
    }
    router.push(
      resolvePostAuthPath({
        returnTo,
        authMode: "signup",
        profile: auth?.profile ?? null
      })
    );
  }

  const onGoogle = async () => {
    try {
      setError(null);
      await finishSignup(await signInWithGoogle());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  const onApple = async () => {
    try {
      setError(null);
      await finishSignup(await signInWithApple());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        <h2 className="ob-title">
          Create your
          <br />
          <em>account.</em>
        </h2>
        <p className="ob-desc">
          Free to join. No credit card needed.
        </p>

        <div className="auth-block">
          <SocialSignInButtons onGoogle={onGoogle} onApple={onApple} />

          {error && (
            <p className="auth-legal" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <div className="auth-divider-text">or</div>
            <div className="auth-divider-line" />
          </div>

          <EmailPasswordAuthBlock
            mode="signup"
            onSignedIn={finishSignup}
            footer={
              <p className="auth-legal" style={{ marginTop: 12 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-tab"
                  onClick={() => router.push(`/signin?${new URLSearchParams({ returnTo }).toString()}`)}
                >
                  Sign in
                </button>
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
