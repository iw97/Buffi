"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Purchases, PURCHASES_ERROR_CODE } from "@revenuecat/purchases-capacitor";
import type { PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { useAuthOptional } from "@/contexts/AuthContext";
import type { PaywallPlanId } from "@/lib/paywall/planIds";

/** Map paywall plan ids to RevenueCat's standard offering package slots. */
const PLAN_TO_RC_PACKAGE_SLOT: Record<
  PaywallPlanId,
  keyof Pick<PurchasesOffering, "weekly" | "monthly" | "annual" | "lifetime">
> = {
  weekly: "weekly",
  yearly: "annual",
  lifetime: "lifetime",
  monthly: "monthly"
};

/** Standard RC package identifiers (fallback if offering slot accessors are null). */
const PLAN_TO_RC_PACKAGE_ID: Record<PaywallPlanId, string> = {
  weekly: "$rc_weekly",
  yearly: "$rc_annual",
  lifetime: "$rc_lifetime",
  monthly: "$rc_monthly"
};

/** Store product ids — last-resort match if package id lookup fails. */
const PLAN_TO_PRODUCT_ID: Record<PaywallPlanId, string> = {
  weekly: "app.buffi.weekly",
  yearly: "app.buffi.yearly",
  lifetime: "app.buffi.lifetime",
  monthly: "app.buffi.monthly"
};

function findPackageForPlan(offering: PurchasesOffering, plan: PaywallPlanId): PurchasesPackage | null {
  const fromSlot = offering[PLAN_TO_RC_PACKAGE_SLOT[plan]];
  if (fromSlot) return fromSlot;

  const packageId = PLAN_TO_RC_PACKAGE_ID[plan];
  const productId = PLAN_TO_PRODUCT_ID[plan];
  return (
    offering.availablePackages.find(
      (p) => p.identifier === packageId || p.product.identifier === productId
    ) ?? null
  );
}

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
        const uid = auth?.user?.uid;
        if (uid) {
          await Purchases.logIn({ appUserID: uid });
        }

        const { current } = await Purchases.getOfferings();
        if (!current) {
          throw new Error("No offerings available. Check your RevenueCat dashboard configuration.");
        }

        const pkg = findPackageForPlan(current, plan);
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
