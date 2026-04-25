// Server-side Stripe client. Throws clearly if STRIPE_SECRET_KEY is unset
// so the IDV routes can return a graceful 501 in dev / staging.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to your environment to enable Stripe Identity.");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as any,
    appInfo: { name: "They Can't Be Trusted", version: "0.1.0" },
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
