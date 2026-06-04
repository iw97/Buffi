"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuthOptional } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { MagicLinkAuthBlock } from "@/components/auth/MagicLinkAuthBlock";
import { flushOnboardingAnswers } from "@/lib/auth/onboardingAnswers";
import {
  hasLocalOnboardingAnswers,
  onboardingIntroPath,
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
    if (!isConfigured || authLoading || !user) return;
    if (auth?.profile === null) return;
    if (profileHasCompletedOnboarding(auth?.profile) || hasLocalOnboardingAnswers()) return;
    router.replace(onboardingIntroPath(returnTo));
  }, [isConfigured, authLoading, user, auth?.profile, returnTo, router]);

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
    const signedInAs = user.email?.trim() || user.displayName?.trim() || "your account";
    return (
      <div className="min-h-screen">
        <div className="ob-shell">
          <div className="ob-step-label" style={{ marginBottom: 12 }}>
            You&apos;re signed in
          </div>
          <h2 className="ob-title">
            Create your
            <br />
            <em>account.</em>
          </h2>
          <p className="ob-desc">
            You&apos;re already signed in as <strong style={{ color: "var(--ivory)" }}>{signedInAs}</strong>.
          </p>
          <button
            className="ob-next"
            type="button"
            onClick={async () => {
              await flushOnboardingAnswers(user.uid, user.displayName);
              router.push(returnTo);
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  async function finishSignup(signedInUser: User) {
    await flushOnboardingAnswers(signedInUser.uid, signedInUser.displayName);
    router.push(
      resolvePostAuthPath({
        returnTo,
        authMode: "signup"
      })
    );
  }

  const onGoogle = async () => {
    try {
      setError(null);
      await finishSignup(await signInWithGoogle());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
    }
  };

  const onApple = async () => {
    try {
      setError(null);
      await finishSignup(await signInWithApple());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
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

          <MagicLinkAuthBlock
            returnTo={returnTo}
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

