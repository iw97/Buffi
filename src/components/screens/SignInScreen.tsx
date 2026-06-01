"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/returnTo";
import { useSignIn } from "@/hooks/useSignIn";
import {
  onboardingIntroPath,
  resolvePostAuthPath
} from "@/lib/auth/onboardingStatus";

export function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");
  const auth = useAuthOptional();
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const [magicEmail, setMagicEmail] = useState("");
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { handleGoogle, handleEmailLink } = useSignIn();

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

  if (isConfigured && user) {
    const destination = resolvePostAuthPath({
      returnTo,
      profile: auth?.profile ?? null,
      user
    });
    router.replace(destination);
    return null;
  }

  const onGoogle = async () => {
    try {
      setError(null);
      const signedInUser = await handleGoogle();
      const destination = resolvePostAuthPath({
        returnTo,
        user: signedInUser
      });
      router.push(destination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const onMagicLink = async () => {
    setError(null);
    const email = magicEmail.trim();
    if (!email) {
      setError("Enter your email address");
      return;
    }
    try {
      await handleEmailLink(email, { returnTo, mode: "signin" });
      setLinkSentTo(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send sign-in link");
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

          {!linkSentTo ? (
            <>
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
              <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={onMagicLink}>
                Send magic link
              </button>
            </>
          ) : (
            <p className="auth-legal" style={{ marginTop: 0, marginBottom: 8 }}>
              Check your email — we sent you a sign-in link at{" "}
              <strong style={{ color: "var(--ivory)" }}>{linkSentTo}</strong>.
            </p>
          )}

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
        </div>
      </div>
    </div>
  );
}
