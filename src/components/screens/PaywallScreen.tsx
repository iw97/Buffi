"use client";

import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type PlanId = "weekly" | "monthly" | "yearly";

function logCheckoutSelection(plan: PlanId) {
  // TODO(stripe): Replace with real Stripe Checkout session creation.
  // Future retention flow: when weekly subscribers cancel, offer $7/month before final cancellation via webhook-backed logic.
  console.log("[paywall] selected plan:", plan);
}

export function PaywallScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  useRequireAuth("/paywall");

  const loading = auth?.loading ?? true;
  const isConfigured = auth?.isConfigured ?? false;
  const user = auth?.user ?? null;
  const isPro = auth?.profile?.isPro ?? false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="auth-legal">Loading…</p>
      </div>
    );
  }

  if (isConfigured && !user) return null;

  if (isPro) {
    router.replace("/scan");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col p-6" style={{ gap: 16 }}>
      <div className="section-eyebrow">Buffi Pro</div>
      <h1 className="ob-title" style={{ marginBottom: 0 }}>
        Free scans used up.
      </h1>
      <p className="ob-desc" style={{ marginTop: 8 }}>
        Upgrade to keep scanning with unlimited breakdowns.
      </p>

      <button className="btn-primary" type="button" onClick={() => logCheckoutSelection("weekly")}>
        Start weekly - $3/week
      </button>

      <button className="btn-primary" type="button" onClick={() => logCheckoutSelection("monthly")}>
        Start monthly - $9/month
      </button>

      <button
        className="btn-primary"
        type="button"
        onClick={() => logCheckoutSelection("yearly")}
        style={{ position: "relative" }}
      >
        <span
          style={{
            position: "absolute",
            right: 10,
            top: -9,
            background: "var(--teal)",
            color: "black",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 999
          }}
        >
          Best value
        </span>
        Start yearly - $30/year
      </button>

      <button className="btn-secondary" type="button" onClick={() => router.push("/scan")}>
        Back to scan
      </button>
    </div>
  );
}
