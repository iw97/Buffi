"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { useSignIn } from "@/hooks/useSignIn";

type AuthMode = "signin" | "signup";

type Props = {
  mode: AuthMode;
  onSignedIn: (user: User) => void | Promise<void>;
  footer?: React.ReactNode;
};

export function EmailPasswordAuthBlock({ mode, onSignedIn, footer }: Props) {
  const { handleEmailSignIn, handleEmailSignUp, handlePasswordReset } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState<"signin" | "signup" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function onSignIn() {
    setError(null);
    setResetSent(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password");
      return;
    }
    setSubmitting("signin");
    try {
      await onSignedIn(await handleEmailSignIn(trimmedEmail, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSubmitting(null);
    }
  }

  async function onCreateAccount() {
    setError(null);
    setResetSent(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password");
      return;
    }
    setSubmitting("signup");
    try {
      await onSignedIn(
        await handleEmailSignUp(trimmedEmail, password, {
          saveOnboardingPending: mode === "signup"
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setSubmitting(null);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setResetSent(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email address first");
      return;
    }
    setSubmitting("reset");
    try {
      await handlePasswordReset(trimmedEmail);
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      <div className="auth-input-wrap">
        <div className="auth-input-label">Email Address</div>
        <input
          className="auth-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="auth-input-wrap">
        <div className="auth-input-label">Password</div>
        <input
          className="auth-input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim() && password) {
              if (mode === "signup") void onCreateAccount();
              else void onSignIn();
            }
          }}
        />
      </div>

      {mode === "signin" && (
        <p className="auth-legal" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="auth-tab"
            disabled={submitting !== null}
            onClick={() => void onForgotPassword()}
          >
            {submitting === "reset" ? "Sending…" : "Forgot password?"}
          </button>
        </p>
      )}

      {resetSent && (
        <p className="auth-legal" style={{ color: "var(--teal)" }}>
          Password reset email sent — check your inbox.
        </p>
      )}

      <div className="auth-email-actions">
        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%" }}
          disabled={submitting !== null}
          onClick={() => void onSignIn()}
        >
          {submitting === "signin" ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%", marginTop: 10 }}
          disabled={submitting !== null}
          onClick={() => void onCreateAccount()}
        >
          {submitting === "signup" ? "Creating account…" : "Create account"}
        </button>
      </div>

      {error && (
        <p className="auth-legal" style={{ color: "var(--red)", marginTop: 12 }}>
          {error}
        </p>
      )}

      {footer}
    </>
  );
}
