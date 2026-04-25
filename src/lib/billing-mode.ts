// Single switch for "free for everyone" vs "paid tiers".
//
// When FREE_TIER is on:
//   - All signed-in companies get unlimited cross-source DNR + OFAC checks
//   - API access is open to every company (still requires a generated key)
//   - The pricing page shows a "free for verified operators" message
//   - The Pricing nav link is hidden; subscription UI is dormant
//
// When off (paid mode):
//   - Plan tiers in src/lib/plans.ts are enforced
//   - canConsumeCheck() respects plan caps
//   - API access requires Pro / Pro+
//
// All Stripe Billing infrastructure (Checkout, Portal, webhooks) is
// preserved either way — flipping FREE_TIER off (with the billing env
// vars set) re-enables the paid funnel without code changes.
//
// Set BILLING_MODE=paid in env to enable subscriptions. Default = free.

export function isFreeTier(): boolean {
  // Default to free unless explicitly set to paid.
  return (process.env.BILLING_MODE || "free").toLowerCase() !== "paid";
}

export function billingMode(): "free" | "paid" {
  return isFreeTier() ? "free" : "paid";
}
