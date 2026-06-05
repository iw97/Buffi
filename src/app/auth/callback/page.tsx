"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthOptional } from "@/contexts/AuthContext";

type Status = "checking" | "success" | "error";

/** Completes Google OAuth redirect sign-in (popup flow uses /signin directly). */
export default function AuthCallbackPage() {
  const router = useRouter();
  const authCtx = useAuthOptional();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setStatus("error");
      setErrorMessage("Sign-in is not configured.");
      return;
    }

    let cancelled = false;

    void getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled) return;
        if (result?.user) {
          await authCtx?.refreshProfile?.();
          setStatus("success");
          router.replace("/scan?from=auth");
          return;
        }
        router.replace("/signin");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage("Sign-in could not be completed.");
      });

    return () => {
      cancelled = true;
    };
  }, [router, authCtx]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="auth-block" style={{ maxWidth: 360 }}>
          <p className="auth-legal" style={{ color: "var(--red)", marginBottom: 16 }}>
            {errorMessage}
          </p>
          <a href="/signin" className="btn-primary" style={{ display: "inline-block" }}>
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
        {status === "success" ? "Redirecting…" : "Completing sign-in…"}
      </p>
    </div>
  );
}
