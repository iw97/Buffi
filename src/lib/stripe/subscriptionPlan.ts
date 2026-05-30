import type Stripe from "stripe";
import type { PaywallPlanId } from "@/lib/paywall/planIds";
import { getStripePriceIdForPlan } from "@/lib/stripe/priceIds";

export function planIdFromStripePriceId(priceId: string | undefined | null): PaywallPlanId | null {
  if (!priceId) return null;
  const weekly = getStripePriceIdForPlan("weekly");
  const monthly = getStripePriceIdForPlan("monthly");
  const yearly = getStripePriceIdForPlan("yearly");
  const lifetime = getStripePriceIdForPlan("lifetime");
  if (weekly && priceId === weekly) return "weekly";
  if (monthly && priceId === monthly) return "monthly";
  if (yearly && priceId === yearly) return "yearly";
  if (lifetime && priceId === lifetime) return "lifetime";
  return null;
}

export function currentPlanFromSubscription(sub: Stripe.Subscription): PaywallPlanId | null {
  const priceId = sub.items.data[0]?.price?.id;
  return planIdFromStripePriceId(priceId);
}

/** When deleting account, offer $7.99/mo plan to weekly subscribers. */
export function retentionOfferForDeleteAccount(currentPlan: PaywallPlanId | null): {
  show: boolean;
  offerPlan: PaywallPlanId;
  title: string;
  description: string;
  cta: string;
} | null {
  if (currentPlan !== "weekly") return null;
  if (!getStripePriceIdForPlan("monthly")) return null;
  return {
    show: true,
    offerPlan: "monthly",
    title: "Switch to monthly pricing instead?",
    description:
      "Keep Buffi Pro on our monthly plan — $7.99/month, billed monthly. You can still cancel anytime before your next renewal.",
    cta: "Switch to monthly ($7.99/mo)"
  };
}
