"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Purchases, PURCHASES_ERROR_CODE } from "@revenuecat/purchases-capacitor";
import { useAuthOptional } from "@/contexts/AuthContext";
import type { PaywallPlanId } from "@/lib/paywall/planIds";

const PLAN_TO_PRODUCT_ID: Record<PaywallPlanId, string> = {
  weekly: "app.buffi.weekly",
  yearly: "app.buffi.yearly",
  lifetime: "app.buffi.lifetime",
  monthly: "app.buffi.monthly",
};

export function useNativePurchase() {
  const auth = useAuthOptional();
  const router = useRouter();
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const startNativePurchase = useCallback(
    async (plan: PaywallPlanId) => {
      setPurchaseError(null);
      setPurchaseLoading(true);
      try {
        const productId = PLAN_TO_PRODUCT_ID[plan];

        const { current } = await Purchases.getOfferings();
        if (!current) {
          throw new Error("No offerings available. Check your RevenueCat dashboard configuration.");
        }

        const pkg = current.availablePackages.find(
          (p) => p.product.identifier === productId
        );
        if (!pkg) {
          throw new Error(`Plan "${plan}" not found in current offering.`);
        }

        await Purchases.purchasePackage({ aPackage: pkg });

        // Purchase confirmed client-side. The RC webhook will update Firestore
        // in the background; UpgradeSuccessScreen polls refreshProfile to catch it.
        router.push("/upgrade/success");
      } catch (e: unknown) {
        const err = e as { code?: unknown; message?: string };
        if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          // user tapped cancel — not an error
          return;
        }
        console.error("[useNativePurchase]", e);
        setPurchaseError(err.message ?? "Purchase failed. Please try again.");
      } finally {
        setPurchaseLoading(false);
      }
    },
    [router]
  );

  // Call after purchase to force-sync the profile from Firestore
  const refreshAfterPurchase = useCallback(async () => {
    await auth?.refreshProfile?.();
  }, [auth]);

  return { startNativePurchase, purchaseError, purchaseLoading, refreshAfterPurchase };
}
