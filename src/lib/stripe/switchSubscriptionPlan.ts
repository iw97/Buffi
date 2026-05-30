import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import type { PaywallPlanId } from "@/lib/paywall/planIds";
import { getStripePriceIdForPlan } from "@/lib/stripe/priceIds";
import { applyStripeSubscriptionToUser } from "@/lib/stripe/syncUserFromStripe";

export async function switchSubscriptionPlanForUser(
  uid: string,
  customerId: string,
  subscriptionId: string,
  targetPlan: PaywallPlanId,
  source: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const priceId = getStripePriceIdForPlan(targetPlan);
  if (!priceId) throw new Error("Price not configured for this plan");
  if (targetPlan === "lifetime") throw new Error("Cannot switch an active subscription to lifetime via plan change");

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no line items");

  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: {
      ...sub.metadata,
      firebaseUid: uid,
      switchedVia: source
    }
  });

  await applyStripeSubscriptionToUser(uid, customerId, updated);
  return updated;
}
