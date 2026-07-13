"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
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

/** Standard RC package identifiers. */
const PLAN_TO_RC_PACKAGE_ID: Record<PaywallPlanId, string> = {
  weekly: "$rc_weekly",
  yearly: "$rc_annual",
  lifetime: "$rc_lifetime",
  monthly: "$rc_monthly"
};

/** App Store / Play product ids configured in RevenueCat. */
const PLAN_TO_PRODUCT_ID: Record<PaywallPlanId, string> = {
  weekly: "app.buffi.weekly",
  yearly: "app.buffi.yearly",
  lifetime: "app.buffi.lifetime",
  monthly: "app.buffi.monthly"
};

/**
 * Resolve the RC package for a plan.
 * Prefer exact Store product id so we never purchase the wrong package
 * when offering convenience slots are misconfigured.
 */
function findPackageForPlan(offering: PurchasesOffering, plan: PaywallPlanId): PurchasesPackage | null {
  const productId = PLAN_TO_PRODUCT_ID[plan];
  const packageId = PLAN_TO_RC_PACKAGE_ID[plan];
  const slotKey = PLAN_TO_RC_PACKAGE_SLOT[plan];

  const byProduct = offering.availablePackages.find((p) => p.product.identifier === productId);
  if (byProduct) return byProduct;

  const byPackageId = offering.availablePackages.find((p) => p.identifier === packageId);
  if (byPackageId) return byPackageId;

  const fromSlot = offering[slotKey];
  if (fromSlot) return fromSlot;

  return null;
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
        if (!Capacitor.isNativePlatform()) {
          throw new Error("In-app purchases are only available in the Buffi iOS app.");
        }

        const uid = auth?.user?.uid;
        if (uid) {
          await Purchases.logIn({ appUserID: uid });
        }

        const expectedProductId = PLAN_TO_PRODUCT_ID[plan];
        const { current } = await Purchases.getOfferings();
        if (!current) {
          throw new Error("No offerings available. Check your RevenueCat dashboard configuration.");
        }

        const pkg = findPackageForPlan(current, plan);
        if (!pkg) {
          const available = current.availablePackages
            .map((p) => `${p.identifier}:${p.product.identifier}`)
            .join(", ");
          console.error("[useNativePurchase] package not found", { plan, available });
          throw new Error(`Plan "${plan}" not found in current offering.`);
        }

        // Refuse mismatched slot packages for lifetime (non-consumables skip the sheet when already owned
        // of the *wrong* product too — better to fail loudly than fake success).
        if (plan === "lifetime" && pkg.product.identifier !== expectedProductId) {
          console.error("[useNativePurchase] lifetime package product mismatch", {
            expected: expectedProductId,
            got: pkg.product.identifier,
            packageId: pkg.identifier,
            packageType: pkg.packageType
          });
          throw new Error(
            `Lifetime package is linked to "${pkg.product.identifier}" instead of "${expectedProductId}". Check RevenueCat offerings.`
          );
        }

        console.log("[useNativePurchase] purchasing", {
          plan,
          packageId: pkg.identifier,
          productId: pkg.product.identifier,
          packageType: pkg.packageType
        });

        const result = await Purchases.purchasePackage({ aPackage: pkg });

        // Guard against stub/mock completions and wrong-product completions.
        if (!result?.productIdentifier) {
          throw new Error("Purchase did not return a product. Please try again.");
        }
        if (
          result.productIdentifier !== expectedProductId &&
          result.productIdentifier !== pkg.product.identifier
        ) {
          throw new Error(`Unexpected product purchased: ${result.productIdentifier}`);
        }
        if (!result.transaction?.transactionIdentifier) {
          throw new Error("Purchase did not complete a store transaction. Please try again.");
        }

        console.log("[useNativePurchase] purchase ok", {
          productIdentifier: result.productIdentifier,
          transactionIdentifier: result.transaction.transactionIdentifier
        });

        // Purchase confirmed client-side. The RC webhook will update Firestore
        // in the background; UpgradeSuccessScreen polls refreshProfile to catch it.
        router.push("/upgrade/success");
      } catch (e: unknown) {
        const err = e as { code?: unknown; message?: string };
        if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          // user tapped cancel — not an error
          return;
        }
        if (err.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
          setPurchaseError("You already own this plan. Restoring access…");
          try {
            await Purchases.restorePurchases();
            await auth?.refreshProfile?.();
            router.push("/upgrade/success");
          } catch (restoreErr) {
            console.error("[useNativePurchase] restore failed", restoreErr);
            setPurchaseError("You already own this plan. Pull to refresh or restart the app if Pro isn’t unlocked.");
          }
          return;
        }
        console.error("[useNativePurchase]", e);
        setPurchaseError(err.message ?? "Purchase failed. Please try again.");
      } finally {
        setPurchaseLoading(false);
      }
    },
    [auth, router]
  );

  // Call after purchase to force-sync the profile from Firestore
  const refreshAfterPurchase = useCallback(async () => {
    await auth?.refreshProfile?.();
  }, [auth]);

  return { startNativePurchase, purchaseError, purchaseLoading, refreshAfterPurchase };
}
