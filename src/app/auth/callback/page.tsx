"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { BUFFI_SIGNIN_EMAIL_KEY } from "@/lib/firebase/client";

type Status = "checking" | "need-email" | "signing-in" | "success" | "error";

export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [status, setStatus] = useState<Status>("checking");
  const [emailInput, setEmailInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage("This page is for completing sign-in. Use the link from your email.");
      return;
    }

    const storedEmail = window.localStorage.getItem(BUFFI_SIGNIN_EMAIL_KEY)?.trim() || null;

    if (storedEmail) {
      setStatus("signing-in");
      auth
        .completeSignInWithEmailLink(storedEmail, fullUrl)
        .then(() => {
          setStatus("success");
          router.replace("/scan");
        })
        .catch(() => {
          setStatus("error");
          setErrorMessage("This link has expired or already been used. Request a new one.");
        });
      return;
    }

    setStatus("need-email");
  }, [auth]);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email || !auth?.isConfigured) return;

    setStatus("signing-in");
    setErrorMessage(null);

    try {
      await auth.completeSignInWithEmailLink(email, window.location.href);
      setStatus("success");
      router.replace("/scan");
    } catch {
      setStatus("error");
      setErrorMessage("This link has expired or already been used. Request a new one.");
    }
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
            You opened this link on a different device. Enter the email address where we sent the sign-in link.
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
            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: 12 }}>
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
          <p className="auth-legal" style={{ color: "var(--red)", marginBottom: 16 }}>
            {errorMessage}
          </p>
          <a href="/onboarding/account" className="btn-primary" style={{ display: "inline-block" }}>
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
