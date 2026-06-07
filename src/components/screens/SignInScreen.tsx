"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuthOptional } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { EmailPasswordAuthBlock } from "@/components/auth/EmailPasswordAuthBlock";
import {
  onboardingIntroPath,
  profileHasCompletedOnboarding,
  resolvePostAuthPath
} from "@/lib/auth/onboardingStatus";

export function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");
  const auth = useAuthOptional();
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const [error, setError] = useState<string | null>(null);
  const { handleGoogle, handleApple } = useSignIn();

  const isConfigured = auth?.isConfigured ?? false;

  useEffect(() => {
    if (!isConfigured || authLoading || !user) return;
    if (auth?.profileError) return;
    if (auth?.profileLoading || !auth?.profileReady) return;
    if (!profileHasCompletedOnboarding(auth?.profile)) return;

    const destination = resolvePostAuthPath({
      returnTo,
      profile: auth?.profile ?? null,
      authMode: "signin"
    });
    router.replace(destination);
  }, [
    isConfigured,
    authLoading,
    user,
    auth?.profile,
    auth?.profileLoading,
    auth?.profileReady,
    auth?.profileError,
    returnTo,
    router
  ]);

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

  if (isConfigured && user && !auth?.profileError) {
    if (auth?.profileLoading || !auth?.profileReady) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
          <div className="analyzing-label">Loading</div>
          <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
            Setting up your account…
          </p>
        </div>
      );
    }
    if (profileHasCompletedOnboarding(auth?.profile)) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
          <div className="analyzing-label">Loading</div>
          <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
            Signing you in…
          </p>
        </div>
      );
    }
  }

  function finishSignIn(_signedInUser: User) {
    const destination = resolvePostAuthPath({
      returnTo,
      authMode: "signin"
    });
    console.log('[google] redirecting to', destination);
    router.replace(destination);
  }

  const onGoogle = async () => {
    try {
      console.log('[google] button clicked');
      setError(null);
      finishSignIn(await handleGoogle());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const onApple = async () => {
    try {
      setError(null);
      finishSignIn(await handleApple());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        <h2 className="ob-title">
          Welcome
          <br />
          <em>back.</em>
        </h2>
        <p className="ob-desc">Sign in to your Buffi account</p>

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
            mode="signin"
            onSignedIn={finishSignIn}
            footer={
              <p className="auth-legal" style={{ marginTop: 12 }}>
                New to Buffi?{" "}
                <button
                  type="button"
                  className="auth-tab"
                  onClick={() => router.push(onboardingIntroPath(returnTo))}
                >
                  Start onboarding
                </button>
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
