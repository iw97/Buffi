"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { onboardingReturnToQuery, safeReturnPath } from "@/lib/auth/returnTo";
import { saveObAnswer } from "@/lib/auth/onboardingAnswers";

export function OnboardingIntroScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");
  const [name, setName] = useState("");

  useEffect(() => {
    const signedInUser = auth?.user;
    if (!signedInUser) return;
    const isApple = signedInUser.providerData.some((p) => p.providerId === "apple.com");
    if (!isApple) return;
    if (auth?.profileLoading || !auth?.profileReady) return;
    router.replace(returnTo);
  }, [auth?.user, auth?.profileLoading, auth?.profileReady, returnTo, router]);

  function handleContinue() {
    saveObAnswer("buffi_ob_name", name.trim());
    router.push(`/onboarding/welcome${stepQ}`);
  }

  async function handleSignIn() {
    if (auth?.user) {
      await auth.signOut();
    }
    router.push(`/signin?${new URLSearchParams({ returnTo }).toString()}`);
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

        <div className="ob-nav ob-nav--intro-actions">
          <button
            className="ob-next"
            type="button"
            disabled={!name.trim()}
            style={{ opacity: name.trim() ? 1 : 0.4 }}
            onClick={handleContinue}
          >
            Continue →
          </button>
          <button
            type="button"
            className="ob-intro-signin"
            onClick={() => void handleSignIn()}
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
