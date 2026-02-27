"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";

type AuthTab = "magic" | "password";

export function OnboardingAccountScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [tab, setTab] = useState<AuthTab>("magic");
  const [magicEmail, setMagicEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  const isConfigured = auth?.isConfigured ?? false;

  const handleGoogle = async () => {
    setError(null);
    if (isConfigured && auth) {
      try {
        await auth.signInWithGoogle();
        router.push("/scan");
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
        router.push("/scan");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-up failed");
      }
    } else if (!isConfigured) {
      router.push("/scan");
    } else {
      setError("Email and password (min 6 characters) required");
    }
  };

  const handleSignIn = async () => {
    setError(null);
    if (isConfigured && auth && passwordEmail.trim() && password) {
      try {
        await auth.signInWithEmail(passwordEmail.trim(), password);
        router.push("/scan");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    } else if (!isConfigured) {
      router.push("/scan");
    } else {
      setError("Email and password required");
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

  const codeStateVisible = codeSentTo !== null;

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
          Create a free account to keep your values, save scans, and sync across
          devices. Or skip for now and explore first.
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
              Email Link
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
            {!codeStateVisible ? (
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
                  className="ob-next"
                  type="button"
                  style={{ marginTop: 4 }}
                  onClick={() => {
                    const email = magicEmail.trim() || "you@example.com";
                    setCodeSentTo(email);
                    setTimeout(() => digitRefs.current[0]?.focus(), 50);
                  }}
                >
                  Send Login Code →
                </button>
                <p className="auth-legal" style={{ marginTop: 8 }}>
                  Magic link not implemented yet. Use password or Google.
                </p>
              </>
            ) : (
              <>
                <div className="code-hint">
                  We sent a 6-digit code to{" "}
                  <strong style={{ color: "var(--ivory)" }}>{codeSentTo}</strong>
                  . Enter it below.
                </div>
                <div className="code-input-row">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      className="code-digit"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      ref={(el) => {
                        digitRefs.current[i] = el;
                      }}
                      onChange={(e) => {
                        if (e.target.value.length === 1 && i < 5) {
                          digitRefs.current[i + 1]?.focus();
                        }
                      }}
                    />
                  ))}
                </div>
                <button className="ob-next" type="button" onClick={() => router.push("/scan")}>
                  Verify &amp; Start Scanning →
                </button>
                <button
                  className="resend-link"
                  type="button"
                  onClick={() => {
                    digitRefs.current.forEach((el) => {
                      if (el) el.value = "";
                    });
                    digitRefs.current[0]?.focus();
                  }}
                >
                  Resend code
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
          <button className="ob-back" type="button" onClick={() => router.push("/onboarding/budget")}>
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
            onClick={() => router.push("/scan")}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

