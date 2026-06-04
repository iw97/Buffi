"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { auth as firebaseAuth } from "@/lib/firebase";
import { flushOnboardingAnswers } from "@/lib/auth/onboardingAnswers";
import { readLoginEmailForLink } from "@/lib/auth/emailLinkCallback";
import {
  destinationAfterMagicLink,
  markSkipOnboardingGateOnce,
  readPendingMagicLink
} from "@/lib/auth/magicLinkSession";

type Status = "checking" | "need-email" | "signing-in" | "success" | "error";

export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [status, setStatus] = useState<Status>("checking");
  const [emailInput, setEmailInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function completeLinkSignIn(email: string, fullUrl: string) {
    if (!auth?.isConfigured) return;

    setStatus("signing-in");
    setErrorMessage(null);

    try {
      await auth.completeSignInWithEmailLink(email, fullUrl);
      setStatus("success");

      const currentUser = firebaseAuth?.currentUser ?? null;
      const url = new URL(fullUrl);
      const pending = readPendingMagicLink();
      const isSignup =
        url.searchParams.get("mode") === "signup" || pending?.mode === "signup";

      if (currentUser && isSignup) {
        await flushOnboardingAnswers(currentUser.uid, currentUser.displayName);
      }

      markSkipOnboardingGateOnce();
      router.replace(destinationAfterMagicLink(fullUrl));
    } catch {
      setStatus("error");
      setErrorMessage(
        "This link has expired or already been used. Request a new one.",
      );
    }
  }

  useEffect(() => {
    if (!auth?.isConfigured) {
      setStatus("error");
      setErrorMessage("Sign-in is not configured.");
      return;
    }
    if (typeof window === "undefined") return;

    const fullUrl = window.location.href;
    const isLink = auth.isSignInWithEmailLink(fullUrl);

    if (!isLink) {
      setStatus("error");
      setErrorMessage(
        "This page is for completing sign-in. Use the link from your email.",
      );
      return;
    }

    const storedEmail = readLoginEmailForLink(fullUrl);

    if (storedEmail) {
      void completeLinkSignIn(storedEmail, fullUrl);
      return;
    }

    setStatus("need-email");
  }, [auth]);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email || !auth?.isConfigured) return;
    await completeLinkSignIn(email, window.location.href);
  }

  if (status === "checking" || status === "signing-in") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          {status === "signing-in" ? "Signing you in…" : "Checking link…"}
        </p>
      </div>
    );
  }

  if (status === "need-email") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="auth-block" style={{ maxWidth: 360 }}>
          <h2 className="ob-title" style={{ fontSize: 22, marginBottom: 8 }}>
            Enter your email
          </h2>
          <p className="auth-legal" style={{ marginBottom: 16 }}>
            We couldn&apos;t verify which address this link was sent to. Enter the
            same email you used to request the sign-in link.
          </p>
          <form onSubmit={handleSubmitEmail}>
            <div className="auth-input-wrap">
              <div className="auth-input-label">Email Address</div>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", marginTop: 12 }}
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="auth-block" style={{ maxWidth: 360 }}>
          <p
            className="auth-legal"
            style={{ color: "var(--red)", marginBottom: 16 }}
          >
            {errorMessage}
          </p>
          <a
            href="/signin"
            className="btn-primary"
            style={{ display: "inline-block" }}
          >
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
        Redirecting…
      </p>
    </div>
  );
}
