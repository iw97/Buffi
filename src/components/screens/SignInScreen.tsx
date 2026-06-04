"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuthOptional } from "@/contexts/AuthContext";
import { getUserProfile } from "@/lib/firebase/firestore";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { MagicLinkAuthBlock } from "@/components/auth/MagicLinkAuthBlock";
import {
  onboardingIntroPath,
  resolvePostAuthPath
} from "@/lib/auth/onboardingStatus";
import { useState } from "react";

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

  if (isConfigured && user && auth?.profile === null) {
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
    const destination = resolvePostAuthPath({
      returnTo,
      profile: auth?.profile ?? null,
      authMode: "signin"
    });
    router.replace(destination);
    return null;
  }

  async function finishSignIn(signedInUser: User) {
    const profile = await getUserProfile(signedInUser.uid);
    const destination = resolvePostAuthPath({
      returnTo,
      profile,
      authMode: "signin"
    });
    router.push(destination);
  }

  const onGoogle = async () => {
    try {
      setError(null);
      await finishSignIn(await handleGoogle());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const onApple = async () => {
    try {
      setError(null);
      await finishSignIn(await handleApple());
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

          <MagicLinkAuthBlock
            returnTo={returnTo}
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
                  Create account
                </button>
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
