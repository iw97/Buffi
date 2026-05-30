import Stripe from "stripe";

let stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripe !== undefined) return stripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    stripe = null;
    return null;
  }
  stripe = new Stripe(key);
  return stripe;
}
