"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";

export function UpgradeSuccessScreen() {
  const router = useRouter();
  const auth = useAuthOptional();

  useEffect(() => {
    void auth?.refreshProfile();
  }, [auth]);

  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      void auth?.refreshProfile();
      if (++n >= 12) window.clearInterval(id);
    }, 400);
    return () => window.clearInterval(id);
  }, [auth]);

  useEffect(() => {
    const t = window.setTimeout(() => router.replace("/scan"), 3000);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="section-eyebrow">Buffi Pro</div>
      <h1 className="ob-title" style={{ marginBottom: 0 }}>
        You&apos;re in.
      </h1>
      <p className="ob-desc" style={{ marginTop: 0, maxWidth: 320 }}>
        Thanks for supporting independent material intelligence. Redirecting to scan…
      </p>
      <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
        Taking you home in 3 seconds.
      </p>
    </div>
  );
}
