"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PaywallTierList } from "@/components/paywall/PaywallTierList";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNativePurchase } from "@/hooks/useNativePurchase";
import { useRequireAuth } from "@/hooks/useRequireAuth";

function UpgradeScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthOptional();
  useRequireAuth("/upgrade");
  const isNative = Capacitor.isNativePlatform();
  const { startCheckout, checkoutError } = useStripeCheckout();
  const { startNativePurchase, purchaseError, purchaseLoading } = useNativePurchase();

  const loading = auth?.loading ?? true;
  const isConfigured = auth?.isConfigured ?? false;
  const user = auth?.user ?? null;
  const isPro = auth?.profile?.isPro ?? false;
  const isLifetime = auth?.profile?.subscriptionStatus === "lifetime";
  /** Pro weekly/yearly users can open paywall via profile lifetime upgrade link. */
  const lifetimeUpgrade = searchParams.get("lifetimeUpgrade") === "1";
  const allowProAccess = lifetimeUpgrade && isPro && !isLifetime;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="auth-legal">Loading…</p>
      </div>
    );
  }

  if (isConfigured && !user) return null;

  if (isPro && !allowProAccess) {
    router.replace("/scan");
    return null;
  }

  return (
    <div className="upgrade-screen flex flex-col">
      <div className="section-eyebrow">Buffi Pro</div>
      <h1 className="ob-title" style={{ marginBottom: 0 }}>
        {allowProAccess ? "UPGRADE TO LIFETIME" : "UNLOCK FULL ACCESS"}
      </h1>
      <p className="ob-desc" style={{ marginTop: 8 }}>
        {allowProAccess
          ? "Pay once and keep Buffi forever — no renewals, no subscription."
          : "Buffi is funded entirely by you, not by brands. Join shoppers who decided to take their power back."}
      </p>

      <PaywallTierList
        variant="page"
        onlyPlans={allowProAccess ? ["lifetime"] : undefined}
        onSelectPlan={(plan) =>
          isNative ? void startNativePurchase(plan) : void startCheckout(plan)
        }
        disabled={purchaseLoading}
      />
      {(isNative ? purchaseError : checkoutError) && (
        <p className="auth-legal" style={{ color: "var(--red)", textAlign: "center", marginTop: 4 }}>
          {isNative ? purchaseError : checkoutError}
        </p>
      )}

      <button
        className="btn-secondary"
        type="button"
        onClick={() => router.push(allowProAccess ? "/profile" : "/scan")}
      >
        {allowProAccess ? "Back to profile" : "Back to scan"}
      </button>
    </div>
  );
}

export function UpgradeScreen() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="auth-legal">Loading…</p>
        </div>
      }
    >
      <UpgradeScreenInner />
    </Suspense>
  );
}
