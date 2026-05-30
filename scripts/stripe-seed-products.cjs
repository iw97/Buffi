/**
 * Creates Stripe products/prices for Buffi Pro (Weekly, Monthly, Annual, Lifetime).
 * Run: node scripts/stripe-seed-products.cjs
 * Requires STRIPE_SECRET_KEY in .env.local or environment.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const Stripe = require("stripe");

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("Missing STRIPE_SECRET_KEY. Add it to .env.local first.");
    process.exit(1);
  }

  const stripe = new Stripe(key);

  const weeklyProduct = await stripe.products.create({
    name: "Buffi Weekly",
    description: "Buffi Pro — billed weekly"
  });
  const weeklyPrice = await stripe.prices.create({
    product: weeklyProduct.id,
    unit_amount: 299,
    currency: "usd",
    recurring: { interval: "week" }
  });

  const monthlyProduct = await stripe.products.create({
    name: "Buffi Monthly",
    description: "Buffi Pro — billed monthly"
  });
  const monthlyPrice = await stripe.prices.create({
    product: monthlyProduct.id,
    unit_amount: 799,
    currency: "usd",
    recurring: { interval: "month" }
  });

  const annualProduct = await stripe.products.create({
    name: "Buffi Annual",
    description: "Buffi Pro — billed annually"
  });
  const annualPrice = await stripe.prices.create({
    product: annualProduct.id,
    unit_amount: 4999,
    currency: "usd",
    recurring: { interval: "year" }
  });

  const lifeProduct = await stripe.products.create({
    name: "Buffi Lifetime",
    description: "Buffi Pro — one-time lifetime access"
  });
  const lifePrice = await stripe.prices.create({
    product: lifeProduct.id,
    unit_amount: 14900,
    currency: "usd"
  });

  console.log("\nAdd these to .env.local (and Vercel):\n");
  console.log(`STRIPE_PRICE_WEEKLY=${weeklyPrice.id}`);
  console.log(`STRIPE_PRICE_MONTHLY=${monthlyPrice.id}`);
  console.log(`STRIPE_PRICE_ANNUAL=${annualPrice.id}`);
  console.log(`STRIPE_PRICE_LIFETIME=${lifePrice.id}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
