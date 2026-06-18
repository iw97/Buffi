"use client";

import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PaywallTierList } from "@/components/paywall/PaywallTierList";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNativePurchase } from "@/hooks/useNativePurchase";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export function PaywallScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  useRequireAuth("/paywall");
  const { startCheckout, checkoutError } = useStripeCheckout();

  const loading = auth?.loading ?? true;
  const isConfigured = auth?.isConfigured ?? false;
  const user = auth?.user ?? null;
  const isPro = auth?.profile?.isPro ?? false;
  const isNative = Capacitor.isNativePlatform();
  const { startNativePurchase, purchaseError: nativePurchaseError, purchaseLoading } = useNativePurchase();

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
        UNLOCK FULL ACCESS
      </h1>
      <p className="ob-desc" style={{ marginTop: 8 }}>
        Upgrade to keep scanning with unlimited breakdowns.
      </p>

      <PaywallTierList
        variant="page"
        onSelectPlan={(plan) =>
          isNative ? void startNativePurchase(plan) : void startCheckout(plan)
        }
      />
      {(isNative ? nativePurchaseError : checkoutError) && (
        <p className="auth-legal" style={{ color: "var(--red)", textAlign: "center", marginTop: 4 }}>
          {isNative ? nativePurchaseError : checkoutError}
        </p>
      )}
      {purchaseLoading && (
        <p className="auth-legal" style={{ color: "var(--text-dim)", textAlign: "center", marginTop: 4 }}>
          Opening purchase…
        </p>
      )}

      <button className="btn-secondary" type="button" onClick={() => router.push("/scan")}>
        Back to scan
      </button>
    </div>
  );
}
