"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { BUFFI_SIGNIN_EMAIL_KEY } from "@/lib/firebase/client";
import { onboardingReturnToQuery, safeReturnPath } from "@/lib/auth/returnTo";

type AuthTab = "magic" | "password";

export function OnboardingAccountScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"), "/scan");
  const stepQ = onboardingReturnToQuery(searchParams);
  const auth = useAuthOptional();
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const [tab, setTab] = useState<AuthTab>("magic");
  const [magicEmail, setMagicEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

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
    const signedInAs = user.email?.trim() || user.displayName?.trim() || "your account";
    return (
      <div className="min-h-screen">
        <div className="ob-shell">
          <div className="ob-step-label" style={{ marginBottom: 12 }}>
            You&apos;re signed in
          </div>
          <h2 className="ob-title">
            Profile
            <br />
            <em>updated.</em>
          </h2>
          <p className="ob-desc">
            You&apos;re already logged in as <strong style={{ color: "var(--ivory)" }}>{signedInAs}</strong>.
            No need to create another account — your values flow is complete.
          </p>
          <button className="ob-next" type="button" onClick={() => router.push(returnTo)}>
            Continue →
          </button>
          <div className="ob-nav" style={{ marginTop: 24 }}>
            <button className="ob-back" type="button" onClick={() => router.push(`/onboarding/budget${stepQ}`)}>
              ←
            </button>
            <button
              className="ob-next"
              type="button"
              style={{
                background: "transparent",
                border: "1px solid var(--border-light)",
                color: "var(--text-dim)",
                fontSize: 11,
                letterSpacing: 1
              }}
              onClick={() => router.push(returnTo)}
            >
              {returnTo === "/profile" ? "Back to profile" : "Back to app"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogle = async () => {
    console.log("sign in button clicked");
    setError(null);
    if (isConfigured && auth) {
      try {
        console.log("calling Firebase auth");
        await auth.signInWithGoogle();
        console.log("Firebase auth called", { method: "google" });
        router.push(returnTo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    } else {
      router.push("/scan");
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (isConfigured && auth && passwordEmail.trim() && password.length >= 6) {
      try {
        await auth.signUpWithEmail(passwordEmail.trim(), password);
        router.push(returnTo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-up failed");
      }
    } else if (!isConfigured) {
      router.push(returnTo);
    } else {
      setError("Email and password (min 6 characters) required");
    }
  };

  const handleSignIn = async () => {
    setError(null);
    if (isConfigured && auth && passwordEmail.trim() && password) {
      try {
        await auth.signInWithEmail(passwordEmail.trim(), password);
        router.push(returnTo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    } else if (!isConfigured) {
      router.push(returnTo);
    } else {
      setError("Email and password required");
    }
  };

  const handleSendSignInLink = async () => {
    console.log("sign in button clicked");
    setError(null);
    const email = magicEmail.trim();
    if (!email) {
      setError("Enter your email address");
      return;
    }
    if (!isConfigured || !auth) {
      router.push(returnTo);
      return;
    }
    try {
      console.log("calling Firebase auth");
      await auth.sendSignInLinkToEmail(email, returnTo);
      console.log("Firebase auth called", { method: "magic-link", email });
      try {
        window.localStorage.setItem(BUFFI_SIGNIN_EMAIL_KEY, email);
      } catch {
        /* ignore */
      }
      setLinkSentTo(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send sign-in link");
    }
  };

  const progress = useMemo(
    () => (
      <div className="ob-step-label" style={{ marginBottom: 12 }}>
        Last Step · Create Account
      </div>
    ),
    []
  );

  const linkSentVisible = linkSentTo !== null;

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        {progress}
        <h2 className="ob-title">
          Save your
          <br />
          <em>profile.</em>
        </h2>
        <p className="ob-desc">
          Create a free account to keep your values, save scans, and sync across devices.
          New accounts can use the email magic link — no password required.
        </p>

        <div className="auth-block">
          <button className="btn-google" type="button" onClick={handleGoogle}>
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

          <div className="auth-method-tabs">
            <button
              className={`auth-tab ${tab === "magic" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("magic")}
            >
              Magic link
            </button>
            <button
              className={`auth-tab ${tab === "password" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("password")}
            >
              Password
            </button>
          </div>

          <div className={`auth-panel ${tab === "magic" ? "active" : ""}`}>
            {!linkSentVisible ? (
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
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={handleSendSignInLink}
                >
                  Send magic link
                </button>
              </>
            ) : (
              <>
                <p className="auth-legal" style={{ marginTop: 0, marginBottom: 8 }}>
                  Check your email — we sent you a link to sign in or create your account at{" "}
                  <strong style={{ color: "var(--ivory)" }}>{linkSentTo}</strong>.
                </p>
                <p className="auth-legal" style={{ color: "var(--text-dim)", fontSize: 13 }}>
                  You can close this tab.
                </p>
                <button
                  type="button"
                  className="auth-tab"
                  style={{ marginTop: 16 }}
                  onClick={() => setLinkSentTo(null)}
                >
                  Use a different email
                </button>
              </>
            )}
          </div>

          <div className={`auth-panel ${tab === "password" ? "active" : ""}`}>
            <div className="auth-input-wrap">
              <div className="auth-input-label">Email Address</div>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
              />
            </div>
            <div className="auth-input-wrap">
              <div className="auth-input-label">Password</div>
              <input
                className="auth-input"
                type="password"
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="ob-next" type="button" style={{ marginTop: 4 }} onClick={handleSignUp}>
              Create Account →
            </button>
          </div>

          <div className="auth-legal">
            By creating an account you agree to our
            <br />
            Terms of Service &amp; Privacy Policy
          </div>
        </div>

        <div className="ob-nav" style={{ marginTop: 24 }}>
          <button className="ob-back" type="button" onClick={() => router.push(`/onboarding/budget${stepQ}`)}>
            ←
          </button>
          <button
            className="ob-next"
            type="button"
            style={{
              background: "transparent",
              border: "1px solid var(--border-light)",
              color: "var(--text-dim)",
              fontSize: 11,
              letterSpacing: 1
            }}
            onClick={() => router.push("/")}
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

