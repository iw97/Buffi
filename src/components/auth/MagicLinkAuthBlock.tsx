"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { useSignIn, type EmailLinkSubmitResult } from "@/hooks/useSignIn";
import { normalizeAuthEmail } from "@/lib/auth/demoAccount";

type MagicLinkMode = "signin" | "signup";

type Props = {
  returnTo: string;
  mode: MagicLinkMode;
  onSignedIn: (user: User) => void | Promise<void>;
  footer?: React.ReactNode;
};

type Step = "email" | "link-sent" | "demo-code";

export function MagicLinkAuthBlock({ returnTo, mode, onSignedIn, footer }: Props) {
  const { handleEmailLink, handleDemoCodeSignIn } = useSignIn();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendLink() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address");
      return;
    }

    setSubmitting(true);
    try {
      const result: EmailLinkSubmitResult = await handleEmailLink(trimmed, { returnTo, mode });
      if (result.kind === "demo-code") {
        setStep("demo-code");
        return;
      }
      setStep("link-sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send sign-in link");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitDemoCode() {
    setError(null);
    if (!code.trim()) {
      setError("Enter the verification code");
      return;
    }

    setSubmitting(true);
    try {
      const user = await handleDemoCodeSignIn(email, code);
      await onSignedIn(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetEmailStep() {
    setStep("email");
    setCode("");
    setError(null);
  }

  if (step === "demo-code") {
    return (
      <>
        <p className="auth-legal" style={{ marginTop: 0, marginBottom: 8 }}>
          Enter the verification code for{" "}
          <strong style={{ color: "var(--ivory)" }}>{normalizeAuthEmail(email)}</strong>.
        </p>

        <div className="auth-input-wrap">
          <div className="auth-input-label">Verification code</div>
          <input
            className="auth-input auth-input--code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && code.trim() && onSubmitDemoCode()}
            autoFocus
          />
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", marginTop: 12 }}
          disabled={submitting || !code.trim()}
          onClick={onSubmitDemoCode}
        >
          {submitting ? "Signing in…" : "Continue"}
        </button>

        <p className="auth-legal demo-review-note">
          App Store review demo — use the code from App Review notes.
        </p>

        {error && (
          <p className="auth-legal" style={{ color: "var(--red)" }}>
            {error}
          </p>
        )}

        <p className="auth-legal" style={{ marginTop: 12 }}>
          <button type="button" className="auth-tab" onClick={resetEmailStep}>
            Use a different email
          </button>
        </p>

        {footer}
      </>
    );
  }

  if (step === "link-sent") {
    const linkCopy =
      mode === "signup"
        ? "Check your email — we sent you a link to sign in or create your account at"
        : "Check your email — we sent you a sign-in link at";

    return (
      <>
        <p className="auth-legal" style={{ marginTop: 0, marginBottom: 8 }}>
          {linkCopy}{" "}
          <strong style={{ color: "var(--ivory)" }}>{normalizeAuthEmail(email)}</strong>.
        </p>
        <p className="auth-legal" style={{ marginTop: 12 }}>
          <button type="button" className="auth-tab" onClick={resetEmailStep}>
            Use a different email
          </button>
        </p>
        {footer}
      </>
    );
  }

  return (
    <>
      <div className="auth-input-wrap">
        <div className="auth-input-label">Email Address</div>
        <input
          className="auth-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email.trim() && onSendLink()}
        />
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%", marginTop: 12 }}
        disabled={submitting}
        onClick={onSendLink}
      >
        {submitting ? "Sending…" : "Send magic link"}
      </button>

      {error && (
        <p className="auth-legal" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {footer}
    </>
  );
}
