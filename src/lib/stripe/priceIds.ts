import type { PaywallPlanId } from "@/lib/paywall/planIds";

export function getStripePriceIdForPlan(plan: PaywallPlanId): string | null {
  const env =
    plan === "weekly"
      ? process.env.STRIPE_PRICE_WEEKLY
      : plan === "yearly"
        ? process.env.STRIPE_PRICE_ANNUAL
        : process.env.STRIPE_PRICE_LIFETIME;
  const id = env?.trim();
  return id || null;
}
