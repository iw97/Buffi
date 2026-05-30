import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/server";
import {
  applyLifetimePurchase,
  applyStripeSubscriptionToUser,
  applySubscriptionDeleted,
  resolveUidFromSubscription
} from "@/lib/stripe/syncUserFromStripe";

export async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.firebaseUid?.trim();
      if (!uid) {
        console.error("[stripe webhook] checkout.session.completed missing firebaseUid");
        return;
      }
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      if (!customerId) {
        console.error("[stripe webhook] checkout.session.completed missing customer");
        return;
      }

      if (session.mode === "subscription") {
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId) {
          console.error("[stripe webhook] subscription mode but no subscription id");
          return;
        }
        const sub = await stripe.subscriptions.retrieve(subId);
        await applyStripeSubscriptionToUser(uid, customerId, sub);
      } else if (session.mode === "payment") {
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          console.warn("[stripe webhook] payment session not paid:", session.payment_status, session.id);
          return;
        }
        await applyLifetimePurchase(uid, customerId);
      }
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = await resolveUidFromSubscription(sub);
      if (!uid) {
        console.error("[stripe webhook] subscription.updated could not resolve uid:", sub.id);
        return;
      }
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
      await applyStripeSubscriptionToUser(uid, customerId, sub);
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = await resolveUidFromSubscription(sub);
      if (!uid) {
        console.error("[stripe webhook] subscription.deleted could not resolve uid:", sub.id);
        return;
      }
      await applySubscriptionDeleted(uid);
      return;
    }

    default:
      return;
  }
}
