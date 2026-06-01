"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
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
  const [magicEmail, setMagicEmail] = useState("");
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { handleGoogle: signInWithGoogle, handleEmailLink: sendMagicLink } = useSignIn();

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

  const onGoogle = async () => {
    try {
      setError(null);
      const signedInUser = await signInWithGoogle();
      await flushOnboardingAnswers(signedInUser.uid, signedInUser.displayName);
      router.push(
        resolvePostAuthPath({
          returnTo,
          authMode: "signup"
        })
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
    }
  };

  const handleSendSignInLink = async () => {
    setError(null);
    const email = magicEmail.trim();
    if (!email) {
      setError("Enter your email address");
      return;
    }
    try {
      await sendMagicLink(email, { returnTo, mode: "signup" });
      setLinkSentTo(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send sign-in link");
    }
  };

  const linkSentVisible = linkSentTo !== null;

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
          <button className="btn-google" type="button" onClick={onGoogle}>
            <span aria-hidden>G</span>
            Continue with Google
          </button>

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

          {!linkSentVisible ? (
            <div className="auth-input-wrap">
              <div className="auth-input-label">Email Address</div>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
              />
            </div>
          ) : (
            <p className="auth-legal" style={{ marginTop: 0, marginBottom: 8 }}>
              Check your email — we sent you a link to sign in or create your account at{" "}
              <strong style={{ color: "var(--ivory)" }}>{linkSentTo}</strong>.
            </p>
          )}

          {!linkSentVisible ? (
            <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={handleSendSignInLink}>
              Send magic link
            </button>
          ) : null}

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
        </div>
      </div>
    </div>
  );
}

