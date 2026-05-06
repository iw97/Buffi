"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import type { PaywallPlanId } from "@/lib/paywall/planIds";

export function useStripeCheckout() {
  const auth = useAuthOptional();
  const router = useRouter();

  const startCheckout = useCallback(
    async (plan: PaywallPlanId) => {
      const user = auth?.user;
      const isConfigured = auth?.isConfigured ?? false;
      if (!isConfigured || !user) {
        router.push(`/onboarding/account?${new URLSearchParams({ returnTo: "/upgrade" }).toString()}`);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ plan })
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Checkout failed");
        }
        if (data.url) {
          window.location.assign(data.url);
        }
      } catch (e) {
        console.error("[useStripeCheckout]", e);
        window.alert(e instanceof Error ? e.message : "Could not start checkout");
      }
    },
    [auth?.user, auth?.isConfigured, router]
  );

  return { startCheckout };
}
